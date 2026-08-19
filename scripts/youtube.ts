import { createPresenceClient } from './presence'
import { getPlayerResponse } from './player-response'

type Config = {
    enabled: boolean
    channel_info?: boolean
    status_display_type?: number
}

export default function initYouTube() {
    let config: Config = { enabled: true, channel_info: true }

    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    const client = createPresenceClient(() => {
        if (!config.enabled) return null
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
            state: info.state,
            state_url: info.channel_url,
            assets: {
                large_image: info.thumbnail,
                large_text: info.title,
                large_url: info.url,
                small_image: info.channel_thumbnail,
                small_text: info.state,
                small_url: info.channel_url,
            },
            // While paused, drop timestamps so the progress freezes instead of
            // drifting (consistent with YouTube Music and Twitch).
            timestamps: info.paused
                ? undefined
                : {
                      start: Math.round(now - info.current_time * 1000),
                      end: info.isLive ? undefined : Math.round(now + (info.duration - info.current_time) * 1000),
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

    window.addEventListener('yt-navigate-finish', () => client.restart())

    function getVideoInfo() {
        const response = getPlayerResponse()
        const details = response?.videoDetails
        const microformat = response?.microformat?.playerMicroformatRenderer
        const player = document.getElementById('movie_player') as any
        const video = document.querySelector('video')
        const videoId = details?.videoId

        const author = config.channel_info ? details?.author : undefined
        const playerState = player?.getPlayerState?.()
        // Prefer the live media element for playback state: the browser keeps
        // media-element properties (currentTime, paused, duration) current even
        // in hidden tabs, while the player API's getters go stale there because
        // their clocks are driven by page JS, which browsers throttle when the
        // tab is unfocused. Embedded JSON stays the source for static metadata.
        const paused = video ? !!video.paused : playerState !== 1 && playerState !== 3

        return {
            title: details?.title,
            thumbnail:
                microformat?.thumbnail?.thumbnails?.[0]?.url ??
                (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined),
            url: videoId ? `https://youtu.be/${videoId}` : undefined,
            duration: Number(details?.lengthSeconds ?? video?.duration ?? player?.getDuration?.() ?? 0),
            current_time: Number(video?.currentTime ?? player?.getCurrentTime?.() ?? 0),
            isLive: !!details?.isLiveContent || !!microformat?.liveBroadcastDetails?.isLiveNow,
            paused,
            state: author ?? (paused ? 'Paused' : 'Playing'),
            channel_url: author && details?.channelId ? `https://www.youtube.com/channel/${details.channelId}` : undefined,
            channel_thumbnail: author ? getChannelAvatar() : undefined,
        }
    }

    function getChannelAvatar() {
        return (document.querySelector('#owner yt-img-shadow#avatar img') as HTMLImageElement | null)?.src
    }

    return () => client.stop()
}
