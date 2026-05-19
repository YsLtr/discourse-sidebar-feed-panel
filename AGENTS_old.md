# Handoff Archive

## 2026-05-19 08:10:15 +08:00 — archived from AGENTS.md

Reason: 新话题提醒和静默刷新大修已实现并由用户确认效果好；active handoff now shifts to dark-mode style drift around some components.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 07:15:17 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 下次处理与“新话题提醒”和“静默刷新”有关的超大修复。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.22`
- Latest commit: `42f27fe fix(feed): merge default into activity order`
- Validation before latest commit: `node --check discourse-sidebar-feed-panel.user.js` passed.
- Working tree after commit still has untracked handoff/reference files: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Removed the duplicated `默认` order option.
- Migrated old persisted `ORDER_KEY=default` to `activity`.
- Moved default-view affordances to `最新活动`: incoming-topic hint, incoming polling, and silent-refresh guard now use `currentOrder === "activity"`.
- Removed local `_sortTopicsForCurrentView()` entirely, so rendered topics keep the API return order; pinned topics are no longer forced to the top by the userscript.
- User confirmed the behavior is correct before commit.

## Important Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in the latest-activity default feed surface: all categories + `最新活动` order + all/read-state filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.
- Keep filter semantics, read/unread dot rendering, and local click read-state mutation aligned; avoid fixing only one visible surface.
- Preserve `0.6.21+` period behavior: `period=all` for ranked orders stays on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.

## Next Issue

User request for next session: “与 新话题提醒和静默刷新 有关的超大修复”.

Likely areas to inspect:

- `_updateShowMoreHint()` around the `.sfp-show-more-overlay` / `.sfp-hint-text` lifecycle.
- `_startNativeIncomingTracking()`, `_syncIncomingCountPollForView()`, `_startIncomingCountPoll()`, and `getTopicTrackingState()` usage.
- `_silentRefresh()` and `_applyNativeIncomingTopics()`; currently silent refresh fetches `trackingState.newIncoming` IDs, prepends fetched topics to `allTopics`, renders, clears native incoming, and updates the hint.
- `fetchFeedTopicsByIds(topicIds)` currently uses `/latest.json?topic_ids=...`.
- `_refreshCurrentView()` and `loadTopics()` both interact with `_clearNativeIncoming()` and hint updates.
- Settings UI around `AUTO_SILENT_REFRESH_KEY` / `.sfp-auto-silent-input`.

Known historical context:

- Earlier handoffs in `AGENTS_old.md` mention stale “xx 个新话题” counts, `topic-tracking-state`, `incomingCount`, `newIncoming`, `trackIncoming("latest")`, and the need to clear or replace native incoming state.
- The current userscript relies on Discourse’s global `service:topic-tracking-state`; this may not map cleanly to the sidebar’s independent category/order/filter state.
- The current “default feed view” means `all + activity + all filter`, not the removed `default` order.

Risks to inspect:

- Native incoming state may be route-scoped to the main page and not the sidebar’s current view.
- Clearing `trackingState.newIncoming` after sidebar refresh may affect the native page’s own show-more behavior.
- `_applyNativeIncomingTopics()` prepends incoming topics locally; verify whether this is still correct after removing local sorting and after user expects API order preservation.
- Silent refresh, manual refresh, auto refresh, incoming hint click, and settings toggle may now overlap; build a clear state machine before patching.

## Suggested Next Steps

1. Use `/diagnose` to define the desired behavior and build a repeatable browser loop for incoming count, hint visibility, click-to-apply, and auto silent refresh.
2. Use `$agent-browser-cli` on `https://linux.do/` with logged-in cookies to inspect:
   - `topic-tracking-state.incomingCount` and `newIncoming`,
   - `.sfp-show-more-overlay` visibility and text,
   - `allTopics` / `loadedTopicIds` if accessible,
   - network calls from hint click, silent refresh, manual refresh, and auto refresh.
3. Decide whether to keep using Discourse native incoming state or move to a userscript-local incoming queue.
4. If keeping native state, make clearing and rendering rules explicit and avoid stale hint counts.
5. If moving local, define how new IDs are discovered for `all + activity + all filter`, how category/order/filter views behave, and how it interacts with manual/auto refresh.
6. Run `node --check discourse-sidebar-feed-panel.user.js`; bump userscript version before asking the user to install/test.

## Suggested Skills

- `/diagnose` for the incoming/silent-refresh state machine.
- `$agent-browser-cli` for live linux.do DOM/service/network verification.
- `$handoff` when updating this active handoff again.
```

## 2026-05-19 07:15:17 +08:00 — archived from AGENTS.md

Reason: Default/latest-activity duplication and pinned-topic ordering were fixed, verified by the user, and committed as `42f27fe fix(feed): merge default into activity order`; active handoff now shifts to the large incoming-topic hint and silent-refresh repair.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 06:52:16 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 下次解决新问题：`默认` 和 `最新活动` 重复，以及置顶话题错误地不按顺序一直显示在顶部。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.21`
- Latest commits:
  - `4d05f96 fix(feed): keep all-period sorting on latest feed`
  - `78e14d1 fix(feed): honor period for top sorted lists`
  - `0b1f8c2 fix(sidebar): restore resize and contain feed wheel`
- Validation after latest edit: `node --check discourse-sidebar-feed-panel.user.js` passed.
- Working tree after latest commits still has untracked handoff/reference files: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Recent Findings And Decisions

- Date range filtering for `最多浏览` / `最多回复` / `最多点赞` / `楼主点赞` was diagnosed with `$agent-browser-cli` using logged-in linux.do cookies.
- Raw `latest.json?order=views/posts/likes/op_likes&period=...` ignores `period`; daily/weekly/monthly returned identical topic IDs.
- `top.json?period=...&order=views/posts/likes/op_likes` makes non-`all` date ranges effective.
- `0.6.21` behavior:
  - `period=all` stays on `/latest.json?order=...` to match native homepage/latest semantics and avoid introducing topics such as `242077`.
  - Non-`all` periods use `/top.json?period=...&order=...`.
- This is a temporary compromise. Discourse public JSON has no exact endpoint for “latest candidate set + sorted by period-scoped counts”.
- `楼主点赞` means OP/first-post likes (`op_likes` / `op_like_count`), not total topic likes.
- Closed-topic discrepancy is understood:
  - Many closed topics missing from top results are actually `archived: true`; `TopTopic.remove_invisible_topics` removes archived topics.
  - Non-archived old closed topics can also disappear from non-`all` top periods because `TopTopic.compute_top_score_for(period)` sets score to 0 when `topics.created_at < :from`, and `TopicQuery#list_top_for` requires score > 0.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in default view: all categories + default order + all filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.
- Keep filter semantics, read/unread dot rendering, and local click read-state mutation aligned; avoid fixing only one visible surface.

## Next Issue

User request for next session: “默认和最新活动重复，以及置顶话题错误的不按顺序一直显示在顶部。”

Likely code entry points:

- `_buildHeaderControls()` order options for `默认` vs `最新活动`.
- `fetchFeedTopics(order, period, page)` where `default` maps to `activity`.
- `_isDefaultFeedView()` and `_updateShowMoreHint()` if default semantics change.
- `renderTopics()` and `_sortTopicsForCurrentView()`; currently local rendering may reorder loaded topics after server order.
- `createTopicItem()` pinned rendering and `hidePinned` filtering.
- Discourse source references:
  - `lib/topic_query.rb`: `create_list`, `prioritize_pinned_topics`, `apply_ordering`, `latest_results`, `list_top_for`.
  - Native homepage URL to compare: `https://linux.do/?order=posts` or `https://linux.do/`.

Risks to inspect:

- `默认` may need to mean native Discourse default latest feed with pinned prioritization and incoming-topic behavior, while `最新活动` may need to be explicit `order=activity` without default-view affordances; currently both effectively request `activity`.
- Server-side Discourse may prioritize pinned topics only for default/activity lists; local `_sortTopicsForCurrentView()` may disturb native pinned ordering or keep pinned topics at the top across order modes where native does not.
- Pinned topics might be kept at top by server response, local sort, or both. Compare raw JSON order, native DOM order, and userscript DOM order before patching.
- Avoid regressing `0.6.21` date-range behavior and `period=all` latest semantics.

## Suggested Next Steps

1. Use `/diagnose` to build a repeatable comparison for default vs latest activity and pinned ordering.
2. Use `$agent-browser-cli` on linux.do with logged-in cookies to capture, for the same view:
   - raw JSON topic IDs and pinned flags,
   - native DOM topic IDs,
   - userscript `.sfp-topic-item` IDs after selecting `默认` / `最新活动` / other order modes.
3. Inspect Discourse `TopicQuery#create_list()` and `prioritize_pinned_topics()` to determine native pinned ordering rules for default/activity and sorted lists.
4. Patch the smallest place, likely order option semantics and/or local `_sortTopicsForCurrentView()`, so userscript order matches intended native behavior.
5. Run `node --check discourse-sidebar-feed-panel.user.js`; bump userscript version before asking the user to install/test.

## Suggested Skills

- `/diagnose` for reproducing and narrowing the ordering bug.
- `$agent-browser-cli` for live linux.do DOM/API comparison.
- `$handoff` when updating this active handoff again.
```

## 2026-05-19 06:52:16 +08:00 — archived from AGENTS.md

Reason: Date-range sorting behavior was diagnosed and temporarily fixed in `78e14d1` and `4d05f96`; active handoff now shifts to default/latest-activity duplication and pinned-topic ordering.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 06:00:03 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 下次解决困难问题：部分筛选项没有正确进行筛选。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.19`
- Latest commit: `0b1f8c2 fix(sidebar): restore resize and contain feed wheel`
- Validation before latest commit: `node --check discourse-sidebar-feed-panel.user.js` passed.
- User confirmed `0.6.19` fixed both sidebar resize-after-toggle and wheel-boundary scroll leakage after updating/reinstalling the userscript.
- Working tree after latest commit still has untracked handoff/reference files: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Recent Changes

- `setupResizer()` now clears stale `resizerEl` references when the current sidebar no longer contains them, and reuses or recreates the current `.sfp-resizer`.
- `activateFeed()` reapplies sidebar width and calls `setupResizer()` after creating the feed container.
- `RouteWatcher` now restores feed mode when the feed exists but the resizer is missing from the current sidebar.
- `_setupScrollLoadMore()` now contains `wheel` events at the feed scroll top/bottom so overscroll does not move the main content area.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in default view: all categories + default order + all filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.
- Keep filter semantics, read/unread dot rendering, and local click read-state mutation aligned; avoid fixing only one visible surface.

## Next Issue

User request for next session: “部分筛选项没有正确进行筛选。”

Likely code entry points:

- `_buildFilterBar()` for `全部` / `未读` / `已读` / `隐藏置顶` click handling and whether it calls `renderTopics()` or `loadTopics()`.
- `_applyFilter()` for actual local filtering predicates.
- `_isTopicRead()`, `_topicListUrl()`, `createTopicItem()`, and `markTopicAsRead()` for read/unread semantics and dot display.
- `renderTopics()`, `loadTopics()`, and `loadMoreTopics()` for whether filtered results are rendered from the intended `allTopics` set.

Risks to inspect:

- Some filters may be local-only while others reset pagination or re-fetch, causing visible results to diverge from expected loaded data.
- Read/unread classification has had several prior false starts; compare against actual linux.do DOM/API behavior instead of relying on one API field by memory.
- `hidePinned`, category tab, order, period, and read-state filter combinations may interact; test combinations, not only single toggles.
- Sparse filtered results may require pagination behavior from `0.6.18`; avoid regressing manual load, auto-load rate limiting, and empty-result messaging.

## Suggested Next Steps

1. Use `/diagnose` to define which “部分筛选项” fail and create a repeatable browser/API comparison loop.
2. Use `$agent-browser-cli` on `https://linux.do/` to capture: selected filter state, current `allTopics` sample fields if accessible, rendered DOM topic ids, dot/read UI, and any network requests on filter changes.
3. Inspect `_applyFilter()` and the click handlers in `_buildFilterBar()` to identify mismatches between filter state changes, local rendering, pagination reset, and API reloads.
4. Patch the smallest shared predicate/helper needed so filtering, dot rendering, and `markTopicAsRead()` agree.
5. Run `node --check discourse-sidebar-feed-panel.user.js`; bump userscript version before asking the user to install/test.

## Suggested Skills

- `/diagnose` for the filter correctness bug.
- `$agent-browser-cli` for live linux.do DOM/API/network verification.
- `$handoff` when updating this active handoff again.
```

## 2026-05-19 06:00:03 +08:00 — archived from AGENTS.md

Reason: Sidebar resize lifecycle and feed wheel boundary containment were fixed, verified by the user, and committed as `0b1f8c2 fix(sidebar): restore resize and contain feed wheel`; active handoff now shifts to filter correctness.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 05:40:56 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 下次解决两个交互问题：开关 Discourse 侧边栏后边框拖拽拉伸失效；侧边栏滚轮到边界后继续影响主页滚动。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.18`
- Latest commit: `c21f64b fix(feed): throttle filtered pagination loading`
- Validation before latest commit: `node --check discourse-sidebar-feed-panel.user.js` passed.
- User confirmed `0.6.18` pagination/filter loading behavior is effective and reasonable after updating/reinstalling the userscript.
- Working tree after latest commit still has untracked handoff/reference files: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Recent Changes

- `loadMoreTopics()` now accepts `{ source: "manual" | "auto" }`.
- Manual “加载更多” is never rate-limited and always restores the bottom footer while more pages may exist.
- Manual loads that fetch a page with no visible filtered topics show `下一页无符合条件的话题`.
- Scroll auto-load is limited to 3 requests per 5 seconds.
- Current filter session stops auto-loading after 3 consecutive auto loads with no visible filtered topics.
- Filter/session changes reset auto-load rate and empty-result state.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in default view: all categories + default order + all filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.

## Next Issue

User request for next session: “在开关侧边栏后边框拉伸失效，以及鼠标滚轮越界在主页生效。”

Likely code entry points:

- Resize behavior around feed container/resizer creation and teardown: search for `resizerEl`, `isResizing`, mouse/touch resize handlers, `DEFAULT_WIDTH`, `sfpSidebarWidth`.
- Sidebar activation/remount behavior: `activateFeed()`, `deactivateFeed()`, and `RouteWatcher`.
- Scroll containment: `feedScrollEl`, `_setupScrollLoadMore()`, wheel handling, and CSS overflow for the feed scroll area.

Risks to inspect:

- Reopening the native Discourse sidebar may leave stale resizer references or missing event listeners.
- Existing resize listeners may be bound once to an old DOM node and not rebound after sidebar remount.
- Wheel events at the top/bottom of the feed may bubble to the main page; likely need local wheel containment only when the sidebar feed can no longer scroll in that direction.
- Avoid breaking normal scrolling inside the sidebar and avoid blocking page scroll when pointer is outside the feed panel.

## Suggested Next Steps

1. Use `$agent-browser-cli` on `https://linux.do/` to reproduce both issues after toggling the native sidebar open/closed.
2. Inspect the resizer setup lifecycle and ensure activation/remount recreates `resizerEl` and binds drag handlers to the current DOM.
3. Add targeted wheel containment on `feedScrollEl`: when at top and scrolling up, or at bottom and scrolling down, prevent the event from propagating to the page.
4. Run `node --check discourse-sidebar-feed-panel.user.js`.
5. Bump userscript version before asking the user to install/test.

## Suggested Skills

- `$agent-browser-cli` for live DOM/event verification.
- `/diagnose` for reproducing and narrowing lifecycle/scroll event bugs.
- `$handoff` when updating this active handoff again.
```

## 2026-05-19 05:40:56 +08:00 — archived from AGENTS.md

Reason: Filtered pagination display and auto-load rate limiting were fixed, verified by the user, and committed as `c21f64b fix(feed): throttle filtered pagination loading`; active handoff now shifts to sidebar resize lifecycle and scroll boundary containment.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 05:12:51 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 下次解决筛选分页体验：筛选后内容不足一页时继续加载的显示问题，以及筛选结果超过一页时的加载速率限制。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.16`
- Latest commit: `ed5e927 fix(feed): filter read state locally`
- Validation before latest commit: `node --check discourse-sidebar-feed-panel.user.js` passed.
- User confirmed `0.6.16` behavior has taken effect after updating/reinstalling the userscript.
- Working tree after commit only has untracked handoff/reference files: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Recent Changes

- `_buildFilterBar()` no longer calls `loadTopics()` when switching `全部` / `未读` / `已读`.
- Read-state filter switches now update `currentFilter`, persist `FILTER_KEY`, call `_syncIncomingCountPollForView()`, update active UI state, then call local `renderTopics()`.
- `loadTopics()` still applies to real feed-source changes such as tab/category/order/period changes.
- Existing pagination behavior remains through `loadMoreTopics()` and `_setupScrollLoadMore()`.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in default view: all categories + default order + all filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.

## Next Issue

User request: “筛选内容不足一页时继续加载的显示问题，筛选内容超出一页的速率限制”.

Likely code entry points:

- `loadMoreTopics()` around the incremental append path. It currently appends only `_applyFilter(newTopics)` and recursively calls itself when `filteredNew.length === 0 && hasMorePages`.
- `renderTopics()` shows empty/current-page messages and always appends a “加载更多” footer when `hasMorePages`.
- `_checkAutoLoadOnSparseFilter()` exists but appears unused; it loads more when filtered count is `< 10`.
- `_setupScrollLoadMore()` debounces scroll and calls `loadMoreTopics()` near the bottom.

Risks to inspect:

- When filtered results are sparse, recursive `loadMoreTopics()` can create confusing loading/no-more display states or burst requests.
- When filtered results exceed one page, automatic or scroll-driven loading may need throttling/cooldown to avoid rapid chained requests.
- Need preserve the intended behavior: filter locally first, only fetch more when current loaded filtered content is not enough or user scrolls down.

## Suggested Next Steps

1. Use `/diagnose` to reproduce the sparse-filter display issue and request burst/rate behavior.
2. Inspect whether `_checkAutoLoadOnSparseFilter()` should be called after filter switches or replaced with a clearer helper.
3. Consider a bounded “ensure enough filtered items” loop with request limits/cooldown instead of unbounded recursion from `loadMoreTopics()`.
4. Verify with `$agent-browser-cli` on `https://linux.do/`: switching filters should not reload page 0, but should fetch later pages only as needed.
5. Run `node --check discourse-sidebar-feed-panel.user.js`; bump userscript version before asking the user to install/test.

## Suggested Skills

- `/diagnose` for the sparse pagination/loading behavior.
- `$agent-browser-cli` for live DOM/network verification and request-rate observation.
- `$handoff` when updating this active handoff again.
```

## 2026-05-19 05:12:51 +08:00 — archived from AGENTS.md

Reason: Read/unread/all filter switching reload behavior was fixed, verified by the user, and committed as `ed5e927 fix(feed): filter read state locally`; active handoff now shifts to sparse filtered pagination display and rate limiting.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 04:56:40 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 下次优先解决“已读/未读切换时重加载”的问题。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.15`
- Latest commit: `170095f fix(feed): refresh current view on auto refresh`
- Validation: `node --check discourse-sidebar-feed-panel.user.js` passed before commit.
- User confirmed the auto-refresh fix has taken effect after updating/reinstalling the userscript.
- Working tree after commit only has untracked handoff/reference files: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Recent Changes

- Auto refresh no longer calls `_silentRefresh()`; it now calls `_refreshCurrentView({ logPrefix: "auto refresh" })`.
- `_refreshCurrentView()` resets the auto-refresh countdown in `finally`, so manual refreshes also postpone the next automatic refresh.
- `_startAutoRefresh()` now uses `_resetAutoRefreshCountdown()` for timer startup and interval reset.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in default view: all categories + default order + all filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.

## Next Issue

Investigate and fix read/unread filter switching reload behavior.

Likely code entry points:

- `_buildFilterBar()` handles `全部` / `未读` / `已读` / `隐藏置顶` clicks.
- `_applyFilter()` applies `currentFilter` locally to `allTopics`.
- `loadTopics()` resets pagination, clears `allTopics`, clears `loadedTopicIds`, and fetches page 0.
- Earlier fix already made clicking the currently active filter return without reloading; the remaining issue may be that switching between `all`, `unseen`, and `read` should be local `renderTopics()` instead of full `loadTopics()`.

## Suggested Next Steps

1. Use `/diagnose` if reproducing the reload behavior needs a disciplined loop.
2. Inspect `_buildFilterBar()` and confirm which filter transitions call `loadTopics()`.
3. Decide whether read/unread/all switches should only update `currentFilter`, persist it, call `_syncIncomingCountPollForView()`, and `renderTopics()` against existing `allTopics`.
4. Verify behavior with `$agent-browser-cli` on `https://linux.do/`: switching `全部` / `未读` / `已读` should not issue a fresh `/latest.json` request if the intended behavior is local filtering.
5. Run `node --check discourse-sidebar-feed-panel.user.js`; bump userscript version before asking the user to install/test.

## Suggested Skills

- `$agent-browser-cli` for live DOM/network verification.
- `/diagnose` for the reload bug.
- `$handoff` when updating this active handoff again.
```

## 2026-05-19 04:56:40 +08:00 — archived from AGENTS.md

Reason: Auto refresh fix has been verified by the user and committed; active handoff now shifts to the next issue, read/unread filter switching causing reloads.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 04:35:17 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 当前优化已提交；下次主要是按用户反馈继续验证或清理交接/未跟踪文件。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.13`
- Latest commits:
  - `be09d73 perf(feed): stop incoming poll outside default view`
  - `4404993 fix(feed): restore feed mode after sidebar remount`
  - `2dd485a fix(feed): collapse incoming hint spacing when hidden`
  - `b096aae fix(feed): refine incoming topics hint layout`
  - `9f14f76 fix(feed): improve incoming topics hint display and data sync`
- `node --check discourse-sidebar-feed-panel.user.js` passed after the latest change.
- Working tree after latest commit only has untracked files: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## What Changed Recently

- Incoming-topic count polling now only runs in the default feed view: all categories + default order + all filter.
- `_syncIncomingCountPollForView()` is called when activating/remounting feed mode and when changing order, tab, or read filter.
- Non-default views stop `incomingCountPollTimer` and clear the incoming-topic overlay/spacing immediately.
- The interval callback has a fallback guard that stops polling if the view becomes non-default by another path.
- Temporary `[SFP poll]` console logs were added for user verification, confirmed working by the user, then removed before commit.

## Browser Verification

- User reinstalled/updated the userscript and confirmed the temporary console logs showed expected behavior.
- Earlier `$agent-browser-cli` verification on `https://linux.do/` confirmed:
  - Switching to `未读` removed `.sfp-show-more-overlay`, removed `.sfp-has-show-more`, and reset list top padding to `0px`.
  - Switching category and non-default sort removed the hint/spacing.
  - Closing/reopening the Discourse sidebar restored feed mode automatically.

## Important Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in default view: all categories + default order + all filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.

## Next Steps

1. If the user reports a regression, use `$agent-browser-cli` for live DOM/browser verification.
2. If the incoming/remount bug persists after reinstalling the updated userscript, use `/diagnose`.
3. If asked to clean repository state, clarify whether to keep or remove the untracked handoff/reference files before touching them.

## Suggested Skills

- `$agent-browser-cli` for live linux.do verification.
- `/diagnose` if a bug persists after reinstalling the latest userscript.
- `$handoff` when updating this active handoff again.
```

## 2026-05-19 04:35:17 +08:00 — archived from AGENTS.md

Reason: Latest polling optimization has been verified and committed; previous active handoff focused on pre-version-bump installation/testing steps and is superseded.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 04:08:09 +08:00  
**Project root**: `C:/Users/28676/builds/discourse/userscript`  
**Current objective**: 当前修复已提交；下次优先更新 userscript 版本号并让用户重新安装验证。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.11`
- Latest commits:
  - `4404993 fix(feed): restore feed mode after sidebar remount`
  - `2dd485a fix(feed): collapse incoming hint spacing when hidden`
  - `b096aae fix(feed): refine incoming topics hint layout`
  - `9f14f76 fix(feed): improve incoming topics hint display and data sync`
- `node --check discourse-sidebar-feed-panel.user.js` passed before `4404993`.
- Working tree after latest commit only had untracked files, including `CLAUDE.md` and `CLAUDE_old.md` from handoff updates.

## What changed recently

- New-topic hint now uses a smaller native-like capsule: absolute overlay, half-height list padding, and compact typography.
- When incoming count becomes `0`, `_updateShowMoreHint()` removes `.sfp-has-show-more`, so the top spacing collapses.
- `activateFeed()` is now idempotent for sidebar remounts: if the existing feed container is still in the active sidebar it reapplies feed mode; if stale, it clears references and rebuilds.
- `RouteWatcher` now detects feed mode while sidebar DOM/class is missing and calls `activateFeed()` to restore without toggling the script off/on.

## Important constraints

- Do not commit unrelated untracked files unless explicitly requested: `AGENTS.md`, `AGENTS_old.md`, `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- New-topic hint should only appear in default view: all categories + default order + all filter.
- Do not claim a page refresh applies userscript changes; user must reinstall/update the userscript for modified metadata/code to take effect.

## Next steps

1. Update `// @version` in `discourse-sidebar-feed-panel.user.js` from `0.6.11` to the next patch version before asking the user to install/test.
2. Run `node --check discourse-sidebar-feed-panel.user.js` after version bump.
3. Commit only `discourse-sidebar-feed-panel.user.js` if the user asks for a version-bump commit.
4. Ask the user to reinstall/update the userscript, then verify:
   - new-topic capsule layout and click behavior;
   - count reset collapses spacing;
   - closing/reopening Discourse sidebar restores feed mode automatically.

## Suggested tools/skills

- `$agent-browser-cli` for real DOM/browser verification if available.
- `/diagnose` only if the remount bug persists after reinstalling the updated userscript.
```

## 2026-05-18 12:45:34 +08:00 — archived from AGENTS.md

Reason: User requested `$handoff` after a severe regression in the latest new/updated-topic overlay styling. The previous active handoff is outdated for startup; preserving its key content here for traceability.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-18 11:45:06 +08:00  
**Current focus**: 继续解决 `sfp-feed-header` 里的 `.sfp-hint-text` / “xx 个新话题”提示。用户已确认刷新重新渲染和新增高亮问题已解决。  
**Project root**: `C:/Users/28676/Documents/Program/Discourse/userscript`

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.11`
- Local Discourse source available under sibling path: `../discourse`
- Working tree is dirty: `discourse-sidebar-feed-panel.user.js` modified; `AGENTS.md`, `AGENTS_old.md`, reference scripts are untracked.
- Latest validation: `node --check userscript\discourse-sidebar-feed-panel.user.js` passed after refresh/highlight changes.

## Solved Recently

- 手动刷新不再调用 `loadTopics()`，改为 `refreshCurrentView()`.
- 手动刷新和静默刷新现在共用 `_refreshCurrentView()`:
  - 不清空 `allTopics` / `loadedTopicIds`
  - 用旧 `loadedTopicIds` 判断新增话题
  - `renderTopics(newTopicIds)` 触发 `.sfp-new-highlight`
  - `isRefreshing` 防止并发刷新
- 点击当前已激活的 tab/filter 时直接 return，不再无意义触发 `loadTopics()`.

## Current Finding: “xx 个新话题” 来源

- `.sfp-hint-text` 创建于 `_updateShowMoreHint(header)`，约 `discourse-sidebar-feed-panel.user.js:1217`.
- 计数来自 Discourse 全局服务：
  - `const trackingState = Discourse.__container__.lookup("service:topic-tracking-state")`
  - `const newCount = trackingState.incomingCount || 0`
  - `hint.textContent = `${newCount} 个新话题`;`
- 这不是 userscript 从 `/latest.json` 或当前 `freshTopics` 自己算出来的。
- Discourse 源码位置: `../discourse/frontend/discourse/app/models/topic-tracking-state.js`
  - `incomingCount` 是 tracked 字段。
  - `notifyIncoming()` 收到 MessageBus 的 `new_topic` / `unread` / `latest` 等消息后调用 `_addIncoming(topic_id)`，再设置 `incomingCount = newIncoming.length`.
  - `trackIncoming(filter)` 由 Discourse topic-list/topic route 调用，用当前路由 filter 决定哪些消息计入 incoming.
  - 原生列表点击 show-more 会 `clearIncoming(topicIds)` 或 `resetTracking()`；当前 userscript 只读 `incomingCount`，刷新后没有清理已被侧边栏拉进来的 incoming ids。

## Likely Problem

`sfp-hint-text` 使用的是 Discourse 当前主页面/路由的全局 incoming 状态，而侧边栏 feed 有自己的 tab/filter/order 和刷新逻辑。手动/静默刷新把新话题渲染进侧边栏后，如果不调用 `trackingState.clearIncoming(newTopicIds)` 或改为本地计数，header 仍可能显示旧的 “xx 个新话题”。

Also note `_updateShowMoreHint()` currently only removes an existing hint when not in default sidebar view. If default view remains active and `incomingCount` becomes `0`, it does not remove an existing `.sfp-hint-text`.

## Key Code Locations

- `_buildHeaderControls()` around `1025`: initial `_updateShowMoreHint(header)`.
- `_updateShowMoreHint(header)` around `1217-1241`: creates/removes `.sfp-hint-text`.
- `_refreshCurrentView()` around `1397-1431`: currently calls `_updateShowMoreHint(feedHeaderEl)` after render.
- URL change watcher around `1820-1830`: calls `_updateShowMoreHint(feedHeaderEl)`.
- Discourse tracker: `../discourse/frontend/discourse/app/models/topic-tracking-state.js`, especially `notifyIncoming`, `resetTracking`, `clearIncoming`, `trackIncoming`, `_addIncoming`.

## Suggested Next Steps

1. Decide intended behavior:
   - Option A: Keep using Discourse `incomingCount`, but after `_refreshCurrentView()` renders `newTopicIds`, call `trackingState.clearIncoming(newTopicIds)` and make `_updateShowMoreHint()` remove the hint when count is `0`.
   - Option B: Stop reading Discourse `incomingCount`; maintain a userscript-local incoming set based on topics absent from `loadedTopicIds`.
2. Patch `_updateShowMoreHint()` so stale hints are always removed before deciding whether to append a new one.
3. If using Option A, add a helper to lookup the tracker and clear incoming IDs after successful refresh.
4. Re-run `node --check userscript\discourse-sidebar-feed-panel.user.js`.
5. Browser-check with `$agent-browser-cli`: after manual refresh pulls highlighted new topics, verify `.sfp-hint-text` disappears or count decreases.

## Suggested Skills

- `$diagnose` for the bug loop.
- `$agent-browser-cli` for live linux.do DOM/service verification.
- `$handoff` only when updating this file for the next session.
```

## 2026-05-18 11:45:06 +08:00 — archived from AGENTS.md

Reason: 刷新重新渲染和新增高亮问题已由 `refreshCurrentView()` / `_refreshCurrentView()` 解决；当前焦点切换到 `.sfp-hint-text` 的 “xx 个新话题” 来源与清理问题。

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-18 11:31:50 +08:00  
**Current focus**: 隐藏置顶问题已解决；下一步解决刷新后新内容没有正确高亮，以及筛选条件没有变化时不应调用 `loadTopics()`。  
**Project root**: `C:/Users/28676/Documents/Program/Discourse/userscript`

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version: `0.6.11`
- Reference script: `LINUX DO Timeline-1.29.1.user.js`
- Browser verification tool: `$agent-browser-cli` / `agent-browser-cli`
- Working tree is dirty: `discourse-sidebar-feed-panel.user.js` modified; `AGENTS.md`, `AGENTS_old.md`, reference scripts are untracked.

## Solved Recently

- 未读/已读判定已按用户确认规则处理: 首页标题链接不带楼层号 = 未读，带楼层号 = 已读。
- 静默刷新污染已处理: `_silentRefresh()` fetches current view params, syncs `allTopics` / `loadedTopicIds`, then calls `renderTopics(newTopicIds)`.
- Duplicate “加载更多” after empty filtered state was fixed.
- “隐藏置顶” wrong re-request fixed in `_buildFilterBar()`:
  - `hide-pinned` now toggles `hidePinned`, saves `HIDE_PINNED_KEY`, calls `renderTopics()`, then `return`.
  - It no longer falls through to `loadTopics()`, so it does not reset pagination or refetch.
- Validation after hiding-pinned fix: `node --check discourse-sidebar-feed-panel.user.js` passed. `git diff --check` only reported LF/CRLF warning.

## Open Problems

1. 刷新获取到的新内容没有正确高亮。
   - `_silentRefresh()` currently builds `newTopicIds` only for topics absent from `loadedTopicIds`, then calls `renderTopics(newTopicIds)`.
   - `renderTopics(newTopicIds)` passes `newTopicIds.includes(topic.id)` into `createTopicItem()`, which should add `.sfp-new-highlight`.
   - Need inspect why this is not visible after refresh. Possible causes: sort/re-render changes position, `newTopicIds` type mismatch, CSS animation/class timing, new topics filtered out, or fresh topics already marked in `loadedTopicIds`.

2. 筛选条件没有变化时不应调用 `loadTopics()`.
   - `_buildFilterBar()` still calls `loadTopics()` for `all` / `unseen` / `read` after every click, even when `currentFilter` already equals the clicked filter.
   - User intent: if filter state does not change, do not reload.
   - Consider applying the same guard pattern to other controls if they already reload on no-op selection: tab/order/period may have similar behavior, but keep scope tight unless code inspection shows the same bug.

## Key Code Locations

- `_buildFilterBar()` around lines 1144-1194: filter clicks, hide-pinned local render, all/unseen/read reload path.
- `_silentRefresh()` around lines 1394-1436: fetches refreshed topics, builds `newTopicIds`, calls `renderTopics(newTopicIds)`.
- `renderTopics(newTopicIds = [])` around lines 1465-1514: clears DOM and recreates items, passes highlight flag.
- `createTopicItem(topic, isNew)` around line 1600+: applies `.sfp-new-highlight`.
- CSS for `.sfp-new-highlight` near the style block; inspect animation/background duration if highlight class is added but invisible.

## Suggested Next Steps

1. Inspect CSS and `createTopicItem()` highlight behavior; verify `.sfp-new-highlight` is actually present after `_silentRefresh()`.
2. Use `agent-browser-cli` if possible to force or observe a silent refresh and compare:
   - `newTopicIds`
   - DOM items with `.sfp-new-highlight`
   - visible highlight style
   - whether IDs were already in `loadedTopicIds`
3. Patch no-op filter clicks in `_buildFilterBar()`:
   - If clicked filter equals `currentFilter`, return before `GM_setValue()` and `loadTopics()`.
   - Keep `hide-pinned` behavior as local `renderTopics()` because toggling it is a real state change.
4. Re-run `node --check discourse-sidebar-feed-panel.user.js`.
5. Browser-check: refresh/highlight behavior, repeated clicks on active filters, and no unnecessary network requests when filter state is unchanged.

## Suggested Skills

- `$agent-browser-cli` for live linux.do DOM/network verification.
- `$handoff` only when updating this file for the next session.
```

## 2026-05-18 11:31:50 +08:00 — archived from AGENTS.md

Reason: “隐藏置顶” wrong re-request behavior is solved; next focus is refresh highlight correctness and avoiding no-op `loadTopics()` calls.

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-18 11:24:28 +08:00  
**Current focus**: 未读/已读问题已按用户定义解决；下一步解决“隐藏置顶”的错误重新请求问题。  
**Project root**: `C:/Users/28676/Documents/Program/Discourse/userscript`

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version: `0.6.10`
- Reference script: `LINUX DO Timeline-1.29.1.user.js`
- Browser verification tool: `$agent-browser-cli` / `agent-browser-cli`
- Working tree is dirty: `discourse-sidebar-feed-panel.user.js` modified; `AGENTS.md`, `AGENTS_old.md`, reference scripts are untracked.

## Solved In This Session

- 静默刷新污染已处理: `_silentRefresh()` now fetches current view params, syncs `allTopics` / `loadedTopicIds`, then calls `renderTopics()`.
- Duplicate “加载更多” after “当前页暂无未读话题” fixed: empty-filter branch no longer appends its own load-more control.
- 未读/已读最终采用用户确认规则: build the same topic-list URL pattern as the homepage.
  - `_topicListUrl(topic)` returns `/t/<slug>/<id>` when there is no `last_read_post_number`.
  - `_topicListUrl(topic)` returns `/t/<slug>/<id>/<postNumber>` when `last_read_post_number` exists.
  - `_isTopicRead(topic)` is true iff the generated homepage title URL contains the trailing post number.
  - Click handlers save the target URL before `markTopicAsRead()` mutates local read state.
- Validation run after latest change: `node --check discourse-sidebar-feed-panel.user.js` passed. `git diff --check` only reported LF/CRLF warning.

## Open Problem

Next task: fix the “隐藏置顶” wrong re-request behavior.

Known entry points:

- `HIDE_PINNED_KEY` and initial `hidePinned`: lines near 29 and 43.
- Filter bar toggle: `_buildFilterBar()` around lines 1168-1191.
- Current behavior: clicking “隐藏置顶” toggles `hidePinned`, saves GM value, then calls `loadTopics()`.
- Filtering itself is local in `_applyFilter()` around line 1585: `result = result.filter((t) => !t.pinned && !t.pinned_globally)`.

Likely issue to investigate:

- “隐藏置顶” is a local display filter and probably should call `renderTopics()` instead of resetting pagination and re-fetching with `loadTopics()`.
- Need confirm user-visible bug: whether it causes unnecessary API request, wrong page reset, stale ordering, or losing loaded pages.

## Suggested Next Steps

1. Reproduce with browser dev/network or `agent-browser-cli`: toggle “隐藏置顶” and observe whether `/latest.json` or category JSON is requested unnecessarily.
2. Patch `_buildFilterBar()` so `hide-pinned` only updates local state and re-renders existing `allTopics`; do not reset `currentPage`, `loadedTopicIds`, or fetch.
3. Ensure other filters (`全部/未读/已读`) still use the intended behavior. They may also be candidates for local `renderTopics()` because `_applyFilter()` is client-side, but keep scope to “隐藏置顶” unless evidence says otherwise.
4. Re-run `node --check discourse-sidebar-feed-panel.user.js`.
5. Browser-check: toggle “隐藏置顶” on/off on default and category tabs; verify no duplicate load-more controls, no unnecessary request, and item order remains stable.

## Suggested Skills

- `$agent-browser-cli` for live browser/API/network behavior.
- `$handoff` only when updating this file for the next session.
```

## 2026-05-18 11:24:28 +08:00 — archived from AGENTS.md

Reason: 未读/已读判定已按用户确认的人类规则解决；下一阶段焦点切换到“隐藏置顶”的错误重新请求问题。

```markdown
# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-18 10:56:49 +08:00  
**Current focus**: 静默刷新污染已解决；下一步解决未读/已读筛选不准的问题。  
**Project root**: `C:/Users/28676/Documents/Program/Discourse/userscript`

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Reference script: `LINUX DO Timeline-1.29.1.user.js`
- Browser verification tool: use `$agent-browser-cli` / `agent-browser-cli`
- Current script version: `0.6.6`
- Git status before handoff: `discourse-sidebar-feed-panel.user.js` modified; `AGENTS.md`, `AGENTS_old.md`, reference scripts are untracked.

## What Is Solved

静默刷新污染已处理 in `discourse-sidebar-feed-panel.user.js`:

- `_silentRefresh()` now fetches with the current view params, syncs `allTopics` / `loadedTopicIds`, then calls `renderTopics()`.
- Removed `_silentInsertedIds` and `_updateExistingTopicItems`.
- `renderTopics()` now sorts by current order mode: `created` uses `created_at`, `default/activity` use activity time, ranking orders preserve API order.
- Validation run: `node --check discourse-sidebar-feed-panel.user.js` passed. `git diff --check` only reported LF/CRLF warnings.

## Open Problem

未读/已读筛选仍需要诊断和修复。

Known context:

- User says the real unread marker is the blue dot next to the first post after entering a topic.
- Current implementation uses `topic.unread_posts > 0` for unread and `!topic.unread_posts || topic.unread_posts === 0` for read in `_applyFilter()`.
- Previous attempts failed or were unreliable:
  - `last_read_post_number >= highest_post_number` misclassified dismissed topics.
  - `new_posts > 0` did not match page title row behavior.
  - `unread` boolean is unreliable and often `0`.
- User reported “显示的内容明显和请求返回的内容不一致”; confirm whether this is still true after `v0.6.6` sorting/refresh fixes, because stale DOM pollution may have masked the read-state issue.

## Key Code Locations

- `_applyFilter()` around line 1565: unread/read filter logic.
- `createTopicItem()` around line 1587: unread dot rendering via `topic.unread_posts > 0`.
- `markTopicAsRead()` around line 1699: local click handling sets `topic.unread_posts = 0`.
- `loadTopics()` around line 1275 and `loadMoreTopics()` around line 1324: API fetch and data population.
- `_sortTopicsForCurrentView()` around line 1521: new sort helper added in `v0.6.6`.

## Recommended Next Steps

1. Reload the userscript/page so `v0.6.6` is actually running in the browser.
2. With `agent-browser-cli`, collect a small table from:
   - current feed DOM item ids and dot presence,
   - `/latest.json` or current category API fields for the same ids,
   - actual topic page DOM blue-dot/read state for several sample ids.
3. Determine the correct Discourse API field for the user-visible blue dot. Candidate fields to compare: `unread_posts`, `new_posts`, `highest_post_number`, `last_read_post_number`, `seen`, `unseen`.
4. Patch `_applyFilter()`, `createTopicItem()`, and `markTopicAsRead()` together so filter semantics and dot rendering use the same predicate.
5. Re-run `node --check discourse-sidebar-feed-panel.user.js` and browser-check DOM/API consistency after switching 全部 / 未读 / 已读.

## Suggested Skills

- `$agent-browser-cli` for live linux.do API/DOM comparison.
- `$handoff` only when updating this file for the next session.
```

## 2026-05-18 10:56:49 +08:00 — archived from AGENTS.md

Reason: 静默刷新污染已解决，下一阶段焦点切换到未读/已读筛选诊断；保留旧 handoff 原文作历史追踪。

```markdown
# Discourse Sidebar Feed Panel — Handoff

## 当前状态

**时间**: 2026-05-18  
**版本**: v0.6.6（已修复静默刷新污染的主要数据/DOM 分叉点）  
**文件**: `discourse-sidebar-feed-panel.user.js`（1827 行）  
**参考脚本**: `LINUX DO Timeline-1.29.1.user.js`

## 核心目标

将 linux.do 侧边栏改造为信息流面板，支持：板块分类 Tab、排序切换、已读/未读筛选、静默自动刷新、无限滚动加载。

## 当前未解决的问题

### 1. 未读/已读筛选仍不正确
- 用户指出：真正的未读标志是**进入帖子后第一条右边的蓝点**（`unread_posts > 0`），消失后才是已读
- `v0.6.5 cf06e02` 已改用 `unread_posts > 0` 做未读判断（替代 `last_read_post_number`），但用户表示"显示的内容明显和请求返回的内容不一致"
- `unread` 布尔字段在 API 中始终为 0，完全不可靠
- 可能需要直接在浏览器中打开具体分类页面对比 API 返回值和页面 DOM 来诊断

### 2. 静默刷新内容混乱
- 用户说"静默更新内容混乱插入，无法做到结构清晰"
- `v0.6.5 26d5e29` 做了数据/视图分离重构：  
  - `_silentRefresh` 改为纯 DOM 操作，不修改 `allTopics`/`loadedTopicIds`
  - 固定用 `order=created`（参照 Timeline 脚本）
  - 新话题用 `_silentInsertedIds` 独立追踪
- 但用户说"还是未解决"
- `v0.6.6` 已撤销纯 DOM 静默插入：
  - `_silentRefresh` 改为请求当前视图参数，同步 `allTopics`/`loadedTopicIds` 后统一 `renderTopics()`
  - 移除 `_silentInsertedIds` 和 `_updateExistingTopicItems`
  - `renderTopics()` 改为按当前排序模式排序，`created` 不再被 `bumped_at` 二次打乱

### 3. 之前尝试过的方案（均已失败）
- `last_read_post_number >= highest_post_number` → 误判大量 dismissed 话题为未读
- `new_posts > 0` → 与页面 gray/white title 行为不一致
- `unread_posts > 0` → 当前方案，用户仍不满意
- `isLoading` 守卫导致竞态 → 已用 `_pendingReload` 修复
- `_buildCustomSelect` selectedValue 不更新 → 已用 `_currentSelected` 修复

## 架构（v0.6.5 最终状态）

```
数据层（仅由 loadTopics/loadMoreTopics 修改）:
  allTopics[], loadedTopicIds (Set), _silentInsertedIds (Set)

视图层:
  renderTopics()     → 全量重建 DOM（innerHTML 清空 + 逐个 appendChild）
  _silentRefresh()   → 增量 DOM（insertBefore 顶部 + 更新已有项的 dot/回复数）
  loadMoreTopics()   → 底部追加（filtered appendChild）

用户操作 → 数据流:
  激活面板     → loadTopics() → 全量渲染 + _startAutoRefresh()
  切换筛选/排序 → loadTopics() → 清除 _silentInsertedIds + 全量渲染
  刷新按钮     → loadTopics()
  滚轮加载     → loadMoreTopics() → 追加 allTopics + 追加 DOM
  60s 定时器   → _silentRefresh() → 仅 DOM 更新（不碰数据源）
```

## 关键代码位置

| 函数 | 行号 | 说明 |
|------|------|------|
| `_applyFilter` | ~1584 | 未读/已读筛选逻辑 |
| `_silentRefresh` | ~1398 | 静默刷新（纯 DOM） |
| `loadTopics` | ~1281 | 全量数据加载 |
| `loadMoreTopics` | ~1335 | 追加加载 |
| `renderTopics` | ~1510 | 全量 DOM 渲染 |
| `createTopicItem` | ~1607 | 创建话题 DOM |
| `_buildFilterBar` | ~1141 | 筛选栏（全部/未读/已读） |
| `_buildCustomSelect` | ~1032 | 下拉组件（排序/周期） |
| `_buildTabBar` | ~1094 | 分类标签栏 |

## 下一步建议

1. **用 agent-browser-cli** 在浏览器中实际对比 API 返回的 `unread_posts` 值和页面 DOM 的未读状态，确认筛选逻辑与页面行为完全一致
2. **重新审视 Timeline 脚本**（`LINUX DO Timeline-1.29.1.user.js`）的筛选逻辑，特别是其 `loadTimelineTopics` 的 silent 参数如何协调数据层和视图层
3. **考虑简化**：也许不需要三个筛选状态（全部/未读/已读），可以先只做"未读"（蓝点）和"全部"两种
4. **静默刷新**：考虑完全移除 DOM 插入，改为仅更新 header 的"新话题"提示计数，让用户手动刷新来获取
```
