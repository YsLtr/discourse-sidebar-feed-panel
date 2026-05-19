# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-19 09:24:03 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下次处理“侧边栏下方多余的横向滚动条”。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Current branch: `master`
- Current userscript version in file: `0.6.25`
- Pending commit for this handoff: dark-mode/status-badge style repair plus this `AGENTS.md` update.
- Existing unrelated untracked/reference files remain: `CLAUDE.md`, `CLAUDE_old.md`, `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`, `show-more-layout-test.html`, `展开.md`.

## Just Finished

- Reworked topic status badges to use Discourse/Horizon theme variables instead of hardcoded light backgrounds.
- Added `热门` badge from `topic.is_hot`; `热门` and `已置顶` can both display, ordered `热门` then `已置顶`.
- Moved `热门` / `已置顶` badges to the header row between username info and updated time.
- Changed the closed-topic indicator to mirror Discourse DOM: `topic-statuses > topic-status --closed > d-icon-lock`, shown before the title text.
- Tuned the lock icon with Discourse source guidance: `topic-statuses` floats left, `--icon-size: 0.86em`, close spacing to title text.
- Updated `.sfp-tab-bar` background to `--d-content-background` so it follows theme changes better.
- Validation run this session:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js`
  - `$agent-browser-cli` inspected native `topic-status-card`, `topic-status --closed`, and computed layout.
  - Discourse source checked under `C:/Users/28676/builds/discourse/discourse`, especially `app/assets/stylesheets/common/base/discourse.scss`, `themes/horizon/scss/topic-cards.scss`, and `frontend/discourse/app/components/topic-status.gjs`.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript changes; the user must reinstall/update the userscript for metadata/code changes.
- Prefer Discourse/Horizon CSS variables for theme-sensitive styles; avoid Dark Reader-specific overrides unless no native variable path exists.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.

## Next Issue

User request for next session: “侧边栏下方多余的横向滚动条”.

Likely areas to inspect:

- `injectStyles()` around layout containers: `.sfp-feed-container`, `.sfp-tab-bar`, `.sfp-filter-bar`, `.sfp-feed-scroll`, `.sfp-content-wrapper`, `.sfp-topic-item`, footer/loading/empty states.
- Any element using fixed width, `width: 100%` plus horizontal padding, long unbreakable text, `overflow-x`, or negative margins.
- Recent header-row badges may contribute if combined width exceeds sidebar; check `.sfp-topic-status-badges`, `.sfp-topic-time`, `.sfp-topic-meta-col`, and `.sfp-topic-user-info` flex shrinking.
- Category tab bar intentionally scrolls horizontally; distinguish its intended internal scroll from an unwanted bottom/page-level scrollbar.

## Suggested Next Steps

1. Use `$agent-browser-cli` on `https://linux.do/` to identify the element causing horizontal overflow: compare `scrollWidth` vs `clientWidth` for `.sfp-*` nodes.
2. Check whether the scrollbar belongs to the sidebar feed container, the whole Discourse sidebar, or the document/body.
3. Prefer targeted fixes such as `min-width: 0`, `box-sizing: border-box`, `overflow-x: hidden` on the correct wrapper, or flex shrink constraints; avoid hiding the intentional `.sfp-tab-bar` horizontal category scroll.
4. Run `node --check discourse-sidebar-feed-panel.user.js` and `git diff --check -- discourse-sidebar-feed-panel.user.js`; bump version before user testing if code changes.

## Suggested Skills

- `$agent-browser-cli` for live DOM overflow measurement and screenshot/geometry checks.
- `/diagnose` if the scrollbar only appears after certain content, width, or theme transitions.
- `$handoff` when updating this active handoff again.
