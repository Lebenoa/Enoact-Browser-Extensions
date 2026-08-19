// Extracts the JSON object literal assigned to a known variable inside a page
// <script> tag (e.g. ytInitialPlayerResponse, __INITIAL_STATE__).
// These are embedded once in the initial page HTML and do not update on SPA
// navigation — callers must fall back to fresher sources after navigation.

export function extractEmbeddedJson<T>(needle: string): T | undefined {
    for (const script of document.querySelectorAll('script')) {
        const text = script.textContent ?? ''
        const needleIndex = text.indexOf(needle)
        if (needleIndex === -1) continue
        const equalsIndex = text.indexOf('=', needleIndex + needle.length)
        if (equalsIndex === -1) continue

        let depth = 0
        let objectStart = -1
        let inString = false
        let escaped = false
        for (let i = equalsIndex + 1; i < text.length; i++) {
            const ch = text[i]
            if (inString) {
                if (escaped) escaped = false
                else if (ch === '\\') escaped = true
                else if (ch === '"') inString = false
                continue
            }
            if (ch === '"') {
                inString = true
            } else if (ch === '{') {
                if (depth === 0) objectStart = i
                depth++
            } else if (ch === '}') {
                depth--
                if (depth === 0 && objectStart !== -1) {
                    try {
                        return JSON.parse(text.slice(objectStart, i + 1)) as T
                    } catch {
                        break // malformed — keep scanning other scripts
                    }
                }
            }
        }
    }
    return undefined
}
