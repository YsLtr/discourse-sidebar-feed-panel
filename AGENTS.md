# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-06-01 22:34:00 CST +0800
**Project root**: `/home/ysltr/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Finish live validation after reinstalling/updating the userscript; current code also adds user-profile navigation from avatar/username/name.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.100`
- The touch-scroll fix is in place:
  - `.sfp-feed-scroll` now uses `overscroll-behavior-y: contain` and `touch-action: pan-y pinch-zoom`.
  - `isAtScrollBoundary(el, deltaY)` centralizes top/bottom boundary detection for wheel and touch paths.
  - `touchstart` / `touchmove` / `touchend` / `touchcancel` listeners track one primary touch point and call `preventDefault()` only when the feed scroll container is already at a vertical boundary.
  - Touch finger movement is inverted before boundary detection (`-deltaY`) because finger movement and `wheel.deltaY` have opposite direction semantics.
  - `touchmove` intentionally does not call `stopPropagation()`; the older wheel path still keeps its existing propagation stop.
- User/profile navigation update is also in place:
  - avatar, display name, and `@username` now jump to `/u/<username>`.
  - topic-row navigation still uses the existing SPA route-to logic.
  - helper functions now centralize path opening, pointer navigation, and topic `markTopicAsRead()` side effects.
  - middle-click on user-profile links opens the profile in a new tab without marking the topic as read.
- `docs/adr/0001-freeze-refresh-away-from-head.md` still applies. The away-from-head refresh model remains in force:
  - Header action button is still the only return-to-head affordance away from the head screen.
  - Incoming count still lives inside the header action button and applies only after returning to the true feed head.
  - Automatic refresh / silent refresh still pause away from true head and resume only at `scrollTop <= 1`.
  - Resident topic retention still stays page-depth based.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passes.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passes.
- `$agent-browser-cli` previously found an active linux.do tab and confirmed the feed panel DOM exists there.
- Full live validation is still pending because the browser must first load the updated `0.6.100` userscript. Do not claim a normal page refresh applies userscript metadata/code changes; reinstall/update in the userscript manager is required.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Known Risk

- The code fix has not yet been verified on a real touch interaction after installing `0.6.100`.
- The touch handler tracks a single primary touch point by design. This is enough for boundary overscroll protection, but it is not a full multi-touch gesture recognizer.
- Mouse hover/scrollbar jank appears less likely after the previous stabilization work; avoid speculative CSS state toggles on scroll unless there is measurement.
- User-profile click handling was refactored to share navigation helpers with topic-row clicks; re-check middle-click/read-state behavior if future changes touch that helper.

## Next Steps

1. Reinstall/update the local userscript to `0.6.100`.
2. In the existing linux.do tab or a focused new tab, verify with real touch or Chrome DevTools touch emulation that:
   - normal feed scrolling still works,
   - pulling down at the top no longer scrolls/overscrolls the page outside the feed,
   - pushing up at the bottom no longer scrolls/overscrolls the page outside the feed,
   - `.sfp-tab-bar` horizontal touch scrolling still works.
3. Verify user-profile clicks:
   - avatar/name/username open `/u/<username>`
   - middle-click opens a new tab
   - topic rows still mark read on normal activation, but user-profile links do not.
4. If live verification fails, inspect actual event direction/cancelability first before changing CSS or listener options.

## Suggested Skills

- `$agent-browser-cli` for focused linux.do DOM/state checks.
- `$diagnose` if the live touch repro still fails after installing `0.6.100`.
- `$handoff` again if more work remains.
