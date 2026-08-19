import { createPresenceClient } from './presence'

type Config = { enabled: boolean; status_display_type?: number }

export default function initTwitch() {
    let config: Config = { enabled: true }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CONFIG') config = message.config
    })
    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    let lastPath = location.pathname
    const client = createPresenceClient(() => {
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
        const title = document.querySelector('[data-a-target="stream-title"]')?.textContent?.trim() || null
        const avatar = (document.querySelector('.tw-avatar img.tw-image-avatar') as HTMLImageElement | null)?.src
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
