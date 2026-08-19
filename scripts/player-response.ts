import { extractEmbeddedJson } from './embedded-json'

// Browsers keep media-element properties (currentTime, paused, duration)
// current even in hidden tabs, while the player API's getters go stale there
// because their clocks are driven by page JS, which browsers throttle when
// the tab is unfocused. Prefer the live <video> element for playback state
// and only consult the player API before the element exists.
export function isVideoPaused(video: HTMLVideoElement | null, fromPlayerApi: () => boolean): boolean {
    return video ? video.paused : fromPlayerApi()
}

export type PlayerResponse = {
    videoDetails?: {
        videoId?: string
        title?: string
        author?: string
        channelId?: string
        lengthSeconds?: string | number
        isLiveContent?: boolean
    }
    microformat?: {
        playerMicroformatRenderer?: {
            thumbnail?: { thumbnails?: { url?: string }[] }
            liveBroadcastDetails?: { isLiveNow?: boolean }
        }
    }
}

// Returns the player response for the currently loaded video. This script runs
// in the ISOLATED world, so it cannot call movie_player.getPlayerResponse()
// directly; instead it asks the MAIN-world shim (injected by the background
// worker) via a DOM event — the shim writes the live response into a data
// attribute synchronously while the event dispatches. The embedded
// ytInitialPlayerResponse JSON is only a fallback: it is frozen at initial
// page load and goes stale on SPA navigation (e.g. autoplay in an unfocused
// tab) and whenever the shim is unavailable.
export function getPlayerResponse(): PlayerResponse | undefined {
    window.dispatchEvent(new CustomEvent('enoact-player-request'))
    const raw = document.documentElement.getAttribute('data-enoact-player-response')
    if (raw) {
        try {
            const response = JSON.parse(raw) as PlayerResponse
            if (response.videoDetails?.videoId) return response
        } catch {
            // Malformed — fall through to the embedded JSON.
        }
    }
    return extractEmbeddedJson<PlayerResponse>('ytInitialPlayerResponse')
}
