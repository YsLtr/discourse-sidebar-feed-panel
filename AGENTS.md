# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-11 17:55:28 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: Hide-pinned behavior has been reworked for latest-activity page-0 fetches; no active blocker is known.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`, userscript version now `2.1.0`.
- `隐藏置顶` moved out of the filter bar and into the Latest Activity settings panel:
  - setting key changed from `sfp_hide_pinned` to `sfp_activity_hide_pinned`, so it defaults unchecked and does not inherit old filter-bar state;
  - setting is only visible in the latest-activity view and toggling it calls `loadTopics()`.
- Hide-pinned logic is no longer part of `_applyFilter()` or `markTopicAsRead()`.
- Hide-pinned only applies when loading page 0 in latest activity:
  - `loadTopics()` fetches `rawTopics`, sets `topicPageSize = rawTopics.length`, then computes display `topics` via `_excludeTopReadPinnedTopics(rawTopics, requestQuery, 0)`;
  - `_refreshCurrentView()` also applies the same page-0 display裁切 before merging fetched topics;
  - `loadMoreTopics()` and incoming `fetchFeedTopicsByIds()` do not apply hide-pinned.
- `_excludeTopReadPinnedTopics()` scans only the top pinned block, keeps unread pinned topics, removes read pinned topics, and stops at the first non-pinned topic.
- `topicPageSize` is now determined by the raw page-0 response size in `loadTopics()` and is not updated by load-more, refresh merge, or incoming paths. Uses of page size now use `Math.max(1, topicPageSize)` instead of `topicPageSize || 30`.
- `renderTopics()` now calls `_renderPaginationFooter()` even when `allTopics.length === 0`, so a page that is emptied by hidden read-pinned topics still has the normal footer. Loading/error states are not globally forced to keep the normal footer.
- `todo.md` marks `优化隐藏置顶的逻辑` complete.

## Validation

- Static checks passed:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js todo.md`
- `git diff --check` only reports normal Windows LF-to-CRLF warnings for touched files.
- Live browser validation has not been rerun after the hide-pinned changes.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Feed Category Tabs are seeded from Discourse's category-list/navigation-like set, not every `site.json` top-level category by default.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count stays separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior unless a future fix proves it is directly involved.

## Known Risks / Open Questions

- User asked whether the footer is globally always shown. Current answer: normal `renderTopics()` and load-more states keep a footer or footer replacement; initial loading, initial load error, and abnormal missing-topic-list branches do not force the normal pagination footer.
- Manual verification is still useful:
  - Latest Activity settings should show `隐藏置顶`; other sort settings should not.
  - With hide-pinned enabled, page-0 latest activity should hide only read pinned topics inside the top pinned block while keeping unread pinned topics.
  - Load-more and incoming topics should not apply hide-pinned.
  - `topicPageSize` should reflect the raw page-0 response length, not the post-c裁切 display length.

## Concrete Next Steps

1. Reinstall/reload the userscript and manually test hide-pinned behavior on a live Discourse sidebar feed.
2. If the user wants a stricter global footer invariant, decide whether loading/error states should also preserve a footer area or whether current footer coverage is sufficient.
3. Re-run `node --check discourse-sidebar-feed-panel.user.js` and `git diff --check -- discourse-sidebar-feed-panel.user.js todo.md` after any follow-up edits.

## Suggested Skills

- `$agent-browser-cli` for live Discourse DOM inspection, settings-panel checks, clicks, screenshots, endpoint checks, and userscript menu/API validation.
- `$diagnose` for any site-specific layout, cache, scroll, page-size, or incoming-count regressions.
- `$handoff` again before ending the next session if further work remains.
