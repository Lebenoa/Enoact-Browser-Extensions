<script lang="ts">
    import iconUrl from '../images/icon.png';
    import { isFirefoxLike } from '../api';
    const logo = iconUrl;

    function openSidebar() {
        if (isFirefoxLike) {
            browser.runtime.sendMessage({ type: 'openSidebar' });
        } else {
            chrome.runtime.sendMessage({ type: 'openSidebar' });
        }
    }
</script>

<button
    type="button"
    class="content_pill"
    aria-label="Open sidebar"
    onclick={openSidebar}
>
    <img class="content_pill_logo" src={logo} alt="" aria-hidden="true" />
    <span class="content_pill_text">Open sidebar</span>
</button>
