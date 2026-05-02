import { defineConfig, presetWind4 } from "unocss";

export default defineConfig({
    cli: {
        entry: {
            patterns: ["src/**/*"],
            outFile: "public/uno.css",
        }
    },
    presets: [
        presetWind4(),
    ]
});
