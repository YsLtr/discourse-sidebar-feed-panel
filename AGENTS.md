# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 08:10:15 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 下次处理“暗黑模式切换前后部分组件的样式变化未在预期内”。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.24`
- Pending commit for this handoff: incoming-topic/silent-refresh repair plus `AGENTS.md` update.
- Validation run this session:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js`
  - `$agent-browser-cli` verified linux.do MessageBus has `/latest` and `/new` channels with `subscribe(channel, callback, last_id)`.
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Replaced sidebar incoming-topic handling with a userscript-local MessageBus queue; no longer uses or clears Discourse global `topic-tracking-state.newIncoming`.
- Subscribes to `/latest` and `/new` from current channel `last_id`, so first entry does not replay old native incoming counts.
- `自动静默刷新` is now event-driven: in `全部板块 + 最新活动 + 全部筛选`, incoming messages immediately fetch `/latest.json?topic_ids=...` and prepend/update topics.
- Fixed the local queue count bug: existing loaded topics are now counted for `/latest` updates, matching native behavior where updated topics are also promoted.
- Default latest-activity view shows only `自动静默刷新`; other views show only `自动刷新` and interval.
- New-topic hint now follows Discourse/Horizon variables (`alert alert-info clickable`, `--tertiary-low`, `--tertiary`, `--d-border-radius-large`) instead of hardcoded dark colors.
- User confirmed the effect is good before asking for commit and this handoff.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint only belongs to `all + activity + all filter`.
- In that default view, `自动静默刷新` should normally prevent the hint from appearing because new/updated topics are applied immediately.
- Do not claim a page refresh applies userscript changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.

## Next Issue

User request for next session: “暗黑模式切换前后部分组件的样式变化未在预期内”.

Likely areas to inspect:

- CSS in `injectStyles()`, especially components using hardcoded fallback colors, rgba shadows, or fixed backgrounds.
- Header controls, custom selects, settings panel, topic item hover/highlight, unread dots, pagination/footer states, error/empty/loading states, and the new `.sfp-hint-text`.
- Whether styles update live when the Horizon/dark-mode plugin changes theme variables/classes, or whether components capture stale inline styles.

## Suggested Next Steps

1. Use `$agent-browser-cli` on `https://linux.do/` with logged-in cookies to capture computed styles before/after dark-mode toggle.
2. Build a small checklist of affected selectors and compare `getComputedStyle()` values against native Discourse controls.
3. Prefer CSS variables already provided by Discourse/Horizon over hardcoded colors; avoid one-off dark-mode overrides unless variables are missing.
4. Run `node --check discourse-sidebar-feed-panel.user.js`; bump userscript version before asking the user to install/test.

## Suggested Skills

- `$agent-browser-cli` for live theme toggle, DOM inspection, and computed-style comparison.
- `/diagnose` if the style drift is not reproducible or only appears after route/theme transitions.
- `$handoff` when updating this active handoff again.
