import { createPresenceClient } from './presence'
import { getPlayerResponse } from './player-response'

type Config = { enabled: boolean; status_display_type?: number }

export default function initYouTubeMusic() {
    let config: Config = { enabled: true }

    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    const client = createPresenceClient(() => {
        if (!config.enabled) return null
        const info = getTrackInfo()
        if (!info.title) return null

        const now = Date.now()
        return {
            name: 'YouTube Music',
            type: 2,
            status_display_type: config.status_display_type ?? 2,
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
    })

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CONFIG') {
            config = message.config
            // Apply immediately: a disabled site clears, an edit re-pushes.
            client.restart()
        }
    })

    window.addEventListener('yt-navigate-finish', () => client.restart())

    function getTrackInfo() {
        const response = getPlayerResponse()
        const details = response?.videoDetails
        const microformat = response?.microformat?.playerMicroformatRenderer
        const player = document.getElementById('movie_player') as any
        const progress = document.querySelector("tp-yt-paper-slider[id='progress-bar'][value][aria-valuemax]")
        const playButton = (document.querySelector("yt-icon-button[id='play-pause-button'][title]") as HTMLElement | null)?.getAttribute('title')
        const videoId = details?.videoId

        const state = player?.getPlayerState?.()
        const playing = state === 1 || state === 3 || (state === undefined && playButton === 'Pause')

        return {
            title: details?.title,
            thumbnail: microformat?.thumbnail?.thumbnails?.[0]?.url,
            url: videoId ? `https://music.youtube.com/watch?v=${videoId}` : undefined,
            artist: details?.author,
            artist_url: details?.channelId ? `https://music.youtube.com/channel/${details.channelId}` : undefined,
            duration: Number(details?.lengthSeconds ?? progress?.getAttribute('aria-valuemax') ?? 0),
            current_time: Number(player?.getCurrentTime?.() ?? progress?.getAttribute('value') ?? 0),
            isPlaying: playing,
        }
    }

    return () => client.stop()
}
