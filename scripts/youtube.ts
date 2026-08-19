import { createSiteScript } from './site-script'
import { getMicroformat, getPlayerResponse, isVideoPaused } from './player-response'
import { ActivityType, StatusDisplayType } from '../src/activity'
import type { Config } from '../src/types'

export default function initYouTube() {
    const site = createSiteScript<Config>(
        { enabled: true, channel_info: true, status_display_type: StatusDisplayType.Details },
        buildActivity,
    )
    window.addEventListener('yt-navigate-finish', site.restart)
    return site.stop

    function buildActivity(config: Config) {
        if (!config.enabled) return null
        if (window.location.pathname !== '/watch') return null
        const info = getVideoInfo(config.channel_info === true)
        if (!info.title) return null

        const now = Date.now()
        return {
            name: 'YouTube',
            type: ActivityType.Watching,
            status_display_type: config.status_display_type ?? StatusDisplayType.Details,
            details: info.title,
            details_url: info.url,
            state: info.state,
            state_url: info.channel_url,
            assets: {
                large_image: info.thumbnail,
                large_text: info.title,
                large_url: info.url,
                small_image: info.channel_thumbnail == '' ? undefined : info.channel_thumbnail,
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
    }

    function getVideoInfo(showChannelInfo: boolean) {
        const response = getPlayerResponse()
        const details = response?.videoDetails
        const microformat = getMicroformat(response)
        const player = document.getElementById('movie_player') as any
        const video = document.querySelector('video')
        const videoId = details?.videoId

        const author = showChannelInfo ? details?.author : undefined
        const playerState = player?.getPlayerState?.()
        const paused = isVideoPaused(video, () => playerState !== 1 && playerState !== 3)

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
}
