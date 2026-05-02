# Enoact Browser Extension

Browser extension for [Enoact Core](https://github.com/Lebenoa/Enoact).

## Site Supported

- www.youtube.com
- music.youtube.com

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
bun run build --browser chrome,firefox          # All browsers
```

## Permissions

- `sidePanel` - Sidebar UI
- `scripting` - Script injection
- `storage` - Settings persistence
- `webNavigation` - Navigation detection
