import { resolve } from "node:path";
import { addAlias, defineWxtModule } from "wxt/modules";

export default defineWxtModule<{}>({
    name: "wxt-svelte-storage",
    configKey: "svelte-storage",
    imports: [
        { from: "wxt-svelte-storage", name: "storageState" },
        { from: "wxt-svelte-storage", name: "StorageMap" }
    ],
    async setup(wxt) {
        const modulePath = resolve(wxt.config.wxtDir, "wxt-svelte-storage/index.ts");
        const moduleCode = await import(modulePath);

        addAlias(wxt, "wxt-svelte-storage", modulePath);

        wxt.hook("prepare:types", async (_, entries) => {
            entries.push({
                path: modulePath,
                text: moduleCode
            })
        });
    }
});