# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-10 21:28:35 CST +0800
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: Next session should fix the current regression: category tabs/categories are completely unavailable after the first-phase cross-site Discourse adaptation.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`, userscript version now `2.0.0`.
- First-phase cross-site implementation is applied but not live-browser validated:
  - built-in matches are `https://linux.do/*` and `https://www.nodeloc.com/*`;
  - no global `https://*/*`, no automatic arbitrary-site Discourse detection, no in-script site enable/disable menu;
  - preferences are origin-scoped via `sfp_site:<encoded origin>:<key>`;
  - LinuxDO legacy global GM keys migrate copy-then-delete using `GM_deleteValue`;
  - LinuxDO static `CATEGORY_CONFIG` / `TAB_CATEGORIES` were removed;
  - category metadata, UI labels, controls, and feed routes now derive from Discourse site data.
- Documentation for the agreed support model is in:
  - `CONTEXT.md`
  - `docs/cross-site-discourse-adaptation-plan.md`
  - `docs/adr/0002-match-based-cross-site-support.md`
  - `README.md`
- `todo.md` records the completed first-phase items.

## Known Regression To Fix Next

- User reported: **类别完全无法获取**.
- Likely starting point: `tabCategories` is built only by `_collectNavigationCategoryIds(site, rawById)` from `/site.json` fields such as `navigation_menu_categories`, `anonymous_sidebar_sections`, and related guesses.
- Observed during implementation: LinuxDO and NodeLoc `/site.json` expose categories in `site.categories`, but `anonymous_sidebar_sections` only showed community links like `/latest`, `/u`, `/about`, not category links. That means `_buildTabCategories(...)` can return `[]`, leaving only the all-topics tab.
- The agreed plan says phase one should seed **Feed Category Tabs** from the site's **Navigation Category Set**, but must **not** default to every visible top-level category. Do not silently change this product decision unless the user explicitly revises it.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Do not reintroduce LinuxDO static category presets.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count must stay separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior.

## Validation Already Run

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- discourse-sidebar-feed-panel.user.js README.md todo.md` passed, with only Windows LF-to-CRLF warnings.
- NodeLoc endpoint smoke checks returned `200` for latest, created, top, and `/c/internet/5/l/latest.json?include_subcategories=true`.

## Concrete Next Steps

1. Diagnose where Discourse exposes the actual navigation category set on LinuxDO and NodeLoc: page runtime services, preloaded payloads, DOM sidebar links, or another JSON endpoint.
2. Fix `_collectNavigationCategoryIds(...)` / `_buildTabCategories(...)` so category tabs are available without falling back to all top-level categories.
3. Re-run `node --check discourse-sidebar-feed-panel.user.js` and targeted URL-building smoke tests.
4. Use a browser session to verify LinuxDO and NodeLoc category tabs render, switch, and fetch correctly.

## Suggested Skills

- `$agent-browser-cli` for inspecting live Discourse runtime data and sidebar DOM.
- `$diagnose` if category source discovery is unclear or behavior differs between LinuxDO and NodeLoc.
- `$handoff` again if the category regression remains unresolved.
