import { createSubscriber, SvelteMap, SvelteSet } from "svelte/reactivity";
import { storage, WxtStorageItemOptions, type StorageItemKey, type WxtStorageItem } from "@wxt-dev/storage";

type StorageOptions<T> = Omit<WxtStorageItemOptions<T>, "init" | "fallback"> & { manualUpdate?: boolean; async?: boolean; };

export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T, settings: StorageOptions<T> & { manualUpdate?: false; async: true; }): Promise<T>;
export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T, settings: StorageOptions<T> & { manualUpdate: true; async: true; }): [Promise<T>, () => Promise<void>];
export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T, settings: StorageOptions<T> & { manualUpdate: true; async?: false; }): [T, () => Promise<void>];
export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T, settings: StorageOptions<T> & { manualUpdate?: false; async?: false; }): T;
export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T, settings: StorageOptions<T> & { async?: false; }): T;
export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T, settings: StorageOptions<T> & { manualUpdate?: false; }): T;
export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T): T;
export function stateStorage<T extends object>(key: StorageItemKey, initialValue: T, { manualUpdate = false, async = false, ...storageOptions }: StorageOptions<T> = {}) {
    let subscriberUpdate: () => void | undefined;
    let currentState = initialValue;

    const updateFromStorage = (result: T | null) => {
        if (!result) return;
        Object.assign(currentState, result);
        subscriberUpdate?.();
    }

    const storageDefinition = storage.defineItem(key, { init: () => initialValue, fallback: initialValue, ...storageOptions });
    const getStorage = storageDefinition.getValue().then(updateFromStorage);

    const subscribe = createSubscriber(update => {
        subscriberUpdate = update;
        return storageDefinition.watch(updateFromStorage);
    });

    const proxy = new Proxy(currentState, {
        get(obj, prop, receiver) {
            subscribe();
            return Reflect.get(obj, prop, receiver);
        },
        set(obj, prop, value, receiver) {
            const oldValue = Reflect.get(obj, prop, receiver);
            const result = Reflect.set(obj, prop, value, receiver);

            if (result && !Object.is(oldValue, obj)) {
                if (!manualUpdate) storageDefinition.setValue(obj);
                subscriberUpdate?.();
            }

            return result;
        },
        deleteProperty(obj, prop) {
            const hadKey = Reflect.has(obj, prop);
            const result = Reflect.deleteProperty(obj, prop);

            if (result && hadKey) {
                if (!manualUpdate) storageDefinition.setValue(obj);
                subscriberUpdate?.();
            }

            return result;
        }
    });

    const returnValue = manualUpdate ? [proxy, () => storageDefinition.setValue(currentState)] : proxy;
    return async ? getStorage.then(() => Promise.resolve(returnValue)) : returnValue;
}

export class SvelteMapStorage<T extends Record<string, unknown>, K extends keyof T & string = keyof T & string> extends SvelteMap<K, T[K]> {
    private storageDefinition: WxtStorageItem<T | null, {}>;
    private manualUpdate: boolean;

    constructor(key: StorageItemKey, initialValue?: T, { manualUpdate = false, async = false, ...storageOptions }: StorageOptions<T> = {}) {
        super();

        const options: WxtStorageItemOptions<T> = storageOptions;
        if (initialValue) {
            options.init = () => initialValue;
            options.fallback = initialValue;
        }

        this.manualUpdate = manualUpdate;
        this.storageDefinition = storage.defineItem<T>(key, options);

        this.storageDefinition.getValue()
            .then(results => this.updateFromStorage(results))
            .finally(() => this.storageDefinition.watch(results => this.updateFromStorage(results)));
    }

    private updateFromStorage(results: T | null) {
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

export class SvelteSetStorage<T> extends SvelteSet<T> {
    private storageDefinition: WxtStorageItem<Iterable<T> | null, {}>;
    private manualUpdate: boolean;

    constructor(key: StorageItemKey, initialValue?: Iterable<T>, { manualUpdate = false, async = false, ...storageOptions }: StorageOptions<Iterable<T>> = {}) {
        super();

        const options: WxtStorageItemOptions<Iterable<T>> = storageOptions;
        if (initialValue) {
            options.init = () => initialValue;
            options.fallback = initialValue;
        }

        this.manualUpdate = !!manualUpdate;
        this.storageDefinition = storage.defineItem<Iterable<T>>(key, options);

        this.storageDefinition.getValue()
            .then(results => this.updateFromStorage(results))
            .finally(() => this.storageDefinition.watch(results => this.updateFromStorage(results)));
    }

    private updateFromStorage(results: Iterable<T> | null) {
        if (!results) return;

        super.clear();
        for (const value of results) {
            super.add(value);
        }
    }

    update() {
        return this.storageDefinition.setValue(this.values());
    }

    override add(value: T) {
        const newSet = super.add(value);
        if (!this.manualUpdate) this.update();
        return newSet;
    }

    override delete(value: T) {
        const deleted = super.delete(value);
        if (deleted && !this.manualUpdate) this.update();
        return deleted;
    }
}