import { createPresenceClient } from './presence'

type Config = { enabled: boolean; status_display_type?: number }

export default function initYouTubeMusic() {
    let config: Config = { enabled: true }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'CONFIG') config = message.config
    })
    chrome.runtime.sendMessage({ type: 'CONFIG_REQUEST' })

    const client = createPresenceClient(() => {
        const info = getTrackInfo()
        if (!info.title || !info.isPlaying) return null

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
            timestamps: {
                start: Math.round(now - info.current_time * 1000),
                end: Math.round(now + (info.duration - info.current_time) * 1000),
            },
        }
    })

    window.addEventListener('yt-navigate-finish', () => client.restart())

    function getTrackId() {
        const shareUrl = (document.querySelector("yt-copy-link-renderer > div[id='bar'] > input[id='share-url']") as HTMLInputElement | null)?.value
        return shareUrl ? new URL(shareUrl).searchParams.get('v') : null
    }

    function getIsPlaying() {
        return (document.querySelector("yt-icon-button[id='play-pause-button'][title]") as HTMLElement | null)?.getAttribute('title') === 'Pause'
    }

    function getTrackInfo() {
        const id = getTrackId()
        const title = (document.querySelector("div[class~='ytmusic-player-bar'] > yt-formatted-string[class~='title'][title]") as HTMLElement | null)?.innerText
        const artistElem = document.querySelector("yt-formatted-string[class~='ytmusic-player-bar'][class~='complex-string'][title]")
        const artist = artistElem?.getAttribute('title')
        const artistPath = artistElem?.children[0]?.getAttribute('href')
        const thumbnail = (document.querySelector('div.thumbnail-image-wrapper.ytmusic-player-bar > img[src]') as HTMLImageElement | null)?.src
        const progress = document.querySelector("tp-yt-paper-slider[id='progress-bar'][value][aria-valuemax]")
        return {
            title,
            thumbnail,
            url: id ? `https://music.youtube.com/watch?v=${id}` : undefined,
            artist,
            artist_url: artistPath ? `https://music.youtube.com${artistPath}` : undefined,
            duration: Number(progress?.getAttribute('aria-valuemax') || 0),
            current_time: Number(progress?.getAttribute('value') || 0),
            isPlaying: getIsPlaying(),
        }
    }

    return () => client.stop()
}
