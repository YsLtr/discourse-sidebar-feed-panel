import { defineConfig } from "vitest/config";

// Unit tests do not load the userscript plugin or a script manager's GM bridge.
// DOM-dependent behaviour is covered by npm run check:browser instead.
export default defineConfig({ test: { include: ["tests/unit/**/*.test.ts"] } });
