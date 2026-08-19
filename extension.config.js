/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`
export default {
  browser: {
    chrome: {profile: profile('chrome')},
    chromium: {profile: profile('chromium')},
    edge: {profile: profile('edge')},
    firefox: {profile: profile('firefox')},
    'chromium-based': {profile: profile('chromium-based')},
    'gecko-based': {profile: profile('gecko-based')}
  },
  config: (cfg) => {
    // Prod build only emits manifest-referenced files. The injected site
    // scripts (scripts/youtube|music|twitch) are referenced at runtime by the
    // worker via chrome.scripting.executeScript but aren't in the manifest, so
    // declare them as explicit entries to force emission to scripts/<name>.js.
    cfg.entry = {
      ...(cfg.entry || {}),
      'scripts/youtube': './scripts/youtube.ts',
      'scripts/youtube-music': './scripts/youtube-music.ts',
      'scripts/twitch': './scripts/twitch.ts',
    }
    return cfg
  }
}
