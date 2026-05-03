<script lang="ts">
    import Checkbox from "./Checkbox.svelte";

    import iconUrl from "../images/icon.png";
    import { fade } from "svelte/transition";
    const logo = iconUrl;
    const SETTINGS_INFO = {
        enabled: {
            rename: "Enabled",
            description: "Disable/enable the extension on this site",
            type: "boolean",
        },
        robust_info: {
            rename: "Robust Info",
            description:
                "Extract more information from collaboration video but may flicker screen a little bit",
            type: "boolean",
        },
    };
    const port = chrome.runtime.connect({ name: "sidebar" });

    let currentTab = $state("");
    let sitesAvailable: { name: string; enabled: boolean }[] = $state([]);
    let settings: Record<string, any> = $state({});

    function retriveSettingsFor(site: string) {
        port.postMessage({ type: "GET_SETTINGS", site: site });
    }

    port.onMessage.addListener((message) => {
        console.log(message);
        switch (message.type) {
            case "SETTINGS_LIST":
                sitesAvailable = message.items;
                break;
            case "TOGGLE":
                sitesAvailable = sitesAvailable.map((site) => {
                    if (site.name === message.name) {
                        return { ...site, enabled: message.enabled };
                    }
                    return site;
                });
                break;
            case "GET_SETTINGS":
                settings = message.settings;
                break;
            case "SUCCESS":
                alert(message.message);
                break;
            case "ERROR":
                alert(message.message);
                break;
            default:
                break;
        }
    });

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();

        port.postMessage({
            type: "UPDATE_SETTINGS",
            name: currentTab,
            settings,
        });
    }
</script>

{#key currentTab}
    <div class="h-full w-full" in:fade>
        {#if currentTab == ""}
            <div class="flex flex-col items-center justify-center gap-2">
                <img class="w-full h-full" src={logo} alt="The Enoact Logo" />
                <h1 class="font-bold text-2xl">Settings</h1>
                {#each sitesAvailable as { name, enabled }}
                    <div
                        class="flex flex-row justify-between items-center mx-2 w-full text-xl"
                    >
                        <span>{name}</span>
                        <div class="flex flex-row">
                            <button
                                class="px-4 py-2 border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors duration-300 cursor-pointer"
                                onclick={() => {
                                    port.postMessage({ type: "TOGGLE", name });
                                }}
                            >
                                {#if enabled}
                                    <span>Enabled</span>
                                {:else}
                                    <span>Disabled</span>
                                {/if}
                            </button>
                            <button
                                class="px-4 py-2 border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors duration-300 cursor-pointer"
                                onclick={() => {
                                    currentTab = name;
                                    retriveSettingsFor(name);
                                }}
                            >
                                <span>Edit</span>
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <button
                class="hover:underline px-4 py-2 absolute top-10 left-2 transition-all duration-300 cursor-pointer text-xl font-bold"
                onclick={() => {
                    (currentTab = ""), (settings = {});
                }}
            >
                Back
            </button>
            {#if settings}
                <div class="flex flex-col items-center justify-center gap-2">
                    <h1 class="font-bold text-4xl">{currentTab}</h1>
                    <form
                        class="flex w-full h-full flex-col items-center justify-center gap-2"
                        onsubmit={handleSubmit}
                    >
                        {#each Object.entries(settings) as [key, value]}
                            {@const info =
                                SETTINGS_INFO[
                                    key as keyof typeof SETTINGS_INFO
                                ]}
                            <label class="flex flex-col w-full">
                                <span class="font-bold text-lg"
                                    >{info?.rename ?? key}</span
                                >
                                {#if info?.description}
                                    <span>{info.description}</span>
                                {/if}
                                {#if info?.type == "boolean"}
                                    <Checkbox
                                        label={value.toString()}
                                        bind:checked={
                                            settings[
                                                key as keyof typeof settings
                                            ]
                                        }
                                    />
                                {:else}
                                    <input
                                        class="px-4 py-2 border border-gray-300"
                                        type="text"
                                        {value}
                                        onchange={(e) => {
                                            const originalValueType =
                                                typeof value;
                                            switch (originalValueType) {
                                                case "boolean":
                                                    if (
                                                        e.currentTarget.value ==
                                                        "true"
                                                    ) {
                                                        settings[
                                                            key as keyof typeof settings
                                                        ] = true;
                                                    } else {
                                                        settings[
                                                            key as keyof typeof settings
                                                        ] = false;
                                                    }
                                                    break;
                                                case "string":
                                                    settings[
                                                        key as keyof typeof settings
                                                    ] = e.currentTarget.value;
                                                    break;
                                                case "number":
                                                    settings[
                                                        key as keyof typeof settings
                                                    ] = Number(
                                                        e.currentTarget.value,
                                                    );
                                                    break;
                                                default:
                                                    break;
                                            }
                                        }}
                                    />
                                {/if}
                            </label>
                        {/each}
                        <button
                            class="px-4 py-2 bg-green text-black cursor-pointer text-xl"
                        >
                            Save
                        </button>
                    </form>
                </div>
            {:else}
                <h2 class="font-bold text-xl">Loading..</h2>
            {/if}
        {/if}
    </div>
{/key}
