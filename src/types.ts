import type { StatusDisplayType } from './activity';

// How a site script decides when to re-read the page.
export enum UpdateMode {
    // Re-read on a fixed timer. Predictable, works no matter how a site
    // updates itself, but does the work whether or not anything changed.
    Poll = 0,
    // Re-read when playback state actually changes (play/pause/seek/track
    // change). Idle while a video plays straight through, since Discord
    // extrapolates elapsed time from the timestamps it already has.
    Event = 1,
}

export type Config = {
    enabled: boolean;
    channel_info?: boolean;
    status_display_type?: StatusDisplayType;
    update_mode?: UpdateMode;
    update_interval?: number;
};

export type Settings = {
    [site: string]: {
        script: string;
        config: Config;
    };
};

export type SaveSettings = {
    [site: string]: {
        config: Config;
    };
};

// Sidebar -> background (over the "sidebar" port).
export type SidebarMessage =
    | { type: 'TOGGLE'; name: string }
    | { type: 'GET_SETTINGS'; site: string }
    | { type: 'UPDATE_SETTINGS'; name: string; settings: Config };

// Background -> sidebar (over the "sidebar" port).
export type BackgroundMessage =
    | { type: 'SETTINGS_LIST'; items: { name: string; enabled: boolean }[] }
    | { type: 'TOGGLE'; name: string; enabled: boolean }
    | { type: 'GET_SETTINGS'; site: string; settings: Config }
    | { type: 'SUCCESS'; message: string }
    | { type: 'ERROR'; message: string };
