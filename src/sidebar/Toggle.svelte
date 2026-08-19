<script lang="ts">
    // A switch rather than a checkbox: square knob, gradient track when on, to
    // match the angular mark. Two modes — bound (the form edits a draft) or
    // controlled via onToggle (the site list waits for the worker to confirm,
    // so it must not flip optimistically).
    type Props = {
        checked?: boolean;
        label: string;
        onToggle?: (next: boolean) => void;
    };

    let { checked = $bindable(false), label, onToggle }: Props = $props();

    function activate() {
        if (onToggle) onToggle(!checked);
        else checked = !checked;
    }
</script>

<button type="button" class="switch" role="switch" aria-checked={checked} aria-label={label} onclick={activate}></button>
