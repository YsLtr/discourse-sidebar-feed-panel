# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-30 22:00 (+08:00)
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Branch**: `main`
**Current objective**: Keep `discourse-sidebar-feed-panel.user.js` behavior-preserving while fixing regressions. The latest user request was to restore feed replacement after closing and reopening the Discourse sidebar.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current userscript version in file: `0.6.75`
- Root cause found from git history:
  - `4404993907ca51c14231f3b4b2bc09a35507b121` originally restored feed mode after sidebar remount.
  - A later change narrowed `RouteWatcher` to observe `#main-outlet` / `.d-header`, which can miss sidebar DOM rebuilds.
- Fix applied:
  - `RouteWatcher` now observes `document.body` again so sidebar remounts re-trigger `activateFeed()`.
  - Added a comment explaining why body-level observation is required.

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed.
- Browser verification still needs a reinstall/update of the userscript before live retest.

## Constraints

- Do not commit unrelated untracked/reference files unless explicitly requested.
- Current unrelated untracked/reference files: `CLAUDE.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Preserve `0.6.21+` period behavior and the existing tab/filter/scroll constraints.
- Keep changes small and behavior-preserving.

## Open Questions / Risks

- Live browser verification on linux.do is still pending after reinstalling the userscript.
- `RouteWatcher` remains the critical path for sidebar remount recovery; keep future changes there conservative.

## Recommended Next Steps

1. Reinstall/update the local userscript.
2. Verify the close/open sidebar flow on linux.do.
3. If further cleanup is needed, inspect one remount or incoming-refresh helper slice at a time.

## Suggested Skills

- `$agent-browser-cli` for live linux.do verification.
- `/review` or `/diagnose` if another regression appears.

