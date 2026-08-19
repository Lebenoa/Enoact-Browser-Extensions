import { createPresenceClient, type PresenceActivity } from './presence'
import { coerceConfig } from '../src/settings-schema'
import { UpdateMode, type Config } from '../src/types'

// Only reached if a site's schema drops the field; coerceConfig fills it otherwise.
const DEFAULT_UPDATE_INTERVAL = 5000

// Playback state changes worth re-reading the page for. Deliberately excludes
// timeupdate, which fires several times a second while a video simply plays —
// the timestamps already sent let Discord extrapolate elapsed time on its own.
const MEDIA_EVENTS = [
    'play',
    'pause',
    'playing',
    'seeked',
    'ratechange',
    'ended',
    'loadedmetadata',
    'durationchange',
    'emptied',
] as const

// Several of these fire together on a track change (emptied, loadedmetadata,
// durationchange, playing); coalesce them into one push.
const EVENT_COALESCE_MS = 250

// Shared bootstrap for injected site scripts: wires the config lifecycle
// (CONFIG_REQUEST on start, CONFIG broadcast from the background worker)
// around a presence client, so each site script only defines how to build
// its activity from the current config. Config defaults and validation come
// from the shared schema, so the values a site script sees match what the
// settings panel offered. Returns restart/stop for the site script to hook
// SPA-navigation listeners onto.
export function createSiteScript(site: string, getActivity: (config: Config) => PresenceActivity | null) {
    let config: Config = coerceConfig(site, undefined)
    let stopSchedule: () => void = () => {}

    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    const client = createPresenceClient(() => getActivity(config))
    schedule()

    chrome.runtime.onMessage.addListener((message: any) => {
        if (message.type === 'CONFIG') {
            config = coerceConfig(site, message.config)
            // Mode or interval may have changed — rebuild the schedule before
            // pushing, so the new cadence is in force from here on.
            schedule()
            // Apply immediately: a disabled site clears, an edit re-pushes.
            client.restart()
        }
    })

    return {
        restart: client.restart,
        stop: () => {
            stopSchedule()
            client.stop()
        },
    }

    function schedule() {
        stopSchedule()
        stopSchedule = config.update_mode === UpdateMode.Event ? watchEvents(client.push) : poll(client.push)
    }

    function poll(push: () => void) {
        const timer = setInterval(push, config.update_interval ?? DEFAULT_UPDATE_INTERVAL)
        return () => clearInterval(timer)
    }

    function watchEvents(push: () => void) {
        let coalesce: ReturnType<typeof setTimeout> | undefined
        const trigger = () => {
            if (coalesce) clearTimeout(coalesce)
            coalesce = setTimeout(push, EVENT_COALESCE_MS)
        }

        // Listen on the document in the capture phase: media events do not
        // bubble, but capture still reaches them — and this keeps working when
        // the site swaps in a new <video> element on navigation, which a
        // listener bound to the element itself would not survive.
        for (const event of MEDIA_EVENTS) document.addEventListener(event, trigger, true)

        // Metadata can change with no media event at all (a stream retitled
        // mid-broadcast). Every supported site mirrors that into the tab title.
        const titles = new MutationObserver(trigger)
        titles.observe(document.head, { childList: true, subtree: true, characterData: true })

        return () => {
            if (coalesce) clearTimeout(coalesce)
            for (const event of MEDIA_EVENTS) document.removeEventListener(event, trigger, true)
            titles.disconnect()
        }
    }
}
