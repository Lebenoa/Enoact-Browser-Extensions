import { extractEmbeddedJson } from './embedded-json'

// Browsers keep media-element properties (currentTime, paused, duration)
// current even in hidden tabs, while the player API's getters go stale there
// because their clocks are driven by page JS, which browsers throttle when
// the tab is unfocused. Prefer the live <video> element for playback state
// and only consult the player API before the element exists.
export function isVideoPaused(video: HTMLVideoElement | null, fromPlayerApi: () => boolean): boolean {
    return video ? video.paused : fromPlayerApi()
}

export type Thumbnails = { thumbnails?: { url?: string; width?: number; height?: number }[] }

export type MicroformatRenderer = {
    thumbnail?: Thumbnails
    liveBroadcastDetails?: { isLiveNow?: boolean }
}

export type PlayerResponse = {
    videoDetails?: {
        videoId?: string
        title?: string
        author?: string
        channelId?: string
        lengthSeconds?: string | number
        isLiveContent?: boolean
        thumbnail?: Thumbnails
    }
    microformat?: {
        playerMicroformatRenderer?: MicroformatRenderer
        microformatDataRenderer?: MicroformatRenderer
    }
}

// Watch pages carry playerMicroformatRenderer; YouTube Music serves
// microformatDataRenderer instead, and sometimes neither.
export function getMicroformat(response: PlayerResponse | undefined): MicroformatRenderer | undefined {
    const microformat = response?.microformat
    return microformat?.playerMicroformatRenderer ?? microformat?.microformatDataRenderer
}

// Prefer videoDetails.thumbnail: it is the only thumbnail YouTube Music
// reliably returns (album art, not a video frame), and it is present on watch
// pages too. Falls back to the microformat thumbnail, then to the generated
// i.ytimg URL, which exists for any video id.
export function getThumbnailUrl(response: PlayerResponse | undefined): string | undefined {
    const candidates = response?.videoDetails?.thumbnail?.thumbnails ?? []
    const largest = candidates.reduce<{ url?: string; width?: number } | undefined>(
        (best, current) => ((current.width ?? 0) >= (best?.width ?? 0) ? current : best),
        undefined,
    )
    const videoId = response?.videoDetails?.videoId
    return (
        largest?.url ??
        getMicroformat(response)?.thumbnail?.thumbnails?.[0]?.url ??
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined)
    )
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
