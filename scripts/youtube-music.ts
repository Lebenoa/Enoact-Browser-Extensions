import { createSiteScript } from './site-script'
import { getPlayerResponse, getThumbnailUrl, isVideoPaused } from './player-response'
import { ActivityType, StatusDisplayType } from '../src/activity'
import type { Config } from '../src/types'

export default function initYouTubeMusic() {
    const site = createSiteScript('music.youtube.com', buildActivity)
    window.addEventListener('yt-navigate-finish', site.restart)
    return site.stop

    function buildActivity(config: Config) {
        if (!config.enabled) return null
        const info = getTrackInfo()
        if (!info.title) return null

        const now = Date.now()
        return {
            name: 'YouTube Music',
            type: ActivityType.Listening,
            status_display_type: config.status_display_type ?? StatusDisplayType.Details,
            details: info.title,
            details_url: info.url,
            state: info.artist ?? '<BLANK>',
            state_url: info.artist_url,
            assets: { large_image: info.thumbnail, large_url: info.url },
            // While paused, drop timestamps so the progress freezes instead of
            // drifting (consistent with YouTube and Twitch).
            timestamps: info.isPlaying
                ? {
                      start: Math.round(now - info.current_time * 1000),
                      end: Math.round(now + (info.duration - info.current_time) * 1000),
                  }
                : undefined,
        }
    }

    function getTrackInfo() {
        const response = getPlayerResponse()
        const details = response?.videoDetails
        const player = document.getElementById('movie_player') as any
        const video = document.querySelector('video')
        const progress = document.querySelector("tp-yt-paper-slider[id='progress-bar'][value][aria-valuemax]")
        const playButton = (document.querySelector("yt-icon-button[id='play-pause-button'][title]") as HTMLElement | null)?.getAttribute('title')
        const videoId = details?.videoId

        const state = player?.getPlayerState?.()
        const playing = !isVideoPaused(video, () => !(state === 1 || state === 3 || (state === undefined && playButton === 'Pause')))

        return {
            title: details?.title,
            thumbnail: getThumbnailUrl(response),
            url: videoId ? `https://music.youtube.com/watch?v=${videoId}` : undefined,
            artist: details?.author,
            artist_url: details?.channelId ? `https://music.youtube.com/channel/${details.channelId}` : undefined,
            duration: Number(details?.lengthSeconds ?? video?.duration ?? progress?.getAttribute('aria-valuemax') ?? 0),
            current_time: Number(video?.currentTime ?? player?.getCurrentTime?.() ?? progress?.getAttribute('value') ?? 0),
            isPlaying: playing,
        }
    }
}
