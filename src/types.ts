import type { StatusDisplayType } from './activity';

export type Config = {
    enabled: boolean;
    channel_info?: boolean;
    status_display_type?: StatusDisplayType;
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
