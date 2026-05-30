# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-31 00:20 (+08:00)
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Keep `discourse-sidebar-feed-panel.user.js` responsive over long sessions by bounding retained feed topics while preserving visible reading context.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.76`
- New domain glossary: `CONTEXT.md`
- Implemented Resident Topic / Refresh Trim / Automatic Refresh Gate work:
  - Added configurable `sfp_resident_topic_limit` setting, default `200`, range `50-1000`.
  - Added Refresh Trim after refresh-style merges; it trims tail Resident Topics after the protected prefix, cleans `loadedTopicIds`, and rebuilds `usersMap` from remaining first posters.
  - Switched load-more to consume Discourse `more_topics_url` via `nextTopicsUrl` instead of local page increment as the primary continuation.
  - After trim, continuation is deliberately realigned to an overlapping page so de-duplication avoids gaps.
  - Added incoming candidate compaction tied to the Resident Topic Limit; compacted ids can become fresh candidates again on later message-bus activity.
  - Added Automatic Refresh Gate for hidden/idle pages and windows larger than `residentTopicLimit * 3`; it skips automatic ticks only and does not affect user-clicked refresh.
- Review follow-up already addressed:
  - `_realignContinuationToResidentTail()` now only synthesizes a continuation when called with `{ allowSynthetic: true }`, used by Refresh Trim.
  - Dropped incoming ids no longer block future message-bus events from re-entering the pending queue.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- discourse-sidebar-feed-panel.user.js CONTEXT.md` passed.
- Browser/live linux.do verification is still pending after reinstalling or updating the userscript.

## Constraints

- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve existing tab/filter/period/scroll behavior, including the `0.6.21+` period behavior.
- Refresh Trim must preserve the current visible/hovered topic context and all Resident Topics above it.
- Automatic Refresh Gate must not mutate saved settings and must not block user-clicked refresh actions.
- Do not commit unrelated local reference files unless explicitly requested.

## Local Files

- `CONTEXT.md` is part of this work and should stay committed.
- `todo.md` is an existing untracked project note; it was not staged for this handoff commit.

## Open Questions / Risks

- Live verification needed for:
  - Small categories with no `more_topics_url` should not show a false load-more affordance.
  - Refresh after reaching the end should not reopen pagination unless trim actually created an overlapping continuation.
  - Low Resident Topic Limit values should trim tail topics without moving the current visible prefix.
  - Incoming candidate compaction should allow later activity on compacted ids to appear again.
- Continuation realignment still relies on Discourse page-based URLs, so it intentionally overlaps and de-duplicates rather than being a true cursor.

## Recommended Next Steps

1. Reinstall/update the local userscript.
2. Verify linux.do flows: load several pages, refresh, trim with a small limit, and continue loading older topics.
3. Verify incoming hint and 0-second silent refresh behavior during heavy message-bus activity.
4. If issues appear, inspect one path at a time: continuation realignment, Refresh Trim, or incoming candidate compaction.

## Suggested Skills

- `$agent-browser-cli` for live browser verification on linux.do.
- `/review` or `/diagnose` for any regression report.
