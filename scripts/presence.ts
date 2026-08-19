// Per-tab presence client: opens its own WebSocket to Enoact Core, so
// multiple tabs can show simultaneous activities — Discord displays one
// activity per distinct `name` (e.g. YouTube + Twitch at the same time).
//
// SET/CLEAR is sent only when the activity payload actually changes; the
// current payload is re-sent after (re)connecting, since the server may
// have lost state.

import type { Activity } from '../src/activity'

export type PresenceActivity = Activity

const CORE_URL = 'ws://127.0.0.1:5579/ws'
const MAX_RECONNECT_DELAY = 30000

// getDelay is read each time the timer is armed rather than captured once, so
// a config change takes effect on the next restart() instead of at reload.
export function createPresenceClient(getActivity: () => PresenceActivity | null, getDelay: () => number) {
    let socket: WebSocket | undefined
    let interval: ReturnType<typeof setInterval> | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempts = 0
    let stopped = false
    let lastPayload: string | undefined

    function update() {
        if (socket?.readyState !== WebSocket.OPEN) return
        const activity = getActivity()
        const payload = JSON.stringify(activity == null ? { action: 'CLEAR' } : { action: 'SET', activity })
        if (payload === lastPayload) return
        lastPayload = payload
        socket.send(payload)
    }

    function connect() {
        if (stopped || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

        const ws = new WebSocket(CORE_URL)
        socket = ws
        ws.addEventListener('open', () => {
            if (socket !== ws) return
            reconnectAttempts = 0
            lastPayload = undefined // server may have lost state — re-send current activity
            armTimer()
            update()
        })
        ws.addEventListener('error', () => ws.close())
        ws.addEventListener('close', () => {
            // Ignore events from superseded sockets (a restart() may have
            // replaced this one while its close event was still queued).
            if (socket !== ws) return
            socket = undefined
            if (interval) {
                clearInterval(interval)
                interval = undefined
            }
            scheduleReconnect()
        })
    }

    function armTimer() {
        if (interval) clearInterval(interval)
        interval = setInterval(update, getDelay())
    }

    function scheduleReconnect() {
        if (stopped || retryTimer) return
        const delay = Math.min(2000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY)
        reconnectAttempts++
        retryTimer = setTimeout(() => {
            retryTimer = undefined
            connect()
        }, delay)
    }

    // Reset the change-detection and push immediately — used after SPA
    // navigation or when the config changes (e.g. site toggled off).
    function restart() {
        lastPayload = undefined
        connect()
        // Pick up a changed update interval; connect() only arms the timer when
        // it actually opens a socket, so an already-open one would keep the old.
        if (interval) armTimer()
        update()
    }

    function stop() {
        stopped = true
        if (retryTimer) {
            clearTimeout(retryTimer)
            retryTimer = undefined
        }
        if (interval) {
            clearInterval(interval)
            interval = undefined
        }
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'CLEAR' }))
        }
        socket?.close()
        socket = undefined
    }

    connect()
    return { restart, stop }
}
