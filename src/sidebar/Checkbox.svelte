<script lang="ts">
    type Props = {
        checked?: boolean;
        label?: string;
    };
    let { checked = $bindable(false), label = "" }: Props = $props();
</script>

<label
    class="flex items-center cursor-pointer border border-cyan-500 py-2 px-4"
>
    <input type="checkbox" bind:checked class="hidden peer" />
    <span
        class="w-5 h-5 bg-transparent border border-cyan-500 peer-checked:bg-blue-500 relative"
    >
        <span
            class="absolute left-[7px] top-[3px] w-[5px] h-[10px] border-white border-solid border-t-0 border-l-0 border-r-2 border-b-2 transform rotate-45 peer-checked:block hidden"
        ></span>
    </span>
    {#if label}
        <span class="ml-2 text-sm">{label}</span>
    {/if}
</label>
