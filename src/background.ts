import { api, isFirefoxLike } from './api'

const SETTINGS_KEY = 'enoact_settings'

const defaultSettings: Settings = {
    'www.youtube.com': {
        script: './scripts/youtube.js',
        config: { enabled: true, channel_info: true },
    },
    'music.youtube.com': {
        script: './scripts/youtube-music.js',
        config: { enabled: true },
    },
    'www.twitch.tv': {
        script: './scripts/twitch.js',
        config: { enabled: true },
    },
}

type SidebarResponse =
    | { type: 'SETTINGS_LIST'; items: { name: string; enabled: boolean }[] }
    | { type: 'TOGGLE'; name: string; enabled: boolean }
    | { type: 'GET_SETTINGS'; settings: Config }
    | { type: 'SUCCESS'; message: string }
    | { type: 'ERROR'; message: string }

if (isFirefoxLike) {
    api.browserAction.onClicked.addListener(() => api.sidebarAction.open())
} else {
    void api.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
}

// Push the latest per-site config to every open tab of that site, so toggles
// (and other settings edits) take effect on already-open tabs immediately.
async function broadcastConfig(host: string) {
    const settings = await getSettings()
    const site = settings[host]
    if (!site) return
    const tabs = await api.tabs.query({ url: `*://${host}/*` })
    for (const tab of tabs) {
        if (tab.id) await sendConfig(tab.id, site.config)
    }
}

function mergeWithDefaults(saved: Partial<Settings>): Settings {
    const merged = structuredClone(defaultSettings)
    for (const [site, siteSettings] of Object.entries(saved)) {
        if (!(site in defaultSettings) || !siteSettings) continue
        merged[site] = {
            ...defaultSettings[site],
            ...siteSettings,
            config: { ...defaultSettings[site].config, ...siteSettings.config },
        }
    }
    // Migrate away from removed config keys (robust_info's popup scraping was
    // replaced by ytInitialPlayerResponse data).
    for (const siteSettings of Object.values(merged)) {
        delete (siteSettings.config as Record<string, unknown>).robust_info
    }
    return merged
}

let settingsCache: Settings | undefined

// The cache can go stale when settings change outside this worker (e.g. via
// chrome.storage.sync from another browser instance) — invalidate on change.
api.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName === 'sync' && changes[SETTINGS_KEY]) settingsCache = undefined
})

async function getSettings(): Promise<Settings> {
    if (settingsCache) return settingsCache
    try {
        const stored = await api.storage.sync.get(SETTINGS_KEY)
        settingsCache = stored[SETTINGS_KEY] ? mergeWithDefaults(stored[SETTINGS_KEY]) : structuredClone(defaultSettings)
        return settingsCache
    } catch (error) {
        console.error('Failed to get settings:', error)
        return structuredClone(defaultSettings)
    }
}

async function saveSettings(settings: Partial<SaveSettings>): Promise<void> {
    const current = await getSettings()
    const updated = { ...current, ...settings }
    const configOnly: SaveSettings = {}

    for (const [site, siteSettings] of Object.entries(updated)) {
        if (!siteSettings) continue
        configOnly[site] = { config: siteSettings.config }
    }

    await api.storage.sync.set({ [SETTINGS_KEY]: configOnly })
    settingsCache = undefined
}

async function sendConfig(tabId: number, config: Config) {
    try {
        await api.tabs.sendMessage(tabId, { type: 'CONFIG', config })
    } catch {
        // Page may have navigated or script may not be ready anymore.
    }
}

api.webNavigation.onCommitted.addListener(async (details: any) => {
    if (details.frameId !== 0) return

    const settings = await getSettings()
    const url = new URL(details.url)
    const siteSetting = settings[url.host]
    if (!siteSetting?.script || !siteSetting.config.enabled) return

    try {
        await api.scripting.executeScript({
            target: { tabId: details.tabId },
            files: [siteSetting.script],
        })
        await sendConfig(details.tabId, siteSetting.config)
    } catch (error) {
        console.error('Failed to inject site script:', error)
    }
})

api.runtime.onMessage.addListener((message: any, sender: any) => {
    if (message?.type === 'CONFIG_REQUEST' && sender.tab?.id) {
        void getSettings().then((settings) => {
            const site = settings[new URL(sender.tab!.url ?? '').host]
            if (site) void api.tabs.sendMessage(sender.tab!.id!, { type: 'CONFIG', config: site.config })
        })
        return
    }

    if (message?.type !== 'openSidebar' || !sender.tab?.id) return

    if (isFirefoxLike) {
        void api.sidebarAction.open()
    } else {
        void api.sidePanel.open({ tabId: sender.tab.id })
    }
})

api.runtime.onConnect.addListener((port: any) => {
    if (port.name !== 'sidebar') return

    void getSettings().then((settings) => {
        const response: SidebarResponse = {
            type: 'SETTINGS_LIST',
            items: Object.keys(defaultSettings).map((site) => ({
                name: site,
                enabled: settings[site].config.enabled,
            })),
        }
        port.postMessage(response)
    })

    port.onMessage.addListener((rawMessage: unknown) => {
        const message = rawMessage as SidebarMessage
        void (async () => {
        try {
            switch (message.type) {
                case 'TOGGLE': {
                    const current = await getSettings()
                    const site = current[message.name]
                    if (!site) return
                    const enabled = !site.config.enabled
                    await saveSettings({ [message.name]: { config: { ...site.config, enabled } } })
                    port.postMessage({ type: 'TOGGLE', name: message.name, enabled } satisfies SidebarResponse)
                    await broadcastConfig(message.name)
                    break
                }
                case 'GET_SETTINGS': {
                    const settings = await getSettings()
                    const site = settings[message.site]
                    if (site) port.postMessage({ type: 'GET_SETTINGS', settings: site.config } satisfies SidebarResponse)
                    break
                }
                case 'UPDATE_SETTINGS':
                    if (!defaultSettings[message.name]) return
                    await saveSettings({ [message.name]: { config: message.settings } })
                    port.postMessage({ type: 'SUCCESS', message: 'Settings updated successfully' } satisfies SidebarResponse)
                    await broadcastConfig(message.name)
                    break
            }
        } catch (error) {
            console.error('Sidebar request failed:', error)
            port.postMessage({ type: 'ERROR', message: 'Failed to save settings' } satisfies SidebarResponse)
        }
        })()
    })
})
