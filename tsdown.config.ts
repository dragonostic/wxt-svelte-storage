import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["./src/index.ts"],
    format: ["module", "cjs"],
    dts: true,
    clean: true,
    exports: true,
    publint: true,
    attw: true,
});