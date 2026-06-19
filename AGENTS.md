# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-19 21:19:55 CST +08:00
**Project root**: `/home/ysltr/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Fix `https://meta.discourse.org/` homepage compatibility where the sidebar toggle button does not appear, using the smallest possible initialization-timing change.

## Current State

- Main userscript: `discourse-sidebar-feed-panel.user.js`, version `2.1.1`.
- A minimal timing-only compatibility patch is in progress:
  - new `waitForStableHeaderMount()` waits for Ember readiness, then `document.readyState === "complete"`, then two `requestAnimationFrame` ticks before calling `createToggle()`;
  - `init()` now uses `waitForStableHeaderMount()` instead of calling `createToggle()` directly inside `waitForEmber()`;
  - no feed, incoming queue, sidebar width, or DOM recovery logic was changed.
- `todo.md` now includes an unchecked item for Meta compatibility follow-up.
- Live browser investigation used `$agent-browser-cli` against an already-open `https://meta.discourse.org/` tab:
  - homepage route `discovery.custom` consistently had `.home-logo-wrapper-outlet` and `.home-logo-wrapper-outlet .title`, but no `.sfp-toggle-btn`;
  - topic page route `topic.fromParams` on the same site did show the button;
  - a 4-second homepage sampling window showed the logo/title host was present and stable while the button remained absent, supporting a too-early one-shot mount hypothesis.

## Validation

- Passed:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js`
- Not yet done after the timing patch:
  - reinstall/update the local userscript in the browser;
  - refresh `https://meta.discourse.org/` homepage and confirm the button now appears.

## Constraints Still In Force

- Keep the fix minimal and timing-based first; do not add continuous re-mount logic unless the delayed one-shot mount still fails.
- Preserve existing sidebar/feed behavior, including:
  - `DEFAULT_WIDTH = 272`
  - ranked period routing behavior
  - incoming queue count/load/cleanup separation
  - native DOM/CSS conventions already used by the script
- Do not special-case `meta.discourse.org` if a generic Discourse timing change is sufficient.

## Known Risks / Open Questions

- The patch is statically validated but not yet live-validated after reinstall/update.
- If `meta.discourse.org` homepage still removes or rebuilds the header after `load` + double `requestAnimationFrame`, the next step may need a stronger "header settled" signal or DOM recovery logic.
- `todo.md` remains intentionally unchecked until the browser-visible fix is confirmed.

## Concrete Next Steps

1. Update/reinstall the local userscript to version `2.1.1`.
2. Refresh `https://meta.discourse.org/` homepage and verify the top-logo toggle button appears.
3. If homepage still fails, use `$agent-browser-cli` again to compare post-`load` header mutations and decide whether to:
   - wait on a later stable signal, or
   - introduce minimal button re-mount recovery.

## Suggested Skills

- `$agent-browser-cli` for focused live validation on `meta.discourse.org`.
- `$diagnose` if the delayed one-shot mount still fails after reinstall/update.
- `$handoff` again if more live-debug work remains.
