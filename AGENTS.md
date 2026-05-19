# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 12:24:05 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一步处理更好看的竖向滚动条和原侧边栏横向滚动条修复。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.37`
- Latest commits:
  - `ee6e6f0 fix(sidebar): match incoming hint loading state`
  - `5f8a33c feat(sidebar): add silent refresh interval`
  - `cc052ce fix(sidebar): reuse native category and tag badges`
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Current cleanup focus was theme-driven styling; the script now avoids the obvious hardcoded UI colors in the main feed shell, tabs, filters, badges, and loading/error states.
- `discourse-sidebar-feed-panel.user.js` still carries the native-style unread dot from the previous step.
- Validation run:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Steps

1. Fix the sidebar's vertical scrollbar styling.
2. Repair the original sidebar horizontal scrollbar regression.
3. Keep the fix narrow and avoid regressing the intentional `.sfp-tab-bar` internal scroll.

## Suggested Skills

- `$agent-browser-cli` for live DOM/computed-style checks if a review point needs browser verification.
- `/diagnose` only if a review finds a reproducible bug.
- `$handoff` again after the review session.
