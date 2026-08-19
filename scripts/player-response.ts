import { extractEmbeddedJson } from './embedded-json'

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

// Returns the player response for the currently loaded video, preferring the
// player element's own API (which stays current across SPA navigation) and
// falling back to the ytInitialPlayerResponse JSON from the initial page HTML.
export function getPlayerResponse(): PlayerResponse | undefined {
    const player = document.getElementById('movie_player') as { getPlayerResponse?: () => PlayerResponse } | null
    const response = player?.getPlayerResponse?.()
    if (response?.videoDetails?.videoId) return response
    return extractEmbeddedJson<PlayerResponse>('ytInitialPlayerResponse')
}
