# Enoact Browser Extension

**Show what you're doing to others!**

Browser Extension for [Enoact Core](https://github.com/Lebenoa/Enoact)

## Features

- **YouTube Support**: Track what you're watching, including:
  - Video title and URL
  - Current playback time and duration
  - Channel name and thumbnail
  - Live stream detection
  - Video thumbnail

- **YouTube Music Support**: Track what you're listening to, including:
  - Song title and URL
  - Artist name and profile URL
  - Artist thumbnail
  - Current playback time and duration
  - Play/pause state detection

- **Real-time Updates**: Activity updates are sent every 3 seconds via WebSocket
- **Automatic Reconnection**: Automatically reconnects if the WebSocket connection drops (up to 5 attempts)
- **Multi-browser Support**: Available for both Chrome (Manifest V3) and Firefox (Manifest V2)

## How It Works

The extension runs content scripts on YouTube and YouTube Music pages that:

1. Extract video/music information from the DOM
2. Connect to a local WebSocket server at `ws://127.0.0.1:5579/ws`
3. Send activity updates in a standardized format
4. Automatically clear activity when you leave the watch/player page
5. Gracefully handle disconnections and reconnect

### Activity Format

The extension sends activity data in the following JSON format:

```json
{
  "action": "SET",
  "activity": {
    "name": "YouTube",
    "type": 3,
    "status_display_type": 2,
    "details": "Video Title",
    "details_url": "https://youtu.be/...",
    "state": "Channel Name",
    "state_url": "https://www.youtube.com/...",
    "assets": {
      "large_image": "thumbnail_url",
      "large_text": "Video Title",
      "large_url": "https://youtu.be/...",
      "small_image": "channel_thumbnail_url",
      "small_text": "Channel Name",
      "small_url": "https://www.youtube.com/..."
    },
    "timestamps": {
      "start": 1234567890,
      "end": 1234567999
    }
  }
}
```

When you navigate away from a video/music page, a CLEAR action is sent:

```json
{
  "action": "CLEAR"
}
```

## Installation

### Prerequisites

- [Enoact Core](https://github.com/Lebenoa/Enoact) running

### Building

The project uses a Nix build script (`build.nu`) to compile and package the extension for both Chrome and Firefox.

```bash
# Build both Chrome and Firefox versions
nu build.nu
```

This will create:
- `dist/chrome/` - Chrome extension (Manifest V3)
- `dist/firefox/` - Firefox extension (Manifest V2)

The build process:
1. Compiles TypeScript files to JavaScript
2. Minifies the output using Bun
3. Copies the appropriate manifest file
4. Generates ready-to-install extension packages

### Manual Installation

#### Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/chrome/` directory

#### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from `dist/firefox/`

## Project Structure

```
enoact/
├── src/
│   ├── manifest.v2.json        # Firefox manifest (Manifest V2)
│   ├── manifest.v3.json        # Chrome manifest (Manifest V3)
│   └── shared/
│       ├── youtube.ts          # YouTube content script
│       └── youtube-music.ts    # YouTube Music content script
├── dist/                       # Built extensions (generated)
├── build.nu                    # Build script (Nix)
├── LICENSE                     # Apache 2.0 license
└── README.md                   # This file
```

## Configuration

The extension connects to a hardcoded WebSocket server at `ws://127.0.0.1:5579/ws`. To change this:

1. Edit `src/shared/youtube.ts` or `src/shared/youtube-music.ts`
2. Change the `WebSocket` URL in the `connectWebSocket()` function
3. Rebuild the extension

### Constants

Both scripts have configurable constants:

- `UPDATE_DELAY` (3000ms): How often to send activity updates
- `RECONNECT_DELAY` (2000ms): Time to wait between reconnection attempts
- `MAX_RECONNECT_ATTEMPTS` (5): Maximum number of reconnection attempts

## Development

### Prerequisites

- Bun
- **OPTIONAL**: Nushell (for running the build script)

### Editing Content Scripts

Edit the TypeScript files in `src/shared/`:
- `youtube.ts` - YouTube content script
- `youtube-music.ts` - YouTube Music content script

### Building During Development

```bash
nu build.nu
```

After building, reload the extension in your browser's extension manager.

## Permissions

### Chrome (Manifest V3)
- `scripting`: Required to inject content scripts
- `tabs`: Required to track active tab information (unused for now)
- Host permissions for YouTube and YouTube Music

### Firefox (Manifest V2)
- `tabs`: Required to track active tab information (unused for now)
- Content scripts for YouTube and YouTube Music

## Troubleshooting

### Extension not connecting

1. **Check the WebSocket server**: Ensure `Enoact Core` or your WebSocket server is running on `ws://127.0.0.1:5579/ws`
2. **Check browser console**: Open the browser's developer tools on a YouTube/YouTube Music page and check for errors
3. **Verify permissions**: Make sure the extension has the correct permissions

### No activity being sent

1. **On YouTube**: Make sure you're on the watch page (URL contains `/watch?v=...`)
2. **On YouTube Music**: Make sure a song is currently playing
3. **Check WebSocket connection**: The extension will log connection errors to the browser console

### WebSocket connection drops

The extension automatically attempts to reconnect up to 5 times with a 2-second delay between attempts. If it continues to fail:
1. Check your WebSocket server logs
2. Verify the server is still running
3. Check browser console for specific error messages

## License

Licensed under the Apache License, Version 2.0. See `LICENSE` file for details.

## Contributing

Contributions are welcome! Feel free to:
- Report bugs and request features via issues
- Submit pull requests with improvements
- Improve documentation

## Future Enhancements

Potential improvements for future versions:
- Support for additional platforms (Spotify, Twitch, etc.)
- Configuration UI for WebSocket server address
- Local storage of activity history
- Support for more activity metadata
- Better error handling and user feedback
