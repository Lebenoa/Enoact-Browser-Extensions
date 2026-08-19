// Single source of truth for which settings each site has, what they default
// to, and how the sidebar renders them. The background worker builds its
// defaults from this, the site scripts validate incoming config against it,
// and the sidebar form is generated from it — so a setting exists in all three
// places or none, and the form no longer depends on which keys a stored config
// happens to contain.

import { StatusDisplayType } from './activity';
import type { Config } from './types';

export type FieldOption = { value: number; label: string };

type FieldBase = {
    key: keyof Config;
    label: string;
    description?: string;
    // Hide this field while the named boolean setting is off.
    dependsOn?: keyof Config;
};

export type SettingsField =
    | (FieldBase & { type: 'boolean'; default: boolean })
    | (FieldBase & { type: 'select'; default: number; options: FieldOption[] });

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
        ],
    },
    'music.youtube.com': {
        label: 'YouTube Music',
        script: './scripts/youtube-music.js',
        fields: [enabledField, statusDisplayField(StatusDisplayType.Details)],
    },
    'www.twitch.tv': {
        label: 'Twitch',
        script: './scripts/twitch.js',
        fields: [enabledField, statusDisplayField(StatusDisplayType.State)],
    },
};

export function fieldsFor(site: string): SettingsField[] {
    return SITE_SCHEMAS[site]?.fields ?? [];
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
        } else {
            const known = field.options.some((option) => option.value === value);
            config[field.key] = known ? value : field.default;
        }
    }

    return config as Config;
}
