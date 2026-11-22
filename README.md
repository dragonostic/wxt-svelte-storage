# WXT Svelte Storage

Simple to use function and classes that wrap both Svelte built-ins and the browser extension storage API together into state-like reactive storages.

## Usage

This package lists [@wxt-dev/storage](https://www.npmjs.com/package/@wxt-dev/storage) as a dependency, and works best with [WXT](https://wxt.dev/) although it can be used with other frameworks like [crxjs](https://github.com/crxjs/chrome-extension-tools).

It's ideal to export all of your individual state objects or maps in a single file, such as `src/lib/Storage.ts`.  

### Basic example

`Storage.ts`:
```typescript
import { stateStorage, SvelteMapStorage } from "wxt-svelte-storage";

// Strict typing
export const settings = stateStorage<{ theme: "light" | "dark" }>("local:settings", { theme: "light" });

// Inferred typing -- "clicks" will be a number
export const syncData = stateStorage("sync:data", { clicks: 0 });

// SvelteMapStorage example
export const items = new SvelteMapStorage<{ [key: string]: boolean }>("local:items", { "firstKey": true, "secondKey": false });
```  

`Component.svelte`:
```svelte
<script lang="ts">
    import { settings, syncData, items } from "Storage";
</script>

<div data-theme="{settings.theme}">
    <button onclick={() => settings.theme = settings.theme === "light" ? "dark" : "light"}>Toggle {settings.theme} theme</button>
    <button onclick={() => syncData.clicks++}>Click me!</button>
    {#each items as [key, value]}
        <div>
            <span>{key}: {value}</span>
            <button onclick={() => items.set(key, !value)}>Toggle {key}</button>
        </div>
    {/each}
    {#if items.get("firstKey")}
        <span>First key!</span>
    {/if}
</div>
```  

### Manually updating
You can set the `manualUpdate` argument to `true` when defining your storage constant, which returns a function to use to manually trigger the browser's storage update while still tracking and maintaining UI updates.  

This is useful if you are rapidly causing state changes -- which trigger a slew of storage inserts that can cause the page to lag.  

`Storage.ts`:
```typescript
import { stateStorage } from "wxt-svelte-storage";

export const [settings, updateSettings] = stateStorage("sync:settings", { username: "" }, { manualUpdate: true }); 
```

`Component.svelte`:
```svelte
<script lang="ts">
    import { settings, updateSettings } from "Storage";
</script>

<input type="text" bind:value={settings.username} onkeyup={updateSettings}>
```  

### Avoiding flashing/flipping on storage load
Due to the fact that browser storage updates using [@wxt-dev/storage](https://www.npmjs.com/package/@wxt-dev/storage) are asynchronous, a quick flash or flip between the `initialValue` argument provided to `stateStorage` or `SvelteMapStorage` and the value actually stored on the browser may occur on page/content script load.  

To avoid this, you can pass `async` to the settings when defining your storage constant.  

`Storage.ts`:
```typescript
import { stateStorage } from "wxt-svelte-storage";

// settings becomes a promise with a return type of { username: string; }
export const settings = stateStorage("sync:settings", { username: "" }, { async: true }); 
```  

You will have to `await` the initial value in your component -- either in the template or in an `onMount()` -- ex:

`Component.svelte`:
```svelte
<script lang="ts">
    import { settings } from "Storage";
</script>

<span>
    Your username is:
    {#await settings}
        (loading...)
    {:then fetchedSettings}
        {fetchedSettings.username}
    {/await}
</span>
```  