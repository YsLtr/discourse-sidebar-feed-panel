# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-11 09:51:13 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: Next session should diagnose and fix the user-reported **menu display issue** after the category-source regression fix.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`, userscript version now `2.0.1`.
- The category acquisition regression is fixed:
  - `/categories_and_latest.json` is now loaded and cached via `loadCategoriesAndLatestData()`.
  - `category_list.categories` seeds Feed Category Tabs when `/site.json` navigation fields do not expose category links.
  - `/site.json.categories` remains the complete category metadata/tree source for parent chains, badges, filtering, and site capability controls.
  - LinuxDO static category presets were not reintroduced.
- `todo.md` currently includes pending items for double-click fast back-to-top and "隐藏置顶只隐藏已读".

## Validation Run

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- todo.md discourse-sidebar-feed-panel.user.js AGENTS.md` passed, with only the Windows LF-to-CRLF warning for the userscript.
- Browser validation with `$agent-browser-cli` using the local script injected into live pages:
  - LinuxDO rendered 17 category tabs; clicking `开发调优` fetched `/c/develop/4/l/latest.json?page=0&include_subcategories=true&order=activity` and rendered topics.
  - NodeLoc rendered 11 category tabs; clicking `互联网服务` fetched `/c/internet/5/l/latest.json?page=0&include_subcategories=true&order=activity` and rendered topics.
- Endpoint smoke checks returned `200` for LinuxDO and NodeLoc category latest/top URLs with `include_subcategories=true`.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Feed Category Tabs are seeded from Discourse's category-list/navigation-like set, not every `site.json` top-level category by default.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count stays separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior unless the menu display fix proves it is directly involved.

## Known Next Issue

- User asked to fix **菜单显示的问题** next. This is not diagnosed yet.
- Likely surfaces to inspect first: category tab overflow menu / expanded draggable panel (`.sfp-tab-shell`, `.sfp-tab-panel`, `.sfp-tab-grid`), settings menu (`.sfp-settings-wrap`), and interaction with the replaced Discourse sidebar layout.

## Concrete Next Steps

1. Reproduce the menu display issue in a live browser on LinuxDO and NodeLoc using `$agent-browser-cli`.
2. Identify which menu is affected and capture DOM/CSS state before editing.
3. Fix the smallest relevant CSS/DOM behavior in `discourse-sidebar-feed-panel.user.js`.
4. Re-run `node --check discourse-sidebar-feed-panel.user.js` and targeted browser validation for the affected menu on both supported sites.

## Suggested Skills

- `$agent-browser-cli` for live Discourse DOM inspection, screenshots, clicks, and CSS state checks.
- `$diagnose` if the display issue is intermittent or differs between LinuxDO and NodeLoc.
- `$handoff` again if the menu issue remains unresolved.
