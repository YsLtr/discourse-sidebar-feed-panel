# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-06-01 21:50:52 CST +0800
**Project root**: `/home/ysltr/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Fix the touch-scroll overshoot / out-of-bounds issue without regressing the away-from-head refresh model or the current scrollbar stabilization work.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.97`
- `docs/adr/0001-freeze-refresh-away-from-head.md` still applies.
- The away-from-head refresh model remains in force:
  - Header action button is still the only return-to-head affordance away from the head screen.
  - Incoming count still lives inside the header action button and applies only after returning to the true feed head.
  - Automatic refresh / silent refresh still pause away from true head and resume only at `scrollTop <= 1`.
  - Resident topic retention still stays page-depth based.
- The current codebase state is:
  - Scrollbar appearance was stabilized with `scrollbar-gutter: stable` and removal of hover-triggered scrollbar-color transitions.
  - Return-to-head can still be interrupted by `wheel`, `pointerdown`, `touchstart`, and `keydown`; `pointerdown` is the only pointer-based listener left on the feed scroll path.
  - The previous `sfp-returning-to-head` hover-pause experiment was removed.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passes.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passes.
- Live browser verification after reinstalling/updating the userscript is still pending.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested; `todo.md` is now intentionally part of the working set.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; reinstall/update is required for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Known Risk

- Touch-triggered overscroll / out-of-bounds scrolling is still unresolved.
- Mouse hover jank seems less likely now; scrollbar emergence and touch interaction are the current focus areas.
- The likely hot paths remain `_scheduleHeadActionStateSync()`, `_syncHeadActionState()`, incoming count recomputation, scroll listeners, and any DOM writes during scroll.

## Next Steps

1. Reinstall/update local userscript to `0.6.97` before live testing.
2. Reproduce the touch overscroll issue in a focused linux.do tab with `$agent-browser-cli`.
3. Inspect whether the feed scroll container needs touch-specific bounds handling, momentum control, or event cancellation near load-more / top / bottom edges.
4. Avoid speculative CSS state toggles on scroll; prove a hypothesis with measurement before patching.

## Suggested Skills

- `$diagnose` for the touch-scroll investigation.
- `$agent-browser-cli` for focused linux.do DOM/state/performance checks.
- `$handoff` again if work remains.
