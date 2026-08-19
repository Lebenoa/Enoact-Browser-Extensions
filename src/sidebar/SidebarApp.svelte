<script lang="ts">
    import Checkbox from './Checkbox.svelte';
    import iconUrl from '../images/icon.png';
    import { fade } from 'svelte/transition';
    import { coerceConfig, fieldsFor } from '../settings-schema';
    import type { BackgroundMessage, Config, SidebarMessage } from '../types';

    // The worker can sleep or die mid-request; without a deadline the panel
    // would wait on a reply that is never coming.
    const REQUEST_TIMEOUT = 5000;

    const logo = iconUrl;
    const buttonClass = 'px-4 py-2 border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors duration-300 cursor-pointer';

    type Status = 'loading' | 'ready' | 'saving' | 'error';

    let port: chrome.runtime.Port | undefined;
    let currentTab = $state('');
    let sitesAvailable: { name: string; enabled: boolean }[] = $state([]);
    // The form edits a copy; nothing is stored until Save round-trips.
    let draft: Config | undefined = $state(undefined);
    let status: Status = $state('loading');
    let notice = $state('');
    let deadline: ReturnType<typeof setTimeout> | undefined;

    const fields = $derived(fieldsFor(currentTab));

    function connect() {
        port = chrome.runtime.connect({ name: 'sidebar' });
        port.onMessage.addListener(handleMessage);
        port.onDisconnect.addListener(() => {
            port = undefined;
            setTimeout(connect, 100);
        });
        // A reconnect means the previous request died with the old port.
        if (currentTab !== '') requestSettings(currentTab);
    }

    function send(message: SidebarMessage): boolean {
        try {
            port?.postMessage(message);
            return port !== undefined;
        } catch {
            return false; // port died between the check and the post
        }
    }

    function awaitReply(pending: Status, message: string) {
        status = pending;
        notice = '';
        if (deadline) clearTimeout(deadline);
        deadline = setTimeout(() => {
            if (status !== pending) return;
            status = 'error';
            notice = message;
        }, REQUEST_TIMEOUT);
    }

    function settle(next: Status, message = '') {
        if (deadline) clearTimeout(deadline);
        deadline = undefined;
        status = next;
        notice = message;
    }

    function requestSettings(site: string) {
        awaitReply('loading', 'The extension worker did not respond.');
        if (!send({ type: 'GET_SETTINGS', site })) settle('error', 'Lost the connection to the extension.');
    }

    function openSite(site: string) {
        currentTab = site;
        draft = undefined;
        requestSettings(site);
    }

    function closeSite() {
        currentTab = '';
        draft = undefined;
        settle('ready');
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
                if (currentTab === message.name && draft) draft = { ...draft, enabled: message.enabled };
                break;
            case 'GET_SETTINGS':
                // A reply for a site the user already navigated away from is stale.
                if (message.site !== currentTab) break;
                draft = coerceConfig(message.site, message.settings);
                // The list shows the same enabled flag the editor just loaded.
                sitesAvailable = sitesAvailable.map((site) =>
                    site.name === message.site ? { ...site, enabled: message.settings.enabled } : site,
                );
                if (status === 'loading') settle('ready');
                break;
            case 'SUCCESS':
                settle('ready', message.message);
                break;
            case 'ERROR':
                settle('error', message.message);
                break;
        }
    }

    connect();

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (!draft) return;
        awaitReply('saving', 'Saving timed out — the settings may not have been stored.');
        const message: SidebarMessage = { type: 'UPDATE_SETTINGS', name: currentTab, settings: draft };
        if (!send(message)) settle('error', 'Lost the connection to the extension.');
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
                            <button class={buttonClass} onclick={() => send({ type: 'TOGGLE', name })}>
                                {enabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button class={buttonClass} onclick={() => openSite(name)}>Edit</button>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <button class="hover:underline px-4 py-2 absolute top-2 left-2 transition-all duration-300 cursor-pointer text-xl font-bold" onclick={closeSite}>
                Back
            </button>
            {#if status === 'loading'}
                <h2 class="font-bold text-xl">Loading..</h2>
            {:else if !draft}
                <div class="flex flex-col items-center gap-2">
                    <p>{notice || 'Could not load these settings.'}</p>
                    <button class={buttonClass} onclick={() => requestSettings(currentTab)}>Retry</button>
                </div>
            {:else}
                <div class="flex flex-col items-center justify-center gap-2">
                    <h1 class="font-bold text-4xl">{currentTab}</h1>
                    {#if notice}
                        <p class="text-sm" class:text-red-500={status === 'error'} transition:fade>{notice}</p>
                    {/if}
                    <form class="flex w-full h-full flex-col items-center justify-center gap-2" onsubmit={handleSubmit}>
                        <!-- Fields come from the schema, not from whichever keys the
                             stored config happens to carry. -->
                        {#each fields as field}
                            {@const boolDraft = draft as Record<string, boolean>}
                            {@const numDraft = draft as Record<string, number>}
                            {#if !field.dependsOn || draft[field.dependsOn]}
                                <label class="flex flex-col w-full" transition:fade>
                                    <span class="font-bold text-lg">{field.label}</span>
                                    {#if field.description}<span>{field.description}</span>{/if}
                                    {#if field.type === 'boolean'}
                                        <Checkbox label={boolDraft[field.key] ? 'On' : 'Off'} bind:checked={boolDraft[field.key]} />
                                    {:else}
                                        <select class="px-4 py-2 border border-gray-300" bind:value={numDraft[field.key]}>
                                            {#each field.options as option}
                                                <option value={option.value}>{option.label}</option>
                                            {/each}
                                        </select>
                                    {/if}
                                </label>
                            {/if}
                        {/each}
                        <button class="px-4 py-2 bg-green text-black cursor-pointer text-xl disabled:opacity-50" disabled={status === 'saving'}>
                            {status === 'saving' ? 'Saving..' : 'Save'}
                        </button>
                    </form>
                </div>
            {/if}
        {/if}
    </div>
{/key}
