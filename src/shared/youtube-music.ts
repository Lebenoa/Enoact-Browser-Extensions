function initYouTubeMusic() {
    let websocketConnection: WebSocket | undefined;
    let updateInterval: number | undefined;
    let isCleared: boolean;
    let reconnectAttempts = 0;

    const UPDATE_DELAY = 3000;
    const RECONNECT_DELAY = 2000;
    const MAX_RECONNECT_ATTEMPTS = 5;

    function connectWebSocket() {
        if (websocketConnection && websocketConnection.readyState === WebSocket.OPEN) {
            return;
        }

        websocketConnection = new WebSocket("ws://127.0.0.1:5579/ws");
        websocketConnection.addEventListener("error", (e) => {
            console.error("WebSocket connection error", e)
            websocketConnection = undefined;
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = undefined;
            }
            attemptReconnect();
        })
        websocketConnection.addEventListener("close", (e) => {
            console.log("WebSocket connection closed: ", e)
            websocketConnection = undefined;
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = undefined;
            }
            attemptReconnect();
        })
        websocketConnection.addEventListener("message", (evt) => {
            // Debug message
            console.log(evt.data)
        });
        websocketConnection.addEventListener("open", () => {
            reconnectAttempts = 0;
            updateInterval = setInterval(() => {
                const info = getTrackInfo();

                // Only send if music is playing
                if (!info.title || !info.isPlaying) {
                    if (!isCleared) {
                        websocketConnection!.send(JSON.stringify({ action: "CLEAR" }));
                        isCleared = true;
                    }
                    return;
                }

                const now = Date.now();
                const body =
                    JSON.stringify({
                        action: "SET",
                        activity: {
                            name: "YouTube Music",
                            type: 2,
                            status_display_type: 2,
                            details: info.title,
                            details_url: info.url,
                            state: info.artist ? info.artist : "<BLANK>",
                            state_url: info.artist_url,
                            assets: {
                                large_image: info.thumbnail,
                                large_url: info.url,
                            },
                            timestamps: {
                                start: Math.round(now - (info.current_time * 1000)),
                                end: Math.round(now + ((info.duration - info.current_time) * 1000)),
                            }
                        }
                    });
                websocketConnection!.send(body);
                isCleared = false;
            }, UPDATE_DELAY);
        })
    }

    function attemptReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            return;
        }
        reconnectAttempts++;
        setTimeout(() => {
            connectWebSocket();
        }, RECONNECT_DELAY);
    }

    function handleNavigation() {
        connectWebSocket();
    }

    window.addEventListener('yt-navigate-finish', handleNavigation);

    connectWebSocket();


    function getTrackId(): string | null {
        const shareUrl = document.querySelector("yt-copy-link-renderer > div[id='bar'] > input[id='share-url']") as HTMLInputElement | null;
        const url = shareUrl?.value;
        const id = new URLSearchParams(url);
        return id.get('v');
    }

    function getIsPlaying() {
        const playButton = document.querySelector("yt-icon-button[id='play-pause-button'][title]") as HTMLButtonElement | null;
        return playButton?.getAttribute("title") === "Pause";
    }

    function getTrackInfo() {
        const id = getTrackId();

        // Get title from now playing bar
        const titleElem = document.querySelector("div[class~='ytmusic-player-bar'] > yt-formatted-string[class~='title'][title]") as HTMLElement | null;
        const title = titleElem?.innerText;

        // Get artist info
        const artistElem = document.querySelector("yt-formatted-string[class~='ytmusic-player-bar'][class~='complex-string'][title]");
        const artist = artistElem?.getAttribute("title");
        const artist_url = "https://music.youtube.com/" + artistElem?.children[0]?.getAttribute("href");

        // Get artist thumbnail - usually shown in the player
        const thumbnailElem = document.querySelector("div.thumbnail-image-wrapper.ytmusic-player-bar > img[src]") as HTMLImageElement | null;
        const thumbnail = thumbnailElem?.src;

        const audio = document.querySelector("tp-yt-paper-slider[id='progress-bar'][value][aria-valuemax]") as HTMLAudioElement | null;
        const duration = parseInt(audio?.getAttribute("aria-valuemax") || "0");
        const current_time = parseInt(audio?.getAttribute("value") || "0");
        const isPlaying = getIsPlaying();

        return {
            title,
            thumbnail,
            url: id ? `https://music.youtube.com/watch/${id}` : undefined,
            artist,
            artist_url: artist_url || undefined,
            duration,
            current_time,
            isPlaying,
        };
    }
}

initYouTubeMusic();
