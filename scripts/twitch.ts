import { createPresenceClient } from './presence'
import { extractEmbeddedJson } from './embedded-json'

type Config = { enabled: boolean; status_display_type?: number }

type InitialState = {
    stream?: {
        title?: string
        channel?: {
            name?: string
            profileImageURL?: string
        }
    }
}

export default function initTwitch() {
    let config: Config = { enabled: true }

    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    let lastPath = location.pathname
    const client = createPresenceClient(() => {
        if (!config.enabled) return null
        const info = getStreamInfo()
        if (!info.title) return null

        return {
            name: 'Twitch',
            type: 3,
            status_display_type: config.status_display_type ?? 1,
            details: info.title,
            details_url: info.url,
            state: info.channel ?? '<BLANK>',
            state_url: info.channel_url,
            assets: {
                large_image: info.thumbnail,
                large_url: info.url,
                small_image: info.avatar,
                small_text: info.channel ?? '<BLANK>',
                small_url: info.channel_url,
            },
        }
    })

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CONFIG') {
            config = message.config
            // Apply immediately: a disabled site clears, an edit re-pushes.
            client.restart()
        }
    })

    const routeWatcher = setInterval(() => {
        if (location.pathname === lastPath) return
        lastPath = location.pathname
        client.restart()
    }, 500)

    return () => {
        clearInterval(routeWatcher)
        client.stop()
    }

    function getChannelName() {
        const first = location.pathname.replace(/^\/+/, '').split('/')[0]?.toLowerCase()
        if (!first || ['directory', 'videos', 'search', 'settings'].includes(first)) return null
        return first
    }

    function getStreamInfo() {
        const channel = getChannelName()
        // __INITIAL_STATE__ is embedded once in the initial HTML and never
        // updates on SPA navigation — only trust it when it matches the
        // current channel, otherwise read the page DOM (data-a-target hooks).
        const state = extractEmbeddedJson<InitialState>('__INITIAL_STATE__')
        const stream = state?.stream
        const matches = stream?.channel?.name?.toLowerCase() === channel
        const title = matches ? stream?.title ?? null : (document.querySelector('[data-a-target="stream-title"]')?.textContent?.trim() || null)
        const avatar = matches
            ? stream?.channel?.profileImageURL
            : (document.querySelector('.tw-avatar img.tw-image-avatar') as HTMLImageElement | null)?.src
        const url = channel ? `https://www.twitch.tv/${channel}` : undefined
        return {
            channel,
            channel_url: url,
            title,
            thumbnail: channel ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-1920x1080.jpg` : undefined,
            avatar,
            url,
        }
    }
}
