import { defineConfig } from "vitest/config";

// Unit tests do not load the userscript plugin or a script manager's GM bridge.
export default defineConfig({ test: { include: ["tests/unit/**/*.test.ts"] } });
