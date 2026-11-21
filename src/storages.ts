import { createSubscriber, SvelteMap } from "svelte/reactivity";
import type { WxtStorageItem } from "wxt/utils/storage";

export function storageState<T extends Record<string, unknown>>(storageDefinition: WxtStorageItem<T, {}>, manualUpdate: true): [T, () => Promise<void>];
export function storageState<T extends Record<string, unknown>>(storageDefinition: WxtStorageItem<T, {}>): T;
export function storageState<T extends Record<string, unknown>>(storageDefinition: WxtStorageItem<T, {}>, manualUpdate?: boolean) {
    let subscriberUpdate: () => void | undefined;
    let currentState = {} as T;

    const updateFromStorage = (result: T | null) => {
        if (!result) return;
        Object.assign(currentState, result);
        subscriberUpdate?.();
    }

    storageDefinition.getValue().then(updateFromStorage);
    const subscribe = createSubscriber(update => {
        subscriberUpdate = update;
        return storageDefinition.watch(updateFromStorage);
    });

    const proxy = new Proxy(currentState, {
        get(target, prop, receiver) {
            subscribe();
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            const oldValue = Reflect.get(target, prop, receiver);
            const result = Reflect.set(target, prop, value, receiver);

            if (result && !Object.is(oldValue, target)) {
                if (!manualUpdate) storageDefinition.setValue(target);
                subscriberUpdate?.();
            }
            
            return result;
        },
        deleteProperty(target, prop) {
            const hadKey = Reflect.has(target, prop);
            const result = Reflect.deleteProperty(target, prop);
            
            if (result && hadKey) {
                if (!manualUpdate) storageDefinition.setValue(target);
                subscriberUpdate?.();
            }

            return result;
        }
    });

	return manualUpdate ? [proxy, () => storageDefinition.setValue(currentState)] : proxy;
}

export class StorageMap<T extends Record<string, unknown>, K extends keyof T & string = keyof T & string> extends SvelteMap<K, T[K]> {
    private storageDefinition: WxtStorageItem<T, {}>;
    private manualUpdate: boolean;

    constructor(storageDefinition: WxtStorageItem<T, {}>, manualUpdate?: boolean) {
        super();

        storageDefinition.getValue()
            .then(results => this.#updateFromStorage(results))
            .finally(() => storageDefinition.watch(results => this.#updateFromStorage(results)));
        
        this.storageDefinition = storageDefinition;
        this.manualUpdate = !!manualUpdate;
    }

    #updateFromStorage(results: T | null) {
        if (!results) return;

        super.clear();
        for (const [key, value] of Object.entries(results)) {
            super.set(key as K, value as T[K]);
        }
    }

    update() {
        return this.storageDefinition.setValue(Object.fromEntries(this) as T);
    }

    override set(key: K, value: T[K]) {
        const newMap = super.set(key, value);
        if (!this.manualUpdate) this.update();
        return newMap;
    }

    override delete(key: K) {
        const deleted = super.delete(key);
        if (deleted && !this.manualUpdate) this.update();
        return deleted;
    }

    override get<H extends T[K] = T[K]>(key: K) {
        return super.get(key) as H;
    }
}