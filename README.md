# Enoact Browser Extension

Browser extension for [Enoact Core](https://github.com/Lebenoa/Enoact).

## Site Supported

- www.youtube.com
- music.youtube.com
- www.twitch.tv

## Features

- Sidebar panel for settings
- Cross-browser support (Chrome, Firefox, Edge)

## Setup

```bash
bun install
bun run dev
```

## Build

```bash
bun install
bun run build --browser chrome,firefox          # All browsers
```

> Note: `bun run build --browser …` does not pass `--browser` through to `extension`; use `bun run build:chrome|firefox|edge` or `extension build --browser chrome`. Prod builds emit the injected site scripts (`scripts/*.js`) via entries declared in `extension.config.js` — keep those in sync with `defaultSettings` in `src/background.ts`.

## Permissions

- `sidePanel` - Sidebar UI
- `scripting` - Script injection
- `storage` - Settings persistence
- `webNavigation` - Navigation detection
