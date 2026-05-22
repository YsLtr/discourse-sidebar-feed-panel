# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-22 13:22 (+08:00)
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Branch**: `master`
**Current objective**: Continue low-risk structural cleanup in `discourse-sidebar-feed-panel.user.js`, with small validated steps. Avoid broad automated CSS rewrites.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.69`
- Latest completed pass reviewed and optimized code-review findings:
  - Added cached `getCsrfToken()` and `toAbsoluteSiteUrl()`.
  - Replaced hardcoded `https://linux.do` URL joins in avatar and middle-click topic open paths.
  - Replaced topic middle-click `mousedown`/`mouseup` handling with `auxclick`.
  - Extracted `getSidebarElement()` and replaced repeated `#d-sidebar` / `.sidebar-container` lookup sites.
  - Removed unused `_isDefaultFeedView()`, `_canFilterSidebarIncomingFromPayload()`, empty `.sfp-pinned` CSS rule, and `_topicListUrlHasPostNumber()`.
  - Simplified `_scrollTabIntoView()` to direct `scrollTo()`.
  - Made `_topicMatchesIncomingView()` reuse `_topicMatchesIncomingCandidate()`.
  - Added `_applyFilter()` default early return.
  - Extracted `_applyReadMarker()` and grouped read-state helpers near `_isTopicRead()` / `_hasUnreadMarker()`.
  - Optimized `_updateSettingsControl()` so same-mode settings panels sync state instead of rebuilding DOM.
  - Removed the ineffective `_getOrderedTabCategories()` filter while preserving behavior: saved tab order is prioritized and unsaved/new tabs still appear.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed, with only CRLF conversion warnings.
- Browser verification with `$agent-browser-cli` on linux.do tab `1047331194` (`https://linux.do/t/topic/2224562`) confirmed:
  - `.sfp-feed-container`, `.sfp-settings-wrap`, `.sfp-tab-bar`, and `.sfp-back-top-btn` are present.
  - `.sfp-tab-bar` `overflow-x` remains `auto`.
  - `.sfp-topic-stat .d-icon` count was nonzero (`111` at verification time).
- Browser verification reflects the currently installed userscript in the browser. Local metadata/code changes require reinstall/update before they run in-page.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files: `CLAUDE.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- `globalHelpTooltip` lifecycle is page-bound and does not need active cleanup.
- Avoid broad automated splitting/reformatting of `injectStyles()`. If CSS organization is needed, extract one small, explicitly named style block at a time and run `node --check` after each step.

## Open Questions / Risks

- `_isTopicRead()` remains intentionally defensive. Any future simplification must preserve read/unread filters and protected-topic local patching.
- RouteWatcher narrowing should continue to be watched during live route changes and sidebar regeneration.
- Incoming-topic state is improved but still spread across helper functions; keep future refactors behavior-preserving.

## Recommended Next Steps

1. Run another focused review of incoming refresh state helpers, one small slice at a time.
2. If changing route/sidebar behavior, verify on linux.do with `$agent-browser-cli` after reinstalling/updating the local userscript.
3. Consider only small CSS extraction candidates, such as loading/error styles, not the full `injectStyles()` block.

## Suggested Skills

- `$agent-browser-cli` for live linux.do verification.
- `/review` or `/simplify` for the next code-quality pass.
- `/diagnose` if a regression appears after refactoring.
