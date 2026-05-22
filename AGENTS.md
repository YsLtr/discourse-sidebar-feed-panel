# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-22 12:22 (+08:00)
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Branch**: `master`
**Current objective**: 继续做 `discourse-sidebar-feed-panel.user.js` 的低风险结构优化，优先小步验证；不要再大范围自动重写 CSS。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.67`
- Current tracked changes now include a state-grouping refactor and this handoff update.
- Completed in the latest pass:
  - Added shared site metadata loading via `loadSiteData()`, including preloaded page data and `/site.json` fallback.
  - Centralized category normalization in `_normalizeCategoryMeta()` and tag compatibility parsing in `_normalizeTagRecord()` / `_getTopTagsFromSiteData()`.
  - Updated tag style indexing to alias styles using top tags from preloaded/site data, inspired by fluxdo's string/object tag compatibility logic.
  - Extracted refresh/incoming merge-render behavior into `_mergeAndRenderTopics()`.
  - Added scroll listener lifecycle cleanup with `feedScrollAbortController`.
  - Extracted settings panel input helpers: `_bindCheckboxSetting()` and `_bindNumberSetting()`.
  - Changed `_getAutoLoadSessionKey()` to reuse `FeedQuery.key(FeedQuery.snapshot())`.
  - Hardened `formatRelativeTime()` against invalid/future dates.
  - Replaced topic stat emoji with Discourse SVG icon markup and added `.sfp-topic-stat .d-icon` sizing CSS.
  - Narrowed `RouteWatcher` mutation observation target to `#main-outlet` / `.d-header` before falling back to `document.body`.
  - Reworked `_getMessageBusLastId()` to avoid direct `callbacks` lookup and try safer candidate properties.
  - Grouped incoming-state globals into `sidebarIncomingState` and removed the back-to-top `scrollTop` fallback.
- Important recovery note: an attempted automatic split of `injectStyles()` temporarily removed/broke the CSS injection block. It has been restored, `function injectStyles()` exists again, and `node --check` passes.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed after the CSS recovery.
- `git diff --check -- AGENTS.md discourse-sidebar-feed-panel.user.js` passed, with only CRLF conversion warnings.
- Live browser verification was rerun on linux.do tab `1047331194` (`https://linux.do/t/topic/1838851`) and confirmed `.sfp-feed-container`, `.sfp-settings-wrap`, `.sfp-tab-bar`, topic stat icons, and back-to-top button were present. `overflow-x` on the tab bar remained `auto`.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files: `CLAUDE.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- `globalHelpTooltip` lifecycle is page-bound and does not need active cleanup.
- Avoid broad automated splitting/reformatting of `injectStyles()`. If CSS organization is still needed, extract one small, explicitly named style block at a time and run `node --check` after each step.

## Recommended Next Optimizations

1. Remove the back-to-top `scrollTo` fallback if targeting modern browsers only:
   - Current location: `_buildBackTopButton()` still has `typeof feedScrollEl.scrollTo === "function"` and `feedScrollEl.scrollTop = 0` fallback.
2. Review `_isTopicRead()` / `_hasUnreadMarker()` semantics carefully:
   - Current implementation is defensive, but `_hasUnreadMarker()` is just `!_isTopicRead(topic)`.
   - Any simplification must preserve read/unread filters and protected-topic patching.
3. Review `RouteWatcher` after narrowing:
   - Ensure Discourse sidebar regeneration is still caught after route transitions and layout changes.
4. Continue reducing state complexity in small slices:
   - Incoming-related globals are now grouped, but the state machine is still spread across helper functions.
   - Keep the next refactor small and behavior-preserving.
5. Consider small CSS extraction only if necessary:
   - Suggested first candidate: topic-stat icon sizing or loading/error styles, not the whole `injectStyles()` block.
6. Re-run live verification after every behavior-affecting change:
   - Use `$agent-browser-cli`; check `.sfp-feed-container`, settings panel, tab scrolling, load-more behavior, and topic stat icons.

## Suggested Skills

- `/review` or `/simplify` for the next code-quality pass.
- `$agent-browser-cli` for linux.do live verification.
- `/diagnose` if regressions appear after refactoring.
