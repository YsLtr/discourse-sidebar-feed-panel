# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-06-11 16:08:06 CST +08:00  
**Project root**: `C:\Users\28676\builds\discourse\userscript`  
**Branch**: `main`  
**Current objective**: Double-click fast back-to-top is implemented; no active blocker is known.

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`, userscript version now `2.0.5`.
- Double-click fast back-to-top is implemented in `_handleHeadActionClick()`:
  - second-or-later click is detected with `event?.detail >= 2`;
  - acceleration only applies when the current header button action is `"back-top"`;
  - it calls `_returnToHead({ animated: false })`, so the smooth scroll animation is skipped and the feed jumps to the head immediately.
- The implementation intentionally avoids timers, previous-click action memory, `dblclick` listeners, and animation-state tokens. User clarified that the back-to-top icon remains active until the scroll reaches the head, so current action is sufficient.
- Incoming count behavior is unchanged: `"incoming"` still follows its existing flow, returning to the head before applying candidates when needed.
- `todo.md` marks "双击回到顶部快速回顶（跳过动画）" complete. Remaining pending item: "隐藏置顶只隐藏已读".
- Prior category/tag cache work remains in place:
  - category metadata cache key: `sfp_category_data_cache_v1`;
  - tag style cache key: `sfp_tag_style_cache_v1`;
  - only exposed clear entry is the combined `SFP: 清空分类和标签缓存` / `SFPFeedPanel.clearCaches()`.

## Validation

- Static checks passed after the final simplification:
  - `node --check discourse-sidebar-feed-panel.user.js`
  - `git diff --check -- discourse-sidebar-feed-panel.user.js todo.md`
- `git diff --check` only reports the normal Windows LF-to-CRLF warning for touched files.
- Live browser validation has not been rerun after the double-click change.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Feed Category Tabs are seeded from Discourse's category-list/navigation-like set, not every `site.json` top-level category by default.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count stays separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior unless a future fix proves it is directly involved.

## Known Risks / Open Questions

- Manual verification is still useful: reload/update the installed userscript, scroll the feed, single-click the back-to-top icon to confirm smooth scroll, then double-click it to confirm immediate jump.
- OpenAI community category-cache visual validation from the previous handoff is still useful if touching category/tag behavior again.

## Concrete Next Steps

1. Reinstall/reload the userscript and manually test double-click back-to-top on a live Discourse sidebar feed.
2. If continuing feature work, implement `todo.md` item: "隐藏置顶只隐藏已读".
3. Use the combined cache-clear menu/API only if validating cache rebuild behavior.

## Suggested Skills

- `$agent-browser-cli` for live Discourse DOM inspection, clicks, screenshots, endpoint checks, and userscript menu/API validation.
- `$diagnose` for any site-specific layout, cache, scroll, or incoming-count regressions.
- `$handoff` again before ending the next session.
