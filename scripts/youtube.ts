export default function initYouTube() {
    type ChannelInfo = {
        channel?: string;
        channel_url?: string;
        channel_thumbnail?: string;
    };

    let websocketConnection: WebSocket | undefined;
    let updateInterval: number | NodeJS.Timeout | undefined;
    let isCleared: boolean;
    let config: Record<string, any>;
    let cached: ChannelInfo = {};
    let reconnectAttempts = 0;

    const HOME_PAGE = "/";
    const WATCH_PAGE = "/watch";
    const RESULT_PAGE = "/results";
    const UPDATE_DELAY = 3000;
    const RECONNECT_DELAY = 2000;
    const MAX_RECONNECT_ATTEMPTS = 5;

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type == "CONFIG") {
            config = message.config;
        }
    });

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
            console.log("WebSocket connection close: ", e)
            websocketConnection = undefined;
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = undefined;
            }
            attemptReconnect();
        })
        websocketConnection.addEventListener("open", () => {
            reconnectAttempts = 0;
            updateInterval = setInterval(() => {
                const currentPage = window.location.pathname;
                if (currentPage != WATCH_PAGE) {
                    if (!isCleared) {
                        websocketConnection!.send(JSON.stringify({ action: "CLEAR" }));
                        isCleared = true;
                    }
                    return;
                }

                const info = getVideoInfo();
                const now = Date.now();
                const body =
                    JSON.stringify({
                        action: "SET",
                        activity: {
                            name: "YouTube",
                            type: 3,
                            status_display_type: 2,
                            details: info.title,
                            details_url: info.url,
                            state: info.channel ? info.channel : "<BLANK>",
                            state_url: info.channel_url,
                            assets: {
                                large_image: info.thumbnail,
                                large_text: info.title,
                                large_url: info.url,
                                small_image: info.channel_thumbnail ? info.channel_thumbnail : undefined,
                                small_text: info.channel ? info.channel : "<BLANK>",
                                small_url: info.channel_url,
                            },
                            timestamps: {
                                start: Math.round(now - (info.current_time * 1000)),
                                end: info.isLive ? undefined : Math.round(now + ((info.duration - info.current_time) * 1000)),
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
        cached = {};
    }

    window.addEventListener('yt-navigate-finish', handleNavigation);

    connectWebSocket();


    function getVideoId(): string {
        return new URLSearchParams(window.location.search).get("v")!!;
    }

    function getThumbnail(videoId: string) {
        return `https://i3.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    function getIsLiveStreaming() {
        const teaserCarousel = document.querySelector("div#teaser-carousel div h2") as HTMLHeadingElement | null;
        if (!teaserCarousel) {
            return false;
        }

        const text = teaserCarousel.innerText.toLowerCase();
        if (text == "live chat") {
            return true;
        }

        return false;
    }



    function getChannelInfo(): ChannelInfo {
        let channelElem =
            document.querySelector('div#text-container.ytd-channel-name a[href]') as HTMLAnchorElement | null;

        if (channelElem) {
            let channel = channelElem.innerText;
            const channel_url = channelElem.href;
            const channel_img = document.querySelector("#owner yt-img-shadow#avatar img") as HTMLImageElement | null;
            const channel_thumbnail = channel_img?.src;
            return {
                channel,
                channel_url,
                channel_thumbnail,
            };
        }

        channelElem = document.querySelector("div[id='upload-info'] yt-attributed-string[id='attributed-channel-name'] a") as HTMLAnchorElement | null;
        if (channelElem) {
            if (config?.robust_info) {
                if (!cached.channel || !cached.channel_thumbnail) {
                    channelElem.click();
                }

                const listItems = document.querySelectorAll("ytd-popup-container yt-list-item-view-model");
                if (!cached.channel) {
                    for (let i = 0; i < listItems.length; i++) {
                        const item = listItems[i];
                        const channelName = item.querySelector("a[class~='ytAttributedStringLink'][href]") as HTMLAnchorElement | null;
                        if (channelName) {
                            switch (i) {
                                case 0:
                                    cached.channel = channelName.innerText;
                                    break;
                                case listItems.length - 1:
                                    cached.channel += " and " + channelName.innerText;
                                    break;
                                default:
                                    cached.channel += ", " + channelName.innerText;
                                    break;
                            }
                        }
                    }
                }

                if (!cached.channel_thumbnail) {
                    const firstItem = listItems.item(0);
                    if (firstItem) {
                        const channel_img = firstItem.querySelector("avatar-view-model img") as HTMLImageElement | null;
                        if (channel_img) {
                            cached.channel_thumbnail = channel_img.src;
                        }
                    }
                }

                const closeOverlayInterval = setInterval(() => {
                    const overlayBackdrop = document.querySelector("tp-yt-iron-overlay-backdrop[opened]");
                    if (overlayBackdrop) {
                        // @ts-ignore
                        overlayBackdrop.click();
                        clearInterval(closeOverlayInterval);
                    }
                }, 100);

                return {
                    channel: cached.channel,
                    channel_thumbnail: cached.channel_thumbnail,
                }
            } else {
                const channel = document.querySelector("div[id='upload-info'] yt-attributed-string[id='attributed-channel-name'] a[href]") as HTMLAnchorElement | null;
                const channel_img = document.querySelector("div[id='avatar-stack'] div[class='ytAvatarStackViewModelAvatars'] > div > div:last-child avatar-view-model img") as HTMLImageElement | null;
                const channel_thumbnail = channel_img?.src;
                return {
                    channel: channel?.innerText,
                    channel_thumbnail,
                };
            }
        }

        return {};
    }

    function getVideoInfo() {
        const id = getVideoId();
        const video = document.querySelector("video");
        const title = (document.querySelector("h1.title yt-formatted-string") as HTMLHeadingElement | null)?.innerText;
        const thumbnail = getThumbnail(id);


        let channelInfo = getChannelInfo();

        const duration = video?.duration || 0;
        const current_time = video?.currentTime || 0;
        const isLive = getIsLiveStreaming();

        return {
            title,
            thumbnail,
            url: `https://youtu.be/${id}`,
            duration,
            current_time,
            isLive,
            ...channelInfo,
        };
    }
}
