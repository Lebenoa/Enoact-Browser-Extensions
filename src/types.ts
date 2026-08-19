type Config = {
    enabled: boolean;
    channel_info?: boolean;
    robust_info?: boolean;
    status_display_type?: number;
};

type Settings = {
    [site: string]: {
        script: string;
        config: Config;
    };
};

type SaveSettings = {
    [site: string]: {
        config: Config;
    };
};

type SidebarMessage =
    | { type: 'TOGGLE'; name: string }
    | { type: 'GET_SETTINGS'; site: string }
    | { type: 'UPDATE_SETTINGS'; name: string; settings: Config };
