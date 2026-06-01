# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-06-01 19:21:27 CST +0800
**Project root**: `/home/ysltr/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Preserve the new away-from-head refresh model and next diagnose scroll jank during direct scrolling and return-to-head animation.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.77`
- New domain glossary updates are in `CONTEXT.md`.
- New ADR: `docs/adr/0001-freeze-refresh-away-from-head.md`.
- Implemented the aggressive refresh/retention redesign:
  - Header refresh button becomes the only return-to-head affordance when the feed is away from the head screen.
  - The old floating back-to-top button and in-feed new-topic reminder overlay were removed.
  - Incoming reminder count now appears as plain themed text inside the header action button.
  - Clicking an incoming count first returns to the top, then applies incoming candidates; interrupted return keeps the count.
  - Automatic refresh and automatic silent refresh pause away from the true feed head and resume only at `scrollTop <= 1`.
  - Incoming tracking continues so the count can update without inserting new feed DOM above the reader.
  - Resident Topic retention was simplified to page-size-derived depth; the configurable resident-topic-limit setting and continuation URL state were removed.
  - Pagination now builds URLs from local page depth; Discourse `more_topics_url` is only used as the more-pages signal.
- A wrong first diagnosis added an automatic-refresh suppression lock; the user clarified that was ineffective, and that code has been removed.
- The effective fix for unreliable incoming application was `_waitForFeedScrollHead()` returning `reached`, `timeout`, or `interrupted`; timeout now snaps to top and applies, while user interruption does not apply.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- discourse-sidebar-feed-panel.user.js CONTEXT.md AGENTS.md docs/adr/0001-freeze-refresh-away-from-head.md` passed.
- Live browser verification after reinstalling/updating the userscript is still pending.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested; `todo.md` remains untracked.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Known Risk

- User reported noticeable scroll jank not only during return-to-head but also while directly scrolling. This is explicitly deferred for the next session.
- Likely first places to inspect: `_scheduleHeadActionStateSync()`, `_syncHeadActionState()`, incoming count recomputation, scroll listeners, and any code that writes `innerHTML`, class names, or timers during scroll.
- The current return-to-head timeout fallback is intentional after diagnosis; do not remove it unless replacing it with a better deterministic completion/interruption model.

## Next Steps

1. Reinstall/update the local userscript before live verification.
2. Use `$diagnose` for the scroll-jank report and build a browser feedback loop before guessing.
3. Measure whether scroll events are causing repeated header DOM writes, incoming recomputation, timer restarts, or layout work.
4. Verify incoming count click behavior on linux.do: count visible away from head, click returns to top, applies incoming only after reaching/snap-to-top, and interruption preserves the count.
5. Verify non-latest automatic refresh: pauses away from true head, resumes only at top.

## Suggested Skills

- `$diagnose` for the scroll-jank investigation.
- `$agent-browser-cli` for live linux.do DOM/state checks and computed-style/layout measurements.
- `$handoff` again if work remains.
