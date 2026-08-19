<script lang="ts">
    import Checkbox from './Checkbox.svelte';
    import iconUrl from '../images/icon.png';
    import { fade } from 'svelte/transition';
    import { StatusDisplayType } from '../activity';
    import type { BackgroundMessage, Config, SidebarMessage } from '../types';

    type SettingsInfo = {
        rename?: string;
        description?: string;
        type?: 'boolean' | 'string' | 'select';
        options?: { value: number; label: string }[];
        dependsOn?: string;
    };

    const logo = iconUrl;
    const STATUS_DISPLAY_OPTIONS = [
        { value: StatusDisplayType.Name, label: 'Name — the site name' },
        { value: StatusDisplayType.State, label: 'State — the channel or artist' },
        { value: StatusDisplayType.Details, label: 'Details — the video or track title' },
    ];
    const SETTINGS_INFO: Record<string, SettingsInfo> = {
        enabled: { rename: 'Enabled', description: 'Disable/enable the extension on this site', type: 'boolean' },
        channel_info: { rename: 'Channel Info', description: 'Display channel icon on the small image', type: 'boolean' },
        status_display_type: {
            rename: 'Status Display Type',
            description: 'Which line Discord shows next to your name in the member list',
            type: 'select',
            options: STATUS_DISPLAY_OPTIONS,
        },
    };
    const buttonClass = 'px-4 py-2 border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors duration-300 cursor-pointer';

    // The form edits a Config as a loose record so unknown keys still render.
    type EditableConfig = Record<string, boolean | number | string | undefined>;

    let port: chrome.runtime.Port;
    let currentTab = $state('');
    let sitesAvailable: { name: string; enabled: boolean }[] = $state([]);
    let settings: EditableConfig | undefined = $state(undefined);

    function connect() {
        port = chrome.runtime.connect({ name: 'sidebar' });
        port.onMessage.addListener(handleMessage);
        port.onDisconnect.addListener(() => {
            setTimeout(connect, 100);
        });
        // The worker can sleep between the request and its reply, dropping the
        // port; re-ask on reconnect so the editor doesn't sit on "Loading.."
        // forever.
        if (currentTab !== '') retrieveSettingsFor(currentTab);
    }

    function handleMessage(message: BackgroundMessage) {
        switch (message.type) {
            case 'SETTINGS_LIST':
                sitesAvailable = message.items;
                break;
            case 'TOGGLE':
                sitesAvailable = sitesAvailable.map((site) =>
                    site.name === message.name ? { ...site, enabled: message.enabled } : site,
                );
                break;
            case 'GET_SETTINGS':
                settings = message.settings;
                break;
            case 'SUCCESS':
            case 'ERROR':
                alert(message.message);
                break;
        }
    }

    connect();

    function retrieveSettingsFor(site: string) {
        const message: SidebarMessage = { type: 'GET_SETTINGS', site };
        port.postMessage(message);
    }

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        const message: SidebarMessage = { type: 'UPDATE_SETTINGS', name: currentTab, settings: settings as Config };
        port.postMessage(message);
    }
</script>

{#key currentTab}
    <div class="h-full w-full" in:fade>
        {#if currentTab === ''}
            <div class="flex flex-col items-center justify-center gap-2">
                <img class="w-full h-full" src={logo} alt="The Enoact Logo" />
                <h1 class="font-bold text-2xl">Settings</h1>
                {#each sitesAvailable as { name, enabled }}
                    <div class="flex flex-row justify-between items-center mx-2 w-full text-xl">
                        <span>{name}</span>
                        <div class="flex flex-row">
                            <button class={buttonClass} onclick={() => port.postMessage({ type: 'TOGGLE', name })}>
                                {enabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button class={buttonClass} onclick={() => { currentTab = name; retrieveSettingsFor(name); }}>
                                Edit
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <button class="hover:underline px-4 py-2 absolute top-2 left-2 transition-all duration-300 cursor-pointer text-xl font-bold" onclick={() => { currentTab = ''; settings = undefined; }}>
                Back
            </button>
            {#if settings === undefined}
                <h2 class="font-bold text-xl">Loading..</h2>
            {:else}
                <div class="flex flex-col items-center justify-center gap-2">
                    <h1 class="font-bold text-4xl">{currentTab}</h1>
                    <form class="flex w-full h-full flex-col items-center justify-center gap-2" onsubmit={handleSubmit}>
                        {#each Object.entries(settings) as [key, value]}
                            {@const info = SETTINGS_INFO[key]}
                            {@const boolSettings = settings as Record<string, boolean>}
                            {@const numSettings = settings as Record<string, number>}
                            {#if !info?.dependsOn || settings[info.dependsOn]}
                                <label class="flex flex-col w-full" transition:fade>
                                    <span class="font-bold text-lg">{info?.rename ?? key}</span>
                                    {#if info?.description}<span>{info.description}</span>{/if}
                                    {#if info?.type === 'boolean'}
                                        <Checkbox label={String(value)} bind:checked={boolSettings[key]} />
                                    {:else if info?.type === 'select' && info.options}
                                        <select class="px-4 py-2 border border-gray-300" bind:value={numSettings[key]}>
                                            {#each info.options as option}
                                                <option value={option.value}>{option.label}</option>
                                            {/each}
                                        </select>
                                    {:else}
                                        <input class="px-4 py-2 border border-gray-300" type="text" value={value ?? ''} onchange={(e) => {
                                            const input = e.currentTarget as HTMLInputElement;
                                            settings![key] = typeof value === 'number' ? Number(input.value) : input.value;
                                        }} />
                                    {/if}
                                </label>
                            {/if}
                        {/each}
                        <button class="px-4 py-2 bg-green text-black cursor-pointer text-xl">Save</button>
                    </form>
                </div>
            {/if}
        {/if}
    </div>
{/key}
