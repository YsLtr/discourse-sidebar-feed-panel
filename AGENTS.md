# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-03 15:48:11 CST +0800
**Project root**: `/home/ysltr/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Preserve the incoming queue ordering/apply-window fix and continue live validation on linux.do.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `1.0.4`
- Latest incoming fix keeps accurate unique-topic counts while making apply order match the most recent message-bus events:
  - `sidebarIncomingState.topicIds` remains the full accumulated unique candidate list for count and cleanup.
  - `_touchSidebarIncomingTopicId()` moves a duplicate topic id to the queue tail instead of ignoring it, so repeated activity is treated as recent.
  - `topicCache` is refreshed on duplicate incoming payloads too.
  - `filteredTopicIds` remains the full filtered candidate list for display count.
  - `filteredLoadTopicIds` is a separate small apply list containing only the latest one page of filtered ids.
  - `_incomingLoadTopicLimit()` is fixed at `Math.max(1, topicPageSize || 30)`; loading more old resident topics must not enlarge the incoming refresh request.
  - `_applySidebarIncomingTopics()` still passes the full `incomingCandidateIds` to cleanup, so applying a one-page load clears all consumed queued candidates.
- `todo.md` has the incoming queue optimization marked done.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passes.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passes.
- Local simulations passed:
  - duplicate order example `1,2,3,2,4` becomes `[1,3,2,4]`, and a limit of 3 applies `[3,2,4]`;
  - queue `[1,3,4,5,2,6]` keeps count `6` while fixed one-page apply list with page size 3 is `[5,2,6]`;
  - the apply list remains bounded to one page, independent of resident window growth from loading older topics.
- Full live validation on linux.do is still pending after installing/updating the userscript to `1.0.4`.

## Constraints

- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- Do not reintroduce incoming queue compaction that caps the reminder count. If an upper bound is ever added, it must be treated as an explicit product tradeoff, not tied to resident topic count.
- Incoming apply should request only the latest one page of candidates; loading more resident history should not increase the apply request size.

## Known Risk

- The incoming order/apply-window fix has been statically and locally simulated, but not validated in a real linux.do browser session.
- Notification count may briefly include no-payload unknown ids until apply resolves them; this is intentional and should favor over-reporting rather than missing real incoming topics.
- If future work touches `_recomputeSidebarIncomingFilteredTopicIds()`, `_getSidebarIncomingLoadTopicIds()`, `_touchSidebarIncomingTopicId()`, or `_applySidebarIncomingTopics()`, preserve the distinction between full candidate count, latest-one-page detail load, and full candidate cleanup.

## Next Steps

1. Install/update the local userscript to `1.0.4`.
2. In linux.do, validate incoming behavior:
   - repeated incoming events for an existing topic move that topic into the latest apply window;
   - accumulating more than one page of incoming topics keeps the count increasing;
   - applying incoming topics fetches only the latest one page but clears all consumed candidates;
   - loading more old resident topics does not increase the incoming apply request size;
   - category-specific views still filter as expected.
3. Re-check the prior refresh/back-to-top animation, touch-scroll, and user-profile navigation cases if doing full live validation.

## Suggested Skills

- `$agent-browser-cli` for focused linux.do DOM/state checks.
- `$diagnose` if live incoming count/apply behavior still fails.
- `$handoff` again if more work remains.
