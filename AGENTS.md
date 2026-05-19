# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 12:02:24 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一步做 `discourse-sidebar-feed-panel.user.js` 的完全 review。

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

- Unread dot has been moved to the native-style implementation:
  - no SVG
  - inline CSS circle after time text
  - uses `8px` size and `var(--tertiary-med-or-tertiary, var(--tertiary, #0088cc))`
- The dot is now inserted as `<span class="sfp-unread-dot" aria-hidden="true"></span>` inside `.sfp-topic-time`.
- `markTopicAsRead()` now removes `.sfp-unread-dot`.
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

1. Do a full code review of `discourse-sidebar-feed-panel.user.js`.
2. Focus on regressions, hidden state coupling, CSS layout risks, and missing tests.
3. Do not start with refactors unless a bug or maintainability issue is concrete.

## Suggested Skills

- `$agent-browser-cli` for live DOM/computed-style checks if a review point needs browser verification.
- `/diagnose` only if a review finds a reproducible bug.
- `$handoff` again after the review session.
