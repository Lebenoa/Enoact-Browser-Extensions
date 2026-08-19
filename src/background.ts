import { api, isFirefoxLike } from './api'
import type { BackgroundMessage, Config, SaveSettings, Settings, SidebarMessage } from './types'

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
        if (!tab.id) continue
        // A tab that was loaded while the site was disabled has no script to
        // receive the config, so re-enabling would only take effect on reload.
        // Inject on delivery failure — a tab that already has the script takes
        // the message and is never injected twice.
        if (await sendConfig(tab.id, site.config)) continue
        if (site.config.enabled) await injectSiteScript(tab.id, site)
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

// Returns whether a site script actually received the config: sendMessage
// rejects when no listener exists in the tab (no script injected, or the page
// navigated away).
async function sendConfig(tabId: number, config: Config): Promise<boolean> {
    try {
        await api.tabs.sendMessage(tabId, { type: 'CONFIG', config })
        return true
    } catch {
        return false
    }
}

// Site scripts run in the ISOLATED world, so they cannot call page-JS APIs
// like movie_player.getPlayerResponse() — without this shim they would fall
// back to the ytInitialPlayerResponse JSON embedded in the initial HTML,
// which goes stale on SPA navigation (e.g. autoplay advancing to the next
// video in an unfocused tab). The shim runs in the MAIN world and answers a
// DOM event by writing the live player response into a data attribute —
// events and attributes cross worlds, JS object payloads do not.
function playerResponseShim() {
    const ATTR = 'data-enoact-player-response'
    const w = window as { __enoactPlayerShim?: boolean }
    if (w.__enoactPlayerShim) return
    w.__enoactPlayerShim = true
    window.addEventListener('enoact-player-request', () => {
        // Clear first: the listener runs synchronously inside dispatchEvent, so
        // whatever the attribute holds when dispatch returns is this request's
        // answer. Without this, a torn-down or not-yet-ready player would leave
        // the *previous* video's response behind and the reader would take it
        // for the current one instead of falling back to the embedded JSON.
        document.documentElement.removeAttribute(ATTR)
        try {
            const response = (document.getElementById('movie_player') as any)?.getPlayerResponse?.()
            const details = response?.videoDetails
            const micro = response?.microformat?.playerMicroformatRenderer
            if (!details?.videoId) return
            document.documentElement.setAttribute(
                ATTR,
                JSON.stringify({
                    videoDetails: {
                        videoId: details.videoId,
                        title: details.title,
                        author: details.author,
                        channelId: details.channelId,
                        lengthSeconds: details.lengthSeconds,
                        isLiveContent: details.isLiveContent,
                    },
                    microformat: {
                        playerMicroformatRenderer: {
                            thumbnail: micro?.thumbnail,
                            liveBroadcastDetails: micro?.liveBroadcastDetails,
                        },
                    },
                }),
            )
        } catch {
            // Player not ready yet — the attribute stays cleared, so the reader
            // falls back to the embedded JSON.
        }
    })
}

async function injectPlayerResponseShim(tabId: number) {
    try {
        await api.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: playerResponseShim,
        })
    } catch {
        // Older Firefox builds don't support world: 'MAIN'; the site scripts'
        // embedded-JSON fallback still works there, just stale on navigation.
    }
}

async function injectSiteScript(tabId: number, site: Settings[string]) {
    try {
        await injectPlayerResponseShim(tabId)
        await api.scripting.executeScript({
            target: { tabId },
            files: [site.script],
        })
        await sendConfig(tabId, site.config)
    } catch (error) {
        console.error('Failed to inject site script:', error)
    }
}

api.webNavigation.onCommitted.addListener(async (details: any) => {
    if (details.frameId !== 0) return

    const settings = await getSettings()
    const url = new URL(details.url)
    const siteSetting = settings[url.host]
    if (!siteSetting?.script || !siteSetting.config.enabled) return

    await injectSiteScript(details.tabId, siteSetting)
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
        const response: BackgroundMessage = {
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
                    port.postMessage({ type: 'TOGGLE', name: message.name, enabled } satisfies BackgroundMessage)
                    await broadcastConfig(message.name)
                    break
                }
                case 'GET_SETTINGS': {
                    const settings = await getSettings()
                    const site = settings[message.site]
                    if (site) port.postMessage({ type: 'GET_SETTINGS', settings: site.config } satisfies BackgroundMessage)
                    break
                }
                case 'UPDATE_SETTINGS':
                    if (!defaultSettings[message.name]) return
                    await saveSettings({ [message.name]: { config: message.settings } })
                    port.postMessage({ type: 'SUCCESS', message: 'Settings updated successfully' } satisfies BackgroundMessage)
                    await broadcastConfig(message.name)
                    break
            }
        } catch (error) {
            console.error('Sidebar request failed:', error)
            port.postMessage({ type: 'ERROR', message: 'Failed to save settings' } satisfies BackgroundMessage)
        }
        })()
    })
})
