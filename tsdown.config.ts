import { defineConfig } from "tsdown";

const entry = ["./src/index.ts"];

export default defineConfig([
    {
        entry,
    },
    {
        entry,
        format: "cjs",
    },
]);