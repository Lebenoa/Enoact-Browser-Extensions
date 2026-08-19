import { createPresenceClient } from './presence'

type Config = {
    enabled: boolean
    channel_info?: boolean
    robust_info?: boolean
    status_display_type?: number
}

type ChannelInfo = {
    channel?: string
    channel_url?: string
    channel_thumbnail?: string
}

export default function initYouTube() {
    let config: Config = { enabled: true, channel_info: true, robust_info: false }
    let cached: ChannelInfo = {}

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CONFIG') config = message.config
    })
    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    const client = createPresenceClient(() => {
        if (window.location.pathname !== '/watch') return null
        const info = getVideoInfo()
        if (!info.title) return null

        const now = Date.now()
        return {
            name: 'YouTube',
            type: 3,
            status_display_type: config.status_display_type ?? 2,
            details: info.title,
            details_url: info.url,
            state: info.channel ?? '<BLANK>',
            state_url: info.channel_url,
            assets: {
                large_image: info.thumbnail,
                large_text: info.title,
                large_url: info.url,
                small_image: info.channel_thumbnail,
                small_text: info.channel ?? '<BLANK>',
                small_url: info.channel_url,
            },
            timestamps: {
                start: Math.round(now - info.current_time * 1000),
                end: info.isLive ? undefined : Math.round(now + (info.duration - info.current_time) * 1000),
            },
        }
    })

    window.addEventListener('yt-navigate-finish', () => {
        cached = {}
        client.restart()
    })

    function getVideoId() {
        return new URLSearchParams(window.location.search).get('v')
    }

    function getThumbnail(videoId: string) {
        return `https://i3.ytimg.com/vi/${videoId}/hqdefault.jpg`
    }

    function getIsLiveStreaming() {
        const element = document.querySelector('div#teaser-carousel div h2')
        return element?.textContent?.trim().toLowerCase() === 'live chat'
    }

    function getChannelInfo(): ChannelInfo {
        let channelElem = document.querySelector('div#text-container.ytd-channel-name a[href]') as HTMLAnchorElement | null
        if (channelElem) {
            const image = document.querySelector('#owner yt-img-shadow#avatar img') as HTMLImageElement | null
            return { channel: channelElem.innerText, channel_url: channelElem.href, channel_thumbnail: image?.src }
        }

        channelElem = document.querySelector("div[id='upload-info'] yt-attributed-string[id='attributed-channel-name'] a") as HTMLAnchorElement | null
        if (!channelElem) return {}

        if (!config.robust_info) {
            const image = document.querySelector("div[id='avatar-stack'] div[class='ytAvatarStackViewModelAvatars'] > div > div:last-child avatar-view-model img") as HTMLImageElement | null
            return { channel: channelElem.innerText, channel_thumbnail: image?.src }
        }

        if (cached.channel) return cached
        channelElem.click()
        const items = document.querySelectorAll('ytd-popup-container yt-list-item-view-model')
        const names: string[] = []
        let thumbnail: string | undefined
        for (const item of items) {
            const link = item.querySelector("a[class~='ytAttributedStringLink'][href]") as HTMLAnchorElement | null
            if (!link) continue
            names.push(link.innerText)
            thumbnail ??= (item.querySelector('avatar-view-model img') as HTMLImageElement | null)?.src
        }
        cached = { channel: names.join(', '), channel_thumbnail: thumbnail }
        document.querySelector('tp-yt-iron-overlay-backdrop[opened]')?.dispatchEvent(new MouseEvent('click'))
        return cached
    }

    function getVideoInfo() {
        const id = getVideoId()
        const video = document.querySelector('video')
        const title = (document.querySelector('h1.title yt-formatted-string') as HTMLElement | null)?.innerText
        const channelInfo = config.channel_info ? getChannelInfo() : { channel: video?.paused ? 'Paused' : 'Playing' }
        return {
            title,
            thumbnail: id ? getThumbnail(id) : undefined,
            url: id ? `https://youtu.be/${id}` : undefined,
            duration: video?.duration || 0,
            current_time: video?.currentTime || 0,
            isLive: getIsLiveStreaming(),
            ...channelInfo,
        }
    }

    return () => client.stop()
}
