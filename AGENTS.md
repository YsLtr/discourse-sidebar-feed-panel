# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-06-02 15:16:53 CST +0800
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: Continue live validation of the userscript after the refresh/back-to-top button state fix.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `1.0.1`
- Latest fix: the header refresh button now follows the same away-from-head boundary used to pause automatic refresh.
  - Once the feed scrolls past the first screen, the button becomes the back-to-top action.
  - It stays as back-to-top while the user keeps scrolling or scrolls back within the first screen.
  - It only returns to the refresh action after the feed reaches the true head (`scrollTop <= 1`), matching automatic refresh restart behavior.
  - The back-to-top enter animation no longer force-restarts while already active.
  - The button content is only rewritten when the action or incoming count changes, avoiding repeated SVG node replacement during scroll sync.
- Existing touch-scroll and user-profile navigation changes remain in place:
  - `.sfp-feed-scroll` contains vertical overscroll and tracks one primary touch point for boundary cancellation.
  - Avatar, display name, and username navigate to `/u/<username>`.
  - Topic-row navigation still marks topics read on normal activation; user-profile links do not.
- `docs/adr/0001-freeze-refresh-away-from-head.md` still applies. The away-from-head refresh model remains in force.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passes.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passes with only the Windows LF-to-CRLF warning.
- Full live validation in linux.do is still pending after installing/updating the userscript to `1.0.1`.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Known Risk

- The refresh/back-to-top button fix has only been statically verified, not validated in a real browser session.
- The touch handler still tracks a single primary touch point by design. This is enough for boundary overscroll protection, but it is not a full multi-touch gesture recognizer.
- If future work touches `_syncHeadActionState()`, keep the button state aligned with the automatic refresh pause/restart boundary.

## Next Steps

1. Install/update the local userscript to `1.0.1`.
2. In linux.do, verify:
   - scrolling past the first screen changes refresh to back-to-top with the enter animation,
   - continuing to scroll while the animation is running does not make it flash or jump,
   - scrolling back within the first screen but not to the top keeps the button as back-to-top,
   - returning to `scrollTop <= 1` changes it back to refresh and restarts automatic refresh.
3. Re-check the prior touch-scroll and user-profile navigation cases if doing full live validation.

## Suggested Skills

- `$agent-browser-cli` for focused linux.do DOM/state checks.
- `$diagnose` if the live button animation or touch-scroll repro still fails.
- `$handoff` again if more work remains.
