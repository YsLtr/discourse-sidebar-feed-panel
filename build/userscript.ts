import type { MonkeyUserScript } from "vite-plugin-monkey";
import pkg from "../package.json" with { type: "json" };

export const userscript: MonkeyUserScript = {
  name: "Discourse Sidebar Feed Panel",
  namespace: "https://linux.do/",
  version: pkg.version,
  description:
    "将 Discourse 原生侧边栏改造为信息流面板，支持分类筛选、已读/未读过滤、拖拽调整宽度",
  author: "YsLtr",
  match: [
    "https://linux.do/*",
    "https://www.nodeloc.com/*",
    "https://forum.chrultrabook.com/*",
    "https://community.openai.com/*",
  ],
  icon: "https://www.google.com/s2/favicons?sz=64&domain=linux.do",
  downloadURL:
    "https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/latest/download/discourse-sidebar-feed-panel.user.js",
  updateURL:
    "https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/latest/download/discourse-sidebar-feed-panel.user.js",
  grant: [
    "GM_addStyle",
    "GM_setValue",
    "GM_getValue",
    "GM_deleteValue",
    "GM_registerMenuCommand",
    "unsafeWindow",
  ],
  "run-at": "document-idle",
  license: "MIT",
};
