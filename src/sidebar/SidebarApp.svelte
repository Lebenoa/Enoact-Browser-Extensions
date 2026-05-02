<script lang="ts">
    import iconUrl from "../images/icon.png";
    const logo = iconUrl;
</script>

<!-- <div class="sidebar_app">
    <img class="sidebar_logo" src={logo} alt="The Svelte logo" />
    <h1 class="sidebar_title">Sidebar Panel</h1>
    <p class="sidebar_description">
        Learn more in the{" "}
        <a
            href="https://extension.js.org"
            target="_blank"
            rel="noopener noreferrer">Extension.js docs</a
        >
        .
    </p>
</div> -->
<div class="flex flex-col items-center justify-center">
    <img class="w-full h-full" src={logo} alt="The Enoact Logo" />
    <h1 class="font-bold text-2xl">Currently does NOT do anything :)</h1>
    <h2 class="font-bold text-xl">Just a placeholder FOR NOW</h2>
    <button
        class="px-4 py-2 border border-gray-300 bg-transparent hover:bg-gray-100 transition-colors duration-300 cursor-pointer"
    >
        Test
    </button>
</div>
