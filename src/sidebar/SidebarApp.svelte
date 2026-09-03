<script lang="ts">
    import Toggle from './Toggle.svelte';
    import iconUrl from '../images/icon.png';
    import { fade } from 'svelte/transition';
    import { coerceConfig, fieldsFor, isFieldVisible, labelFor } from '../settings-schema';
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
        // $state deep-proxies its values, and port messages are
        // structured-cloned — Firefox throws DataCloneError on a proxy, which
        // send() would mislabel as a lost connection. $state.snapshot returns
        // a plain, cloneable copy.
        const plain = $state.snapshot(draft);
        const message: SidebarMessage = { type: 'UPDATE_SETTINGS', name: currentTab, settings: plain };
        if (!send(message)) settle('error', 'Lost the connection to the extension.');
    }
</script>

<div class="panel">
    <header class="head">
        <img class="w-[30px] h-[30px] object-contain drop-shadow-[0_0_10px_rgba(255,0,229,0.35)]" src={logo} alt="" aria-hidden="true" />
        <div>
            <div class="head-word">ENOACT</div>
            <div class="head-sub">presence broadcaster</div>
        </div>
        {#if currentTab === ''}
            <span class="head-count">{liveCount}/{sitesAvailable.length} live</span>
        {/if}
    </header>

    <div class="scroller">
        {#key currentTab}
            <div in:fade={{ duration: 140 }}>
                {#if currentTab === ''}
                    <ul class="list-none m-0 p-0 flex flex-col gap-2">
                        {#each sitesAvailable as { name, enabled } (name)}
                            <li class="site-row">
                                <span class="site-rail {enabled ? 'site-rail-live' : ''}"></span>
                                <button class="site-main flex items-center gap-2" onclick={() => openSite(name)}>
                                    <div class="flex flex-row gap-2 items-center">
                                        <img class="site-favicon w-4 h-4" src={`https://www.google.com/s2/favicons?domain=${name}&sz=16`} alt="" />
                                        <span class="site-name">{labelFor(name)}</span>
                                    </div>
                                    <span class="site-host">{name}</span>
                                </button>
                                <div class="site-side">
                                    <span class="site-state {enabled ? 'site-state-live' : ''}">{enabled ? 'LIVE' : 'OFF'}</span>
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
                    <button class="back-link" onclick={closeSite}>&#8592; all sites</button>

                    {#if status === 'loading'}
                        <div class="state-block">
                            <div class="skeleton"></div>
                            <div class="skeleton"></div>
                        </div>
                    {:else if !draft}
                        <div class="state-block">
                            <p class="notice notice-error">{notice || 'Could not load these settings.'}</p>
                            <button class="ghost-btn" onclick={() => requestSettings(currentTab)}>Retry</button>
                        </div>
                    {:else}
                        <h1 class="editor-title">{labelFor(currentTab)}</h1>
                        <div class="editor-host">{currentTab}</div>

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
                            <p class="notice {status === 'error' ? 'notice-error' : ''}" transition:fade>{notice}</p>
                        {/if}

                        <form class="flex flex-col m-0" onsubmit={handleSubmit}>
                            <!-- Fields come from the schema, not from whichever keys the
                                 stored config happens to carry. -->
                            {#each fields as field (field.key)}
                                {@const boolDraft = draft as Record<string, boolean>}
                                {@const numDraft = draft as Record<string, number>}
                                {#if isFieldVisible(currentTab, draft, field)}
                                    <div class="field {field.type === 'boolean' ? 'field-switch' : ''}" transition:fade>
                                        <div class="flex-1 min-w-0">
                                            <span class="field-label">{field.label}</span>
                                            {#if field.description}<span class="field-desc">{field.description}</span>{/if}
                                        </div>
                                        {#if field.type === 'boolean'}
                                            <Toggle bind:checked={boolDraft[field.key]} label={field.label} />
                                        {:else if field.type === 'number'}
                                            <div class="flex items-center gap-2 mt-2.5">
                                                <input
                                                    class="number-ui"
                                                    type="number"
                                                    min={field.min}
                                                    max={field.max}
                                                    step={field.step}
                                                    aria-label={field.label}
                                                    bind:value={numDraft[field.key]}
                                                />
                                                {#if field.unit}<span class="number-unit">{field.unit}</span>{/if}
                                            </div>
                                        {:else}
                                            <select class="select-ui" bind:value={numDraft[field.key]}>
                                                {#each field.options as option}
                                                    <option value={option.value}>{option.label}</option>
                                                {/each}
                                            </select>
                                        {/if}
                                    </div>
                                {/if}
                            {/each}

                            <button class="save-btn" disabled={status === 'saving'}>
                                {status === 'saving' ? 'Saving' : 'Save changes'}
                            </button>
                        </form>
                    {/if}
                {/if}
            </div>
        {/key}
    </div>
</div>
