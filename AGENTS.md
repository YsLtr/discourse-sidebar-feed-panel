# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 09:42:26 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下次处理“部分标签图标未显示，板块背景颜色未复刻”。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.27`
- Pending commit for this handoff: sidebar horizontal-scrollbar repair plus this `AGENTS.md` / `AGENTS_old.md` update.
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Fixed the extra horizontal scrollbar at the bottom of the sidebar.
- Diagnosis with `$agent-browser-cli` found `.sidebar-wrapper` had `overflow-x: auto` and `.sfp-resizer { right: -2px; width: 5px; }`, creating a 2px wrapper overflow.
- Added feed-mode scoped wrapper rule: `.sidebar-wrapper:has(> .sidebar-container.sfp-feed-mode) { overflow-x: hidden !important; }`.
- Restored `.sfp-feed-container` to `overflow: hidden`, matching the key intent of old commit `1eacf36129fb4c7b33b347bf1c46d222c0020c6c`.
- Kept the previous fix for category tab scrolling to the end: feed children use `box-sizing: border-box`, and key wrappers/bars use `min-width: 0` / `max-width: 100%`.
- User confirmed the scrollbar issue is solved.
- Validation run this session:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js`
  - `$agent-browser-cli` measured `.sidebar-wrapper`, `.sfp-resizer`, `.sfp-tab-bar`, and feed wrappers on `https://linux.do/`.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript changes; the user must reinstall/update the userscript for metadata/code changes.
- Prefer Discourse/Horizon CSS variables and native category/tag DOM conventions where possible.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress the just-fixed ability to scroll board filters to the end.

## Next Issue

User request for next session: “部分标签图标未显示，板块背景颜色未复刻”.

Likely areas to inspect:

- `CATEGORY_CONFIG` near the top of `discourse-sidebar-feed-panel.user.js`; some configured icon names may not exist in linux.do's loaded SVG sprite.
- `getCategoryIcon(id)`, `getCategoryColor(id)`, `_buildTabBar()`, and `createTopicItem()`.
- Current rendering uses `<svg><use href="#${cat.icon}"></use></svg>` in tabs and `<svg class="sfp-category-icon"><use href="#${catIcon}"></use></svg>` in topic category badges.
- CSS around `.sfp-category-badge`, `.sfp-category-icon`, `.sfp-tab-item`, and native Discourse category badge classes.
- Native Discourse/Horizon category badge DOM and styles may use more than a simple foreground icon color; compare background/border/text treatment.

## Suggested Next Steps

1. Use `$agent-browser-cli` on `https://linux.do/` to inspect native category/tag badges for affected boards and the userscript sidebar equivalents.
2. Enumerate missing icon IDs: compare configured `CATEGORY_CONFIG[*].icon` against existing `svg symbol` / `use` targets in the live page.
3. Inspect linux.do/Discourse source or live computed styles for category badge background color, border, text color, and icon color.
4. Prefer reusing native Discourse category badge classes/markup or CSS variables over hardcoded approximations.
5. Patch narrowly, bump userscript version, then run `node --check discourse-sidebar-feed-panel.user.js` and `git diff --check -- discourse-sidebar-feed-panel.user.js`.

## Suggested Skills

- `$agent-browser-cli` for live DOM/SVG symbol/computed-style inspection.
- `/diagnose` if missing icons vary by route/theme/load timing.
- `$handoff` when updating this active handoff again.
