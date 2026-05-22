# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-22 15:34 (+08:00)
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Branch**: `master`
**Current objective**: Maintain `discourse-sidebar-feed-panel.user.js` with small, behavior-preserving changes. The latest user request was to add detailed comments based on git history and prior requirements.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.70`
- Latest completed pass added maintenance comments only; no runtime behavior was intentionally changed.
- New comments explain:
  - GM storage key stability and old `default` order migration.
  - Sidebar width, auto-load rate limiting, and query-session reset constraints.
  - Settings panel behavior for "新活动提醒", "自动静默刷新", and "自动刷新".
  - Why incoming message-bus payloads are treated as candidates before fetching full topic details.
  - `FeedQuery` snapshot/key behavior and `/latest.json` vs `/top.json` URL rules.
  - The split between latest-activity silent refresh and non-latest automatic refresh.
- Earlier cleanup already completed:
  - Fixed `_mergeAndRenderTopics()` prepend mode so incoming insertion does not force `hasMorePages = true`.
  - Removed the redundant `_rerenderTabBar()` synchronous `scrollLeft` assignment.
  - Changed `_getMessageBusLastId()` to accept the local `messageBus` instance.
  - Added `SETTINGS_BUTTON_SIZE`, cached CSRF/site URL helpers, simplified incoming/read-marker helpers, and removed several unused helpers/CSS rules.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed, with only the expected CRLF conversion warning.
- Browser verification was not rerun after the comment-only edits. Previous linux.do verification confirmed the installed userscript rendered `.sfp-feed-container`, `.sfp-settings-wrap`, `.sfp-tab-bar`, and `.sfp-back-top-btn`.

## Constraints

- Do not commit unrelated untracked/reference files unless explicitly requested.
- Current unrelated untracked/reference files: `CLAUDE.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- Avoid broad automated splitting/reformatting of `injectStyles()`. If CSS organization is needed, extract one small, explicitly named style block at a time and run `node --check` after each step.
- Category badge colors/icons should respect live Discourse `site.json` metadata when available. Treat `CATEGORY_CONFIG` as fallback data; do not assume Lv1/Lv2/Lv3 colors are visually identical to parent categories.

## Open Questions / Risks

- `_isTopicRead()` remains intentionally defensive. Any simplification must preserve read/unread filters and protected-topic local patching.
- RouteWatcher narrowing should continue to be watched during live route changes and sidebar regeneration.
- Incoming-topic state is improved but still spread across helper functions; keep future refactors behavior-preserving.
- `_startAutoRefresh()` is still called from both control sync and successful topic load paths; this is redundant but safe because `_startAutoRefresh()` stops the old timer first.

## Recommended Next Steps

1. Reinstall/update the local userscript before any live browser verification.
2. If continuing cleanup, review one incoming refresh state helper slice at a time.
3. If changing route/sidebar behavior, verify on linux.do with `$agent-browser-cli`.
4. Consider only small CSS extraction candidates, such as loading/error styles, not the full `injectStyles()` block.

## Suggested Skills

- `$agent-browser-cli` for live linux.do verification.
- `/review` or `/simplify` for another focused quality pass.
- `/diagnose` if a regression appears after refactoring.
