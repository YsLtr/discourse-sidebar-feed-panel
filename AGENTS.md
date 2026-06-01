# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-06-01 20:25:08 CST +0800
**Project root**: `/home/ysltr/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Continue diagnosing and fixing scroll and return-to-head performance jank without undoing the away-from-head refresh model.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.84`
- Domain glossary: `CONTEXT.md`
- ADR: `docs/adr/0001-freeze-refresh-away-from-head.md`
- The away-from-head refresh model remains in force:
  - Header action button is the only return-to-head affordance away from the head screen.
  - Incoming count lives inside the header action button and applies only after returning to the true feed head.
  - Automatic refresh/silent refresh pause away from true head and resume only at `scrollTop <= 1`.
  - Resident Topic retention remains page-depth based; old configurable resident-topic-limit and continuation URL state remain removed.
- Current uncommitted code changes before this handoff:
  - Version bumped from `0.6.77` to `0.6.84`.
  - DeepSeek review item kept: `_restoreMissingAutomaticRefreshTimers()` restores only missing expected timers instead of using the old `!autoRefreshTimer && !autoSilentRefreshTimer` all-or-nothing guard.
  - Back-to-top arrow enter animation is now one-shot via temporary `.sfp-back-top-enter`, triggered only when `lastHeadActionAwayState` changes into away state, so downward scrolling no longer repeats the disappear/reappear animation.

## Recently Tried And Reverted

- Reverted the attempted scroll-jank fixes that cached refresh-button busy/render state.
- Reverted the attempted hover-transition changes for Topic Items.
- Reverted the attempted `.sfp-scroll-active` class that disabled hover during scroll, because it caused a startup hitch when scrolling began.
- Do not reintroduce a scroll-path class toggle without first proving it avoids style recalculation at scroll start.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed after the latest changes.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed after the latest changes.
- Live browser verification after reinstalling/updating the userscript is still pending.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested; `todo.md` remains untracked.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- The return-to-head timeout fallback is intentional: timeout snaps to top and applies, interruption does not apply incoming.

## Known Risk

- User still reports scroll jank during direct mouse scrolling and return-to-head animation.
- User observed touch interaction does not show the same jank, so mouse hover/repaint remains a plausible contributor.
- Earlier browser measurement was contaminated by an unfocused tab throttling `requestAnimationFrame`; do not treat the 1000ms frame gaps from that probe as conclusive.
- The likely hot paths remain `_scheduleHeadActionStateSync()`, `_syncHeadActionState()`, incoming count recomputation, scroll listeners, hover repaint, and any DOM writes during scroll.

## Next Steps

1. Reinstall/update local userscript to `0.6.84` before live testing.
2. Use `$diagnose` to build a focused browser feedback loop in a focused linux.do tab.
3. Measure direct mouse scroll and return-to-head separately; compare with touch/pointer-neutral operation.
4. Instrument actual button DOM mutations, class changes, `innerHTML` writes, hover changes, and style/layout work during scroll.
5. Avoid speculative CSS state toggles on scroll; prove a hypothesis with measurement before patching.
6. Verify the back-to-top arrow enter animation now plays once when crossing into away-from-head and does not replay while continuing downward.

## Suggested Skills

- `$diagnose` for the scroll and return-to-head performance investigation.
- `$agent-browser-cli` for focused linux.do DOM/state/performance checks.
- `$handoff` again if work remains.
