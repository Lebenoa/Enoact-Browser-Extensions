import { api, isFirefoxLike } from './api'
import { SITE_SCHEMAS, coerceConfig } from './settings-schema'
import type { BackgroundMessage, Config, SaveSettings, Settings, SidebarMessage } from './types'

const SETTINGS_KEY = 'enoact_settings'

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

// Rebuilds settings from the schema on every read: sites the schema no longer
// knows are dropped, and each config is coerced to exactly the site's current
// keys, so a removed or retyped setting needs no migration here.
function mergeWithDefaults(saved: Partial<Settings>): Settings {
    const merged: Settings = {}
    for (const [site, schema] of Object.entries(SITE_SCHEMAS)) {
        merged[site] = { script: schema.script, config: coerceConfig(site, saved[site]?.config) }
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
        settingsCache = mergeWithDefaults(stored[SETTINGS_KEY] ?? {})
        return settingsCache
    } catch (error) {
        console.error('Failed to get settings:', error)
        return mergeWithDefaults({})
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
            // YouTube Music uses microformatDataRenderer where watch pages use
            // playerMicroformatRenderer; normalize to the latter so readers see
            // one shape.
            const micro = response?.microformat?.playerMicroformatRenderer ?? response?.microformat?.microformatDataRenderer
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
                        thumbnail: details.thumbnail,
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
        // Older Firefox builds don't support world: 'MAIN'. On YouTube watch
        // pages the site script degrades to the embedded ytInitialPlayerResponse
        // JSON — usable, just stale after SPA navigation. YouTube Music embeds
        // no such JSON at all, so there it degrades to no presence.
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
            items: Object.keys(SITE_SCHEMAS).map((site) => ({
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
                    // Always answer, so the sidebar can leave its loading state
                    // even when it asked about a site the schema dropped.
                    port.postMessage(
                        site
                            ? ({ type: 'GET_SETTINGS', site: message.site, settings: site.config } satisfies BackgroundMessage)
                            : ({ type: 'ERROR', message: `No settings for ${message.site}` } satisfies BackgroundMessage),
                    )
                    break
                }
                case 'UPDATE_SETTINGS': {
                    if (!SITE_SCHEMAS[message.name]) return
                    // Coerce before storing: the panel is the only sender today,
                    // but storage should never hold a shape the schema rejects.
                    const config = coerceConfig(message.name, message.settings)
                    await saveSettings({ [message.name]: { config } })
                    port.postMessage({ type: 'GET_SETTINGS', site: message.name, settings: config } satisfies BackgroundMessage)
                    port.postMessage({ type: 'SUCCESS', message: 'Settings updated successfully' } satisfies BackgroundMessage)
                    await broadcastConfig(message.name)
                    break
                }
            }
        } catch (error) {
            console.error('Sidebar request failed:', error)
            port.postMessage({ type: 'ERROR', message: 'Failed to save settings' } satisfies BackgroundMessage)
        }
        })()
    })
})
