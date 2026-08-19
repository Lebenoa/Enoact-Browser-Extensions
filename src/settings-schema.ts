// Single source of truth for which settings each site has, what they default
// to, and how the sidebar renders them. The background worker builds its
// defaults from this, the site scripts validate incoming config against it,
// and the sidebar form is generated from it — so a setting exists in all three
// places or none, and the form no longer depends on which keys a stored config
// happens to contain.

import { StatusDisplayType } from './activity';
import { UpdateMode, type Config } from './types';

export type FieldOption = { value: number; label: string };

type FieldBase = {
    key: keyof Config;
    label: string;
    description?: string;
    // Hide this field unless the named setting is on (or, with dependsValue,
    // equal to that value). Chains: a field whose parent is itself hidden is
    // hidden too — see isFieldVisible.
    dependsOn?: keyof Config;
    dependsValue?: number | boolean;
};

export type SettingsField =
    | (FieldBase & { type: 'boolean'; default: boolean })
    | (FieldBase & { type: 'select'; default: number; options: FieldOption[] })
    | (FieldBase & { type: 'number'; default: number; min: number; max: number; step: number; unit?: string });

export type SiteSchema = {
    // Human-facing name; the record key stays the matched hostname.
    label: string;
    script: string;
    fields: SettingsField[];
};

export const STATUS_DISPLAY_OPTIONS: FieldOption[] = [
    { value: StatusDisplayType.Name, label: 'Name — the site name' },
    { value: StatusDisplayType.State, label: 'State — the channel or artist' },
    { value: StatusDisplayType.Details, label: 'Details — the video or track title' },
];

const enabledField: SettingsField = {
    key: 'enabled',
    type: 'boolean',
    label: 'Enabled',
    description: 'Disable/enable the extension on this site',
    default: true,
};

export const UPDATE_MODE_OPTIONS: FieldOption[] = [
    { value: UpdateMode.Poll, label: 'Poll — re-read on a timer' },
    { value: UpdateMode.Event, label: 'Events — re-read when playback changes' },
];

const updateModeField: SettingsField = {
    key: 'update_mode',
    type: 'select',
    label: 'Update Mode',
    description: 'Events react instantly and idle while a video plays; polling is steadier on sites that update quietly',
    default: UpdateMode.Event,
    options: UPDATE_MODE_OPTIONS,
    dependsOn: 'enabled',
};

// How often the presence client re-reads the page and pushes an update. Too
// low burns CPU on every open tab for no visible gain — Discord itself is not
// that responsive; too high makes seeking feel laggy in the status.
const updateIntervalField: SettingsField = {
    key: 'update_interval',
    type: 'number',
    label: 'Update Interval',
    description: 'How often this site reports what you are watching, in milliseconds',
    default: 5000,
    min: 1000,
    max: 60000,
    step: 500,
    unit: 'ms',
    // Meaningless in event mode, so it only shows while polling.
    dependsOn: 'update_mode',
    dependsValue: UpdateMode.Poll,
};

function statusDisplayField(fallback: StatusDisplayType): SettingsField {
    return {
        key: 'status_display_type',
        type: 'select',
        label: 'Status Display Type',
        description: 'Which line Discord shows next to your name in the member list',
        default: fallback,
        options: STATUS_DISPLAY_OPTIONS,
        dependsOn: 'enabled',
    };
}

export const SITE_SCHEMAS: Record<string, SiteSchema> = {
    'www.youtube.com': {
        label: 'YouTube',
        script: './scripts/youtube.js',
        fields: [
            enabledField,
            {
                key: 'channel_info',
                type: 'boolean',
                label: 'Channel Info',
                description: 'Display channel icon on the small image',
                default: true,
                dependsOn: 'enabled',
            },
            statusDisplayField(StatusDisplayType.Details),
            updateModeField,
            updateIntervalField,
        ],
    },
    'music.youtube.com': {
        label: 'YouTube Music',
        script: './scripts/youtube-music.js',
        fields: [enabledField, statusDisplayField(StatusDisplayType.Details), updateModeField, updateIntervalField],
    },
    'www.twitch.tv': {
        label: 'Twitch',
        script: './scripts/twitch.js',
        fields: [enabledField, statusDisplayField(StatusDisplayType.State), updateModeField, updateIntervalField],
    },
};

export function fieldsFor(site: string): SettingsField[] {
    return SITE_SCHEMAS[site]?.fields ?? [];
}

// Visibility walks the whole dependency chain: a field is hidden when its
// parent is hidden, not only when the parent's value fails the test. Without
// that, disabling a site would leave the update interval on screen because
// update_mode — the field it depends on — is itself only hidden, not unset.
export function isFieldVisible(site: string, config: Config, field: SettingsField): boolean {
    const seen = new Set<string>();
    let current: SettingsField | undefined = field;

    while (current?.dependsOn) {
        if (seen.has(current.key)) return true; // cyclic schema — show rather than vanish
        seen.add(current.key);

        const value = (config as Record<string, unknown>)[current.dependsOn];
        const passes = current.dependsValue === undefined ? Boolean(value) : value === current.dependsValue;
        if (!passes) return false;

        const parentKey: string = current.dependsOn;
        current = fieldsFor(site).find((candidate) => candidate.key === parentKey);
    }

    return true;
}

export function labelFor(site: string): string {
    return SITE_SCHEMAS[site]?.label ?? site;
}

export function defaultConfigFor(site: string): Config {
    return coerceConfig(site, undefined);
}

// Builds a config containing exactly the site's known keys: a stored value is
// kept only when it still matches the field's type (and, for a select, is still
// one of the offered values), otherwise the default wins. Unknown keys are
// dropped, which is what retires a removed setting — no per-key migration.
export function coerceConfig(site: string, stored: unknown): Config {
    const raw = (stored ?? {}) as Record<string, unknown>;
    const config: Record<string, unknown> = {};

    for (const field of fieldsFor(site)) {
        const value = raw[field.key];
        if (field.type === 'boolean') {
            config[field.key] = typeof value === 'boolean' ? value : field.default;
        } else if (field.type === 'number') {
            // Clamp rather than reject: a stored value just outside the range
            // still expresses the user's intent.
            const usable = typeof value === 'number' && Number.isFinite(value);
            config[field.key] = usable ? Math.min(field.max, Math.max(field.min, value)) : field.default;
        } else {
            const known = field.options.some((option) => option.value === value);
            config[field.key] = known ? value : field.default;
        }
    }

    return config as Config;
}
