import { defineConfig, presetWind4 } from "unocss";

// The design language comes from the extension mark: an angular zigzag in an
// indigo-to-magenta gradient. Cut corners instead of rounded ones, a gradient
// "signal rail" for sites that are broadcasting, monospace for anything the
// machine owns. Component-level pieces live in `shortcuts` so the markup stays
// readable; only what utilities genuinely cannot express is in `preflights`.

const NOTCH = "9px";
const notch = `polygon(0 0, calc(100% - ${NOTCH}) 0, 100% ${NOTCH}, 100% 100%, ${NOTCH} 100%, 0 calc(100% - ${NOTCH}))`;

export default defineConfig({
    cli: {
        entry: {
            patterns: ["src/**/*"],
            outFile: "public/uno.css",
        }
    },
    presets: [
        presetWind4(),
    ],
    theme: {
        colors: {
            bg: "#08090d",
            surface: "#10131b",
            surfaceHi: "#161a24",
            line: "#1f2432",
            lineHi: "#2c3346",
            rail: "#39415a",
            ink: "#e6e8ef",
            muted: "#868ea3",
            faint: "#5b6275",
            indigo: "#5b2bff",
            magenta: "#ff00e5",
            danger: "#ff4d6d",
        },
        font: {
            sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            mono: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
        },
        animation: {
            keyframes: {
                "rail-pulse": "{0%,100%{opacity:1}50%{opacity:.55}}",
                skeleton: "{0%{background-position:200% 0}100%{background-position:-200% 0}}",
            },
            durations: {
                "rail-pulse": "2.6s",
                skeleton: "1.4s",
            },
            timingFns: {
                "rail-pulse": "ease-in-out",
                skeleton: "ease-in-out",
            },
            counts: {
                "rail-pulse": "infinite",
                skeleton: "infinite",
            },
        },
    },
    rules: [
        // The mark's cut corner. Bracket syntax for this polygon is unreadable,
        // so it gets a named rule instead.
        ["notch", { "clip-path": notch }],
    ],
    shortcuts: {
        // Surfaces
        "accent-fill": "bg-gradient-to-br from-indigo to-magenta",
        panel: "flex flex-col h-full min-h-0",

        // Header
        head: "flex items-center gap-2.5 px-4 pt-4.5 pb-3.5 border-b border-line",
        "head-word":
            "font-mono text-[0.95rem] font-bold tracking-[0.34em] indent-[0.34em] accent-fill bg-clip-text text-transparent",
        "head-sub": "font-mono text-[0.62rem] tracking-[0.16em] uppercase text-faint mt-0.5",
        "head-count": "ml-auto font-mono text-[0.62rem] tracking-[0.12em] text-muted whitespace-nowrap",

        // Site list
        "site-row":
            "relative flex items-stretch bg-surface border border-line notch transition-all duration-160 hover:bg-surfaceHi hover:border-lineHi hover:translate-x-0.5",
        "site-rail": "w-[3px] flex-none bg-rail transition-all duration-200",
        "site-rail-live": "accent-fill shadow-[0_0_12px_rgba(255,0,229,0.55)] animate-rail-pulse",
        "site-main":
            "flex-1 min-w-0 flex flex-col items-start gap-0.5 py-2.5 pl-3 pr-2 bg-transparent border-none text-inherit font-inherit text-left cursor-pointer",
        "site-name": "font-semibold",
        "site-host": "font-mono text-[0.68rem] text-faint max-w-full truncate",
        "site-side": "flex items-center gap-2 pr-3 pl-1",
        "site-state": "font-mono text-[0.6rem] tracking-[0.14em] text-faint",
        "site-state-live": "text-magenta",

        // Switch
        "switch-track":
            "relative w-[38px] h-[20px] flex-none p-0 border border-lineHi rounded-[2px] bg-[#0b0d13] cursor-pointer transition-colors duration-160 focus-visible:(outline-none ring-2 ring-indigo ring-offset-2 ring-offset-bg)",
        "switch-track-on": "border-transparent accent-fill",
        "switch-knob":
            "absolute top-1/2 left-[2px] w-[14px] h-[14px] rounded-[1px] bg-faint -translate-y-1/2 transition-transform duration-180 ease-[cubic-bezier(0.3,0.8,0.3,1)]",
        "switch-knob-on": "bg-white translate-x-[16px]",

        // Editor
        "back-link":
            "inline-flex items-center gap-1.5 mb-3.5 p-0 bg-transparent border-none text-muted font-mono text-[0.68rem] tracking-[0.12em] uppercase cursor-pointer transition-colors duration-160 hover:text-ink",
        "editor-title": "m-0 text-[1.45rem] font-bold tracking-[-0.01em]",
        "editor-host": "font-mono text-[0.68rem] text-faint mt-0.5",
        // Short and left-aligned on purpose: stretched full width the zigzag
        // flattens into an ordinary hairline.
        spike: "block w-[104px] h-[16px] mt-3.5 mb-1 overflow-visible",

        field: "py-3.5 border-b border-line",
        "field-switch": "flex items-center gap-3",
        "field-label": "block font-semibold",
        "field-desc": "block mt-0.5 text-[0.78rem] leading-snug text-muted",
        "select-ui":
            "w-full mt-2.5 py-2.5 pl-3 pr-8 bg-[#0b0d13] border border-lineHi rounded-[2px] text-ink font-mono text-[0.78rem] appearance-none cursor-pointer transition-all duration-160 hover:border-faint focus-visible:(outline-none border-indigo ring-3 ring-indigo/25)",

        "number-ui":
            "w-[7.5rem] py-2.5 px-3 bg-[#0b0d13] border border-lineHi rounded-[2px] text-ink font-mono text-[0.78rem] transition-all duration-160 hover:border-faint focus-visible:(outline-none border-indigo ring-3 ring-indigo/25)",
        "number-unit": "font-mono text-[0.7rem] text-faint",

        // Actions
        "save-btn":
            "mt-4.5 px-4 py-3 accent-fill border-none notch text-white font-mono text-[0.76rem] font-bold tracking-[0.18em] uppercase cursor-pointer transition-all duration-160 hover:not-disabled:brightness-115 active:not-disabled:translate-y-px disabled:(cursor-default grayscale-70 brightness-75)",
        "ghost-btn":
            "px-3.5 py-2 bg-transparent border border-lineHi text-ink font-mono text-[0.7rem] tracking-[0.14em] uppercase cursor-pointer transition-all duration-160 hover:(bg-surfaceHi border-faint)",

        // States
        notice: "mt-3.5 mb-0 px-3 py-2 bg-surface border-l-2 border-indigo text-muted font-mono text-[0.72rem] leading-relaxed",
        "notice-error": "border-l-danger text-danger",
        "state-block": "flex flex-col items-start gap-3 pt-2",
        skeleton:
            "h-[46px] w-full bg-gradient-to-r from-surface via-surfaceHi to-surface bg-[length:200%_100%] animate-skeleton",
        scroller: "flex-1 min-h-0 overflow-y-auto px-4 pt-3.5 pb-5",
    },
    preflights: [
        {
            getCSS: () => `
                *, *::before, *::after { box-sizing: border-box; }

                /* Without this Chrome's auto dark mode re-tints the palette —
                   surfaces and borders come back as its greys, not ours. */
                :root { color-scheme: dark; }

                body {
                    margin: 0;
                    height: 100vh;
                    background: #08090d;
                    color: #e6e8ef;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-size: 14px;
                    -webkit-font-smoothing: antialiased;
                    overflow: hidden;
                }

                /* Ambient glow in the mark's two hues, bleeding from the top corners. */
                body::before {
                    content: "";
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    background:
                        radial-gradient(560px 300px at 0% 0%, rgba(91, 43, 255, 0.26), transparent 72%),
                        radial-gradient(440px 240px at 100% 0%, rgba(255, 0, 229, 0.13), transparent 72%);
                }

                #app { position: relative; height: 100%; }

                .scroller::-webkit-scrollbar { width: 8px; }
                .scroller::-webkit-scrollbar-thumb { background: #2c3346; }

                /* Data-URI chevron: quoting and commas make this unreadable as a utility. */
                .select-ui {
                    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23868ea3' stroke-width='1.6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 0.7rem center;
                }

                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after {
                        animation-duration: 0.001ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.001ms !important;
                    }
                    .site-row:hover { transform: none; }
                }
            `,
        },
    ],
});
