import { createPresenceClient, type PresenceActivity } from './presence'

// Shared bootstrap for injected site scripts: wires the config lifecycle
// (CONFIG_REQUEST on start, CONFIG broadcast from the background worker)
// around a presence client, so each site script only defines how to build
// its activity from the current config. Returns restart/stop for the site
// script to hook SPA-navigation listeners onto.
export function createSiteScript<C extends object>(defaultConfig: C, getActivity: (config: C) => PresenceActivity | null) {
    let config: C = structuredClone(defaultConfig)

    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    const client = createPresenceClient(() => getActivity(config))

    chrome.runtime.onMessage.addListener((message: any) => {
        if (message.type === 'CONFIG') {
            config = { ...structuredClone(defaultConfig), ...message.config }
            // Apply immediately: a disabled site clears, an edit re-pushes.
            client.restart()
        }
    })

    return { restart: client.restart, stop: client.stop }
}
