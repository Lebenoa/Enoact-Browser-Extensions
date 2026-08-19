const isFirefoxLike =
    import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
    import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

// Extension.js provides browser-specific globals, but its union type cannot
// express Chromium-only and Firefox-only APIs together.
export const api: any = isFirefoxLike ? browser : chrome
export { isFirefoxLike }
