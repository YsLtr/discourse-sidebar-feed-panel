# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-02 19:13:56 CST +0800
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: Preserve the incoming notification queue fix and continue live validation on linux.do.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `1.0.2`
- Latest fix separates incoming notification counting from resident topic loading:
  - `sidebarIncomingState.topicIds` now keeps the full accumulated incoming candidate list so the reminder count no longer caps at 30/60.
  - `_getSidebarIncomingLoadTopicIds()` limits only the actual `/latest.json?topic_ids=...` load to the latest resident window.
  - Applying incoming topics fetches only the latest page/window, but passes the full `incomingCandidateIds` set to cleanup so older queued ids are discarded after the apply action.
  - Incoming ids with no message-bus payload are allowed through the coarse filter so they can be resolved by `/latest.json?topic_ids=...` and then cleaned up.
  - Removed the old `droppedTopicIds`/`droppedTopicIdSet` compaction state because it was the source of the count cap.
- User clarified that category-specific views use category-specific message subscriptions, so unknown-payload ids should not normally include other categories.
- Existing refresh/back-to-top, touch-scroll, and user-profile navigation changes remain in place.
- `.gitignore` was changed to allow `AGENTS.md` and `CLAUDE.md` to be tracked; `CLAUDE.md` contains `@AGENTS.md`.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passes.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passes with only the Windows LF-to-CRLF warning.
- Local simulations passed:
  - 90 incoming ids produce count 90 while actual load is limited to the latest resident window.
  - no-payload ids are included in filtered candidates for later detail fetch.
  - applying 90 candidates with a one-page resident window loads latest 30 (`61..90`) and removes all 90 candidates.
- Full live validation in linux.do is still pending after installing/updating the userscript to `1.0.2`.

## Constraints

- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- Do not reintroduce incoming queue compaction that caps the reminder count. If an upper bound is ever added, it must be treated as an explicit product tradeoff, not tied to resident topic count.

## Known Risk

- The incoming count/apply fix has been statically and locally simulated, but not validated in a real linux.do browser session.
- Notification count may briefly include no-payload unknown ids until apply resolves them; this is intentional and should favor over-reporting rather than missing real incoming topics.
- If future work touches `_recomputeSidebarIncomingFilteredTopicIds()`, `_getSidebarIncomingLoadTopicIds()`, or `_applySidebarIncomingTopics()`, preserve the distinction between full candidate count, limited detail load, and full candidate cleanup.

## Next Steps

1. Install/update the local userscript to `1.0.2`.
2. In linux.do, validate incoming behavior:
   - accumulate more than 30/60 incoming topics while away from the head and confirm the count continues increasing,
   - click/apply incoming topics and confirm only the latest resident window is inserted,
   - confirm the queued count clears after apply because all consumed candidates are discarded,
   - validate a category-specific view if possible.
3. Re-check the prior refresh/back-to-top animation, touch-scroll, and user-profile navigation cases if doing full live validation.

## Suggested Skills

- `$agent-browser-cli` for focused linux.do DOM/state checks.
- `$diagnose` if live incoming count/apply behavior still fails.
- `$handoff` again if more work remains.
