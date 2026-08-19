<script lang="ts">
    import Toggle from './Toggle.svelte';
    import iconUrl from '../images/icon.png';
    import { fade } from 'svelte/transition';
    import { coerceConfig, fieldsFor, labelFor } from '../settings-schema';
    import type { BackgroundMessage, Config, SidebarMessage } from '../types';

    // The worker can sleep or die mid-request; without a deadline the panel
    // would wait on a reply that is never coming.
    const REQUEST_TIMEOUT = 5000;

    const logo = iconUrl;

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
    const liveCount = $derived(sitesAvailable.filter((site) => site.enabled).length);

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

<div class="panel">
    <header class="head">
        <img class="head__mark" src={logo} alt="" aria-hidden="true" />
        <div>
            <div class="head__word">ENOACT</div>
            <div class="head__sub">presence broadcaster</div>
        </div>
        {#if currentTab === ''}
            <span class="head__count">{liveCount}/{sitesAvailable.length} live</span>
        {/if}
    </header>

    <div class="body">
        {#key currentTab}
            <div in:fade={{ duration: 140 }}>
                {#if currentTab === ''}
                    <ul class="sites">
                        {#each sitesAvailable as { name, enabled } (name)}
                            <li class="site" class:site--live={enabled}>
                                <span class="site__rail"></span>
                                <button class="site__main" onclick={() => openSite(name)}>
                                    <span class="site__name">{labelFor(name)}</span>
                                    <span class="site__host">{name}</span>
                                </button>
                                <div class="site__side">
                                    <span class="site__state">{enabled ? 'LIVE' : 'OFF'}</span>
                                    <Toggle
                                        checked={enabled}
                                        label={`Toggle ${labelFor(name)}`}
                                        onToggle={() => send({ type: 'TOGGLE', name })}
                                    />
                                </div>
                            </li>
                        {/each}
                        {#if sitesAvailable.length === 0}
                            <li class="skeleton"></li>
                            <li class="skeleton"></li>
                            <li class="skeleton"></li>
                        {/if}
                    </ul>
                {:else}
                    <button class="back" onclick={closeSite}>&#8592; all sites</button>

                    {#if status === 'loading'}
                        <div class="state">
                            <div class="skeleton" style="width:100%"></div>
                            <div class="skeleton" style="width:100%"></div>
                        </div>
                    {:else if !draft}
                        <div class="state">
                            <p class="notice notice--error">{notice || 'Could not load these settings.'}</p>
                            <button class="ghost" onclick={() => requestSettings(currentTab)}>Retry</button>
                        </div>
                    {:else}
                        <h1 class="editor__title">{labelFor(currentTab)}</h1>
                        <div class="editor__host">{currentTab}</div>

                        <!-- The mark's zigzag, reused as the section rule. -->
                        <svg class="spike" viewBox="0 0 104 16" fill="none" aria-hidden="true">
                            <defs>
                                <linearGradient id="spike-gradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stop-color="#5b2bff" />
                                    <stop offset="100%" stop-color="#ff00e5" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M1 14 L12 14 L20 2 L28 14 L36 8 L44 14 L104 14"
                                stroke="url(#spike-gradient)"
                                stroke-width="2"
                                stroke-linejoin="round"
                                stroke-linecap="round"
                            />
                        </svg>

                        {#if notice}
                            <p class="notice" class:notice--error={status === 'error'} transition:fade>{notice}</p>
                        {/if}

                        <form class="fields" onsubmit={handleSubmit}>
                            <!-- Fields come from the schema, not from whichever keys the
                                 stored config happens to carry. -->
                            {#each fields as field (field.key)}
                                {@const boolDraft = draft as Record<string, boolean>}
                                {@const numDraft = draft as Record<string, number>}
                                {#if !field.dependsOn || draft[field.dependsOn]}
                                    <div class="field" class:field--switch={field.type === 'boolean'} transition:fade>
                                        <div class="field__text">
                                            <span class="field__label">{field.label}</span>
                                            {#if field.description}<span class="field__desc">{field.description}</span>{/if}
                                        </div>
                                        {#if field.type === 'boolean'}
                                            <Toggle bind:checked={boolDraft[field.key]} label={field.label} />
                                        {:else}
                                            <select class="select" bind:value={numDraft[field.key]}>
                                                {#each field.options as option}
                                                    <option value={option.value}>{option.label}</option>
                                                {/each}
                                            </select>
                                        {/if}
                                    </div>
                                {/if}
                            {/each}

                            <button class="save" disabled={status === 'saving'}>
                                {status === 'saving' ? 'Saving' : 'Save changes'}
                            </button>
                        </form>
                    {/if}
                {/if}
            </div>
        {/key}
    </div>
</div>
