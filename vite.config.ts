import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { userscript } from "./build/userscript.ts";

export default defineConfig(({ command }) => ({
  build: { outDir: "dist", minify: false, cssMinify: false, sourcemap: false },
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript:
        command === "serve"
          ? { ...userscript, downloadURL: undefined, updateURL: undefined }
          : userscript,
      server: { open: false, prefix: (name) => `dev:${name}` },
      build: {
        fileName: "discourse-sidebar-feed-panel.user.js",
        metaFileName: false,
        autoGrant: false,
      },
    }),
  ],
}));
