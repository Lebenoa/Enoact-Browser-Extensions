export type PresenceActivity = Record<string, unknown>

export function createPresenceClient(getActivity: () => PresenceActivity | null) {
    let socket: WebSocket | undefined
    let interval: ReturnType<typeof setInterval> | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempts = 0
    let cleared = true
    let stopped = false

    const updateDelay = 3000
    const maxReconnectDelay = 30000

    function clearPresence() {
        if (socket?.readyState === WebSocket.OPEN && !cleared) {
            socket.send(JSON.stringify({ action: 'CLEAR' }))
            cleared = true
        }
    }

    function scheduleReconnect() {
        if (stopped || retryTimer) return
        const delay = Math.min(2000 * 2 ** reconnectAttempts, maxReconnectDelay)
        reconnectAttempts++
        retryTimer = setTimeout(() => {
            retryTimer = undefined
            connect()
        }, delay)
    }

    function connect() {
        if (stopped || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

        socket = new WebSocket('ws://127.0.0.1:5579/ws')
        socket.addEventListener('open', () => {
            reconnectAttempts = 0
            if (interval) clearInterval(interval)
            interval = setInterval(update, updateDelay)
            update()
        })
        socket.addEventListener('error', () => socket?.close())
        socket.addEventListener('close', () => {
            socket = undefined
            if (interval) {
                clearInterval(interval)
                interval = undefined
            }
            scheduleReconnect()
        })
    }

    function update() {
        if (socket?.readyState !== WebSocket.OPEN) return
        const activity = getActivity()
        if (!activity) {
            clearPresence()
            return
        }
        socket.send(JSON.stringify({ action: 'SET', activity }))
        cleared = false
    }

    function restart() {
        clearPresence()
        connect()
    }

    function stop() {
        stopped = true
        if (retryTimer) clearTimeout(retryTimer)
        if (interval) clearInterval(interval)
        clearPresence()
        socket?.close()
    }

    connect()
    return { restart, stop }
}
