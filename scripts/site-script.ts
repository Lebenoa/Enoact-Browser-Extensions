import { createPresenceClient, type PresenceActivity } from './presence'
import { coerceConfig } from '../src/settings-schema'
import type { Config } from '../src/types'

// Shared bootstrap for injected site scripts: wires the config lifecycle
// (CONFIG_REQUEST on start, CONFIG broadcast from the background worker)
// around a presence client, so each site script only defines how to build
// its activity from the current config. Config defaults and validation come
// from the shared schema, so the values a site script sees match what the
// settings panel offered. Returns restart/stop for the site script to hook
// SPA-navigation listeners onto.
export function createSiteScript(site: string, getActivity: (config: Config) => PresenceActivity | null) {
    let config: Config = coerceConfig(site, undefined)

    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    const client = createPresenceClient(() => getActivity(config))

    chrome.runtime.onMessage.addListener((message: any) => {
        if (message.type === 'CONFIG') {
            config = coerceConfig(site, message.config)
            // Apply immediately: a disabled site clears, an edit re-pushes.
            client.restart()
        }
    })

    return { restart: client.restart, stop: client.stop }
}
