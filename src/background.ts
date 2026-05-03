const isFirefoxLike =
    import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
    import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

const SETTINGS_KEY = 'enoact_settings'

const defaultSettings = {
    "www.youtube.com": {
        script: "./scripts/youtube.js",
        config: {
            enabled: true,
            robust_info: true,
        },
    },
    "music.youtube.com": {
        script: "./scripts/youtube-music.js",
        config: {
            enabled: true,
        },
    },
}

type Settings = Record<string, { config: Record<string, any> }>;

let storage: typeof browser.storage | typeof chrome.storage;
let injectedTabId = new Set();

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
async function getSettings(): Promise<typeof defaultSettings> {
    try {
        const extStorage = await storage.sync.get(SETTINGS_KEY)
        return extStorage[SETTINGS_KEY] ? { ...defaultSettings, ...extStorage[SETTINGS_KEY] } : defaultSettings
    } catch (error) {
        console.error('Failed to get settings:', error)
        return defaultSettings
    }
}

getSettings().then((settings) => {
    console.log(settings)
})

// Save settings to storage (only saves config)
async function saveSettings(settings: Partial<Settings>): Promise<void> {
    try {
        const current = await getSettings()
        const updated = { ...current, ...settings }
        console.log({ updated });
        // Only save config properties for each site
        const configOnly: Settings = {}
        for (const [site, siteSettings] of Object.entries(updated)) {
            const { config } = siteSettings ? siteSettings : defaultSettings[site as keyof typeof defaultSettings];
            configOnly[site as keyof Settings] = {
                config,
            }
        }
        await chrome.storage.sync.set({ [SETTINGS_KEY]: configOnly })
        console.log('Settings saved:', configOnly)
    } catch (error) {
        console.error('Failed to save settings:', error)
    }
}

chrome.webNavigation.onCommitted.addListener(async (details) => {
    const settings = await getSettings();
    const url = new URL(details.url);
    const siteSetting = defaultSettings[url.host as keyof typeof defaultSettings];
    if (!siteSetting || !siteSetting.script) return

    const userSettings = await getSettings();
    const isContentEnabled: boolean = userSettings[url.host as keyof typeof userSettings]?.config?.enabled ?? false;
    if (!isContentEnabled) return

    await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: [siteSetting.script],
    })

    setTimeout(() => {
        chrome.tabs.sendMessage(details.tabId, {
            type: "CONFIG",
            config: siteSetting.config,
        })
    }, 2000)
})

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "sidebar") {
        (async () => {
            const initSettings = await getSettings()
            port.postMessage({
                type: "SETTINGS_LIST", items: Object.keys(defaultSettings).map((site) => {
                    return { name: site, enabled: initSettings[site as keyof typeof defaultSettings]?.config?.enabled ?? defaultSettings[site as keyof typeof defaultSettings].config.enabled }
                })
            })
        })()
        port.onMessage.addListener(async (message) => {
            switch (message.type) {
                case 'TOGGLE':
                    if (!message.name) return
                    const currentSettings = await getSettings();
                    const currentValue = currentSettings[message.name as keyof typeof defaultSettings].config.enabled
                    currentSettings[message.name as keyof typeof defaultSettings].config.enabled = !currentValue
                    await saveSettings(currentSettings);
                    port.postMessage({ type: "TOGGLE", name: message.name, enabled: !currentValue })
                    break;
                case 'GET_SETTINGS':
                    if (!message.site) return
                    const settings = await getSettings();
                    const siteSettings = settings[message.site as keyof typeof defaultSettings]
                    port.postMessage({ type: "GET_SETTINGS", settings: siteSettings ? siteSettings.config : defaultSettings[message.site as keyof typeof defaultSettings].config })
                    break;
                case 'UPDATE_SETTINGS':
                    if (!message.name || !message.settings) return
                    try {
                        await saveSettings({ [message.name]: { config: message.settings } });
                        port.postMessage({ type: "SUCCESS", message: "Settings updated successfully" })
                    } catch (err) {
                        port.postMessage({ type: "ERROR", message: "Failed to save settings" })
                    }
                    break;
                default:
                    break;
            }
        })
        port.onDisconnect.addListener(() => {
            console.log('Sidebar disconnected')
        })
    }
})
