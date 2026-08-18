# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-08-18 23:04:05 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: release the read-dot layout fixes as userscript version `2.2.2`; commit and push are requested in this session.

## Current State

- Main userscript: `discourse-sidebar-feed-panel.user.js`, version `2.2.2`.
- Commit `e2292d1` changed the dot removal after a topic visit into `visibility: hidden`, preserving its layout width.
- Commit `c4fd636` preserves locally applied read state when a concurrent refresh returns a stale unread snapshot.
- The current change completes the layout fix: `_topicTimeHtml(topic)` always renders `.sfp-unread-dot`; topics already read when returned by the list API receive `.sfp-unread-dot--hidden` immediately instead of omitting the element.
- Issue #3's unavailable-topic behavior remains implemented by commits `674fbb7` and `a7c96c2`; see their diffs and the README FAQ for details.

## Validation

- Passed a Node VM regression harness against the actual `_topicTimeHtml` function:
  - unread topic → visible `.sfp-unread-dot`
  - read topic → `.sfp-unread-dot.sfp-unread-dot--hidden`
- Passed `node --check discourse-sidebar-feed-panel.user.js`.
- Passed `git diff --check`.

## Constraints

- Keep one dot element for every Topic Item so read-state changes never alter the time-row layout.
- Use `visibility: hidden` for read topics; do not remove the dot or use `display: none`.
- Preserve the feed/query/retention constraints documented in `CONTEXT.md` and `docs/adr/`.

## Next Steps

1. Confirm the `2.2.2` commit is present on `origin/main`.
2. Optionally live-check a mixed read/unread feed to verify stable alignment across initial render, click, and refresh.

## Suggested Skills

- `$agent-browser-cli` for optional live browser validation.
- `$handoff` if later work changes the state above.
