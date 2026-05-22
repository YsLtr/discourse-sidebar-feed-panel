# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-22 14:24 (+08:00)
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Branch**: `master`
**Current objective**: Continue low-risk cleanup in `discourse-sidebar-feed-panel.user.js` with small reviewed steps. Avoid broad automated CSS rewrites and be careful with runtime category metadata.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.70`
- Latest completed pass reviewed the user's "fourth round comprehensive review" and applied only the reasonable low-risk findings:
  - Fixed `_mergeAndRenderTopics()` prepend mode so incoming topic insertion no longer forces `hasMorePages = true`.
  - Removed the ineffective `_rerenderTabBar()` synchronous `scrollLeft` assignment that was immediately superseded by `_scrollTabIntoView()` in `requestAnimationFrame`.
  - Changed `_getMessageBusLastId()` to accept the local `messageBus` instance instead of reading `sidebarMessageBus`.
  - Did not change `_canRunAutoLoad()`: cleaning timestamps only in `_recordAutoLoadRequest()` would let stale timestamps keep blocking auto-load after the rate window expires.
  - Did not compress or inherit `CATEGORY_CONFIG` child colors/icons: live display primarily comes from `site.json` category metadata, and fallback config should not assume child categories share parent colors.
- Earlier cleanup already completed:
  - Removed unused `FeedQuery.isDefault()`.
  - Removed the no-op incoming refresh scheduling branch in `_handleSidebarIncomingMessage()`.
  - Added `SETTINGS_BUTTON_SIZE` for `_syncSettingsPanelHeight()` instead of repeated `28`.
  - Replaced `_isTopicRead()` per-topic `RegExp` creation with `_topicBaseUrl()` plus string comparison.
  - Trimmed `topic.unicode_title` before falling back to `topic.title`.
  - Extracted `_appendNoMore()` so `_renderPaginationFooter()` and `_showNoMore()` share the "already at bottom" DOM construction without dropping optional footer notes.
  - Cached `getCsrfToken()` and `toAbsoluteSiteUrl()`.
  - Replaced hardcoded `https://linux.do` URL joins in avatar and middle-click topic open paths.
  - Replaced topic middle-click `mousedown`/`mouseup` handling with `auxclick`.
  - Extracted `getSidebarElement()` and removed several unused helpers/CSS rules.
  - Simplified `_scrollTabIntoView()`, incoming candidate matching, read marker helpers, settings panel syncing, and saved tab ordering behavior.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed after the latest edits.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed, with only the expected CRLF conversion warning.
- Browser verification was not rerun for the latest local edits. Previous linux.do verification confirmed the installed userscript rendered `.sfp-feed-container`, `.sfp-settings-wrap`, `.sfp-tab-bar`, and `.sfp-back-top-btn`; local code changes still require reinstall/update before in-page verification.

## Constraints

- Do not commit unrelated untracked/reference files unless explicitly requested.
- Current unrelated untracked/reference files: `CLAUDE.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- `globalHelpTooltip` lifecycle is page-bound and does not need active cleanup.
- Avoid broad automated splitting/reformatting of `injectStyles()`. If CSS organization is needed, extract one small, explicitly named style block at a time and run `node --check` after each step.
- Category badge colors/icons should respect live Discourse `site.json` metadata when available. Treat `CATEGORY_CONFIG` as fallback data; do not assume Lv1/Lv2/Lv3 colors are visually identical to parent categories.

## Open Questions / Risks

- `_isTopicRead()` remains intentionally defensive. Any future simplification must preserve read/unread filters and protected-topic local patching.
- RouteWatcher narrowing should continue to be watched during live route changes and sidebar regeneration.
- Incoming-topic state is improved but still spread across helper functions; keep future refactors behavior-preserving.
- `_startAutoRefresh()` is still called from both control sync and successful topic load paths; previous review marked this as redundant but safe because `_startAutoRefresh()` stops the old timer first.
- Message-bus last-id candidate caching was reviewed and left alone; it only runs on subscription setup and extra caching is not worth the added state.
- CSS cleanup suggestions for `.sfp-tab-bar` `width`/`max-width` and `light-dark()` fallback were left alone because the benefit is minimal and layout/browser fallback risk is nonzero.

## Recommended Next Steps

1. Reinstall/update the local userscript before any live browser verification.
2. If continuing cleanup, review one incoming refresh state helper slice at a time.
3. If changing route/sidebar behavior, verify on linux.do with `$agent-browser-cli`.
4. Consider only small CSS extraction candidates, such as loading/error styles, not the full `injectStyles()` block.
5. If another review proposes category fallback changes, first compare against live `site.json` category colors and parent metadata.

## Suggested Skills

- `$agent-browser-cli` for live linux.do verification.
- `/review` or `/simplify` for another focused quality pass.
- `/diagnose` if a regression appears after refactoring.
