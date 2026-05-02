const isFirefoxLike =
    import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
    import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

const SETTINGS_KEY = 'enoact_settings'

const defaultSettings = {
    "www.youtube.com": {
        enabled: true,
        script: "./scripts/youtube.js",
    },
    "music.youtube.com": {
        enabled: true,
        script: "./scripts/youtube-music.js"
    },
}

type Settings = typeof defaultSettings

let storage: typeof browser.storage | typeof chrome.storage;

if (isFirefoxLike) {
    storage = browser.storage;
    browser.browserAction.onClicked.addListener(() => {
        browser.sidebarAction.open()
    })

} else {
    storage = chrome.storage;
    chrome.action.onClicked.addListener(() => {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    })
}


// Get settings from storage
async function getSettings(): Promise<Settings> {
    try {
        const extStorage = await storage.sync.get(SETTINGS_KEY)
        return extStorage[SETTINGS_KEY] ? { ...defaultSettings, ...extStorage[SETTINGS_KEY] } : defaultSettings
    } catch (error) {
        console.error('Failed to get settings:', error)
        return defaultSettings
    }
}

// Save settings to storage
async function saveSettings(settings: Partial<Settings>): Promise<void> {
    try {
        const current = await getSettings()
        const updated = { ...current, ...settings }
        await chrome.storage.sync.set({ [SETTINGS_KEY]: updated })
        console.log('Settings saved:', updated)
    } catch (error) {
        console.error('Failed to save settings:', error)
    }
}



chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return
    if (!tab || !tab.url) return

    console.log(changeInfo, tab);

    const settings = await getSettings();
    const url = new URL(tab.url);
    const siteSetting = settings[url.host as keyof Settings];
    if (!siteSetting) return
    const isContentEnabled: boolean = siteSetting?.enabled ?? false;
    if (!isContentEnabled) return

    chrome.scripting.executeScript({
        target: { tabId },
        files: [siteSetting.script],
    })
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(message, sender);
    switch (message.type) {
        case 'updateSettings':
            saveSettings(message.settings);
            sendResponse({ success: true });
            break;
        default:
            break;
    }
})
