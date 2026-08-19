import { createSiteScript } from './site-script'
import { extractEmbeddedJson } from './embedded-json'
import { ActivityType, StatusDisplayType } from '../src/activity'
import type { Config } from '../src/types'

type InitialState = {
    stream?: {
        title?: string
        channel?: {
            name?: string
            displayName?: string
            profileImageURL?: string
        }
    }
}

export default function initTwitch() {
    const site = createSiteScript('www.twitch.tv', buildActivity)

    // Twitch SPA navigation fires no page event we can hook from here, so
    // poll the path and restart the client on change.
    let lastPath = location.pathname
    const routeWatcher = setInterval(() => {
        if (location.pathname === lastPath) return
        lastPath = location.pathname
        site.restart()
    }, 500)

    return () => {
        clearInterval(routeWatcher)
        site.stop()
    }

    function buildActivity(config: Config) {
        if (!config.enabled) return null
        const info = getStreamInfo()
        if (!info.title) return null

        return {
            name: 'Twitch',
            type: ActivityType.Watching,
            status_display_type: config.status_display_type ?? StatusDisplayType.State,
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
    }

    function getChannelName() {
        const first = location.pathname.replace(/^\/+/, '').split('/')[0]?.toLowerCase()
        if (!first || ['directory', 'videos', 'search', 'settings'].includes(first)) return null
        return first
    }

    // The URL only carries the login name, which is always lower case, so
    // "GTASeriesVideos" reaches Discord as "gtaseriesvideos". The rendered
    // name is the streamer's chosen capitalisation — take it from the page and
    // keep the login for URLs.
    function getDisplayName(channel: string | null) {
        if (!channel) return undefined

        const scoped = findChannelAvatar(channel)?.getAttribute('alt')?.trim()
        if (scoped) return scoped

        // The header name is an <h1> inside a link back to the channel.
        for (const heading of document.querySelectorAll<HTMLHeadingElement>('h1')) {
            const href = heading.closest('a')?.getAttribute('href')?.replace(/^\/+/, '').toLowerCase()
            const text = heading.textContent?.trim()
            if (href === channel && text) return text
        }

        // Last resort: the tab title, but only when it differs from the login
        // by capitalisation alone. A title carrying anything else (a stream
        // title, a localised suffix) would put the wrong text on the status.
        const titled = document.title.replace(/\s+-\s+Twitch\s*$/, '').trim()
        if (titled.toLowerCase() === channel) return titled

        return undefined
    }

    // A channel page carries a dozen or more avatars, and the sidebar's
    // followed channels come first in the DOM — so "the first avatar on the
    // page" is some unrelated streamer (or the viewer's own account), never
    // the one being watched. The streamer's avatar is the one whose link
    // points back at the channel in the URL.
    function findChannelAvatar(channel: string) {
        for (const image of document.querySelectorAll<HTMLImageElement>('img.tw-image-avatar')) {
            const href = image.closest('a')?.getAttribute('href')?.replace(/^\/+/, '').toLowerCase()
            if (href === channel) return image
            // Layouts that render the header avatar without a wrapping link:
            // fall back to the alt text, which carries the display name.
            if (!href && image.getAttribute('alt')?.toLowerCase() === channel) return image
        }
        return undefined
    }

    function getChannelAvatar(channel: string | null) {
        return channel ? findChannelAvatar(channel)?.src : undefined
    }

    function getStreamInfo() {
        const channel = getChannelName()
        // __INITIAL_STATE__ is embedded once in the initial HTML and never
        // updates on SPA navigation — only trust it when it matches the
        // current channel, otherwise read the page DOM (data-a-target hooks).
        const state = extractEmbeddedJson<InitialState>('__INITIAL_STATE__')
        const stream = state?.stream
        const matches = stream?.channel?.name?.toLowerCase() === channel
        const title = matches ? stream?.title ?? null : (document.querySelector('[data-a-target="stream-title"]')?.textContent?.trim() || null)
        const avatar = matches ? stream?.channel?.profileImageURL : getChannelAvatar(channel)
        const display = (matches ? stream?.channel?.displayName : undefined) ?? getDisplayName(channel) ?? channel
        const url = channel ? `https://www.twitch.tv/${channel}` : undefined
        return {
            channel: display,
            channel_url: url,
            title,
            thumbnail: channel ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-1920x1080.jpg` : undefined,
            avatar,
            url,
        }
    }
}
