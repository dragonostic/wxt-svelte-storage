import { createSubscriber, SvelteMap } from "svelte/reactivity";
import { storage, type StorageItemKey, type WxtStorageItem } from "@wxt-dev/storage";

export function stateStorage<T extends Record<string, unknown>>(key: StorageItemKey, initialValue: T, manualUpdate: true): [T, () => Promise<void>];
export function stateStorage<T extends Record<string, unknown>>(key: StorageItemKey, initialValue: T): T;
export function stateStorage<T extends Record<string, unknown>>(key: StorageItemKey, initialValue: T, manualUpdate?: boolean) {
    let subscriberUpdate: () => void | undefined;
    let currentState = initialValue;

    const updateFromStorage = (result: T | null) => {
        if (!result) return;
        Object.assign(currentState, result);
        subscriberUpdate?.();
    }

    const storageDefinition = storage.defineItem(key, { init: () => initialValue });
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

export class SvelteMapStorage<T extends Record<string, unknown>, K extends keyof T & string = keyof T & string> extends SvelteMap<K, T[K]> {
    private storageDefinition: WxtStorageItem<T, {}>;
    private manualUpdate: boolean;

    constructor(key: StorageItemKey, initialValue: T, manualUpdate?: boolean) {
        super();
        
        this.manualUpdate = !!manualUpdate;
        this.storageDefinition = storage.defineItem(key, { init: () => initialValue });

        this.storageDefinition.getValue()
            .then(results => this.#updateFromStorage(results))
            .finally(() => this.storageDefinition.watch(results => this.#updateFromStorage(results)));
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