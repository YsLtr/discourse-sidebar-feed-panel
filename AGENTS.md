# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-08-16 02:10:00 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: the issue #3 fix (话题异常 unavailable marking) is committed locally on `main` (not pushed); the owner is verifying it in daily use before pushing and closing the issue.

## Current State

- Main userscript: `discourse-sidebar-feed-panel.user.js`, version `2.2.0`.
- Issue #3 fix (凭空消失话题保留并标记"话题异常"), all uncommitted in the working tree:
  - `_detectVanishedHeadTopics(rawTopics, query)` runs in `_refreshCurrentView` before the replace-head merge. It compares the raw new page-0 with the previous head window and marks topics that vanished while their sort key is strictly newer than the oldest non-pinned key in the new page-0 (witness rule). No network probing of topic state, per issue owner's decision.
  - Sort keys follow `lib/topic_query.rb` SORTABLE_MAPPING: activity→`bumped_at`, created→`created_at`, views→`views`, posts→`posts_count`, likes→`like_count`, op_likes→serialized `op_like_count`. Pinned topics are excluded from both candidates and witnesses ONLY for activity/default orders — Discourse's `apply_pinning` floats pinned rows just in those orders (`topic_query.rb:575`); other orders treat pinned rows as normally ranked. Period-scoped top lists skip detection (period membership can drop topics without ranking causes false positives).
  - `_trimResidentTopicsAfterRefresh` exempts `sfpUnavailable` topics: they neither consume the retention quota nor get trimmed. Their lifecycle is push-based with no extra constants: `_mergeAndRenderTopics` counts genuinely new entrants (ids not previously in `loadedTopicIds`) and `_expireUnavailableTopicsByPush` adds that count to each anomaly's `sfpUnavailablePushed`; an anomaly is removed once its accumulated push reaches `_residentTopicLimit()` (page-size × loaded depth). Early marks accumulate more pushes and expire first (natural FIFO). Full `loadTopics()` resets also clear everything.
  - Rendering: `sfp-topic-unavailable` class (existing strike-through CSS + new opacity 0.62) plus an `--unavailable` status badge with `far-eye-slash` icon and zh/en tooltips (`topicUnavailable`, `topicUnavailableTip`). Items stay clickable so the user can verify the topic's real state.
  - MessageBus lifecycle tracking (`_startSidebarTopicLifecycleTracking`) subscribes `/delete`, `/recover`, `/destroy` whenever the feed is active, marking/unmarking resident topics in real time. Manual unlist and flag-hiding do NOT broadcast by default (`experimental_topic_category_change_notification` defaults to false), so the refresh-time detection remains the primary path.
  - `_isTopicUnavailable` is flag-only on purpose: list JSON never carries `deleted_at`/`hidden` for regular users, and staff-visible `visible:false` rows are not "vanished"; the previous dead helper `_isTopicExplicitlyUnavailable` was removed.
- Discourse-side research backing this design lives in `C:\Users\28676\builds\discourse\discourse` (key facts: `lib/topic_query.rb:812-820,903,913` visible filter applies before `topic_ids`; `app/services/topic_status_updater.rb:62-71` gated unlist publish; `lib/post_destroyer.rb:255-256` unconditional soft-delete publish).
- `README.md` / `README.en.md` gained a feature bullet and a FAQ entry about the badge; `todo.md` gained the checked item; version bumped 2.1.2 → 2.2.0.

## Validation

- Passed:
  - `node --check discourse-sidebar-feed-panel.user.js`
- Pending:
  - `git diff --check` and README trailing-space scan after this handoff edit (rerun before commit).
  - Live browser validation of the badge on a supported site (e.g. linux.do): easiest path is finding a topic that just got unlisted/deleted, or temporarily lowering auto-refresh interval and unlisting one's own topic in another tab.

## Constraints Still In Force

- Feed Panel only replaces a Native Sidebar Host (`#d-sidebar` / `.sidebar-container`); no Standalone Feed Host in phase one.
- Feed Category Tabs are seeded from Discourse navigation/category-list data, not every `site.json` top-level category by default.
- Parent category tabs include subcategories by default; category URLs should preserve parent-chain slug paths and include `include_subcategories=true`.
- Preserve ranked period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...` or category `/l/top.json`.
- Preserve incoming queue semantics: full Incoming Candidate count stays separate from the limited detail fetch window and full candidate cleanup.
- Keep `DEFAULT_WIDTH = 272` and existing sidebar scroll/overflow behavior unless a future fix proves it is directly involved.
- Vanish detection must stay local-only (no per-topic `/t/<id>.json` probing) and conservative: prefer misses over false "话题异常" marks; strict `>` key comparisons, pinned exclusion, period-scoped skip.

## Known Risks / Open Questions

- Witness-rule false negatives are possible when the whole page-0 churns within one refresh interval (all 30 topics newer than X) — accepted per the conservative design.
- Counter-based orders (views/posts/likes/op_likes) rely on stale lower-bound counters; posts/likes can decrease server-side (post deletion, unlikes) causing rare false positives — accepted.
- `far-eye-slash` depends on the site sprite containing the icon (same assumption as existing `far-eye` usage in stats).
- Live validation of the badge and of MessageBus `/delete` marking has not been performed yet.

## Concrete Next Steps

1. Owner verifies locally for a while: badge appears for vanished topics, normal sinking does not badge, expiry after one retention window of new entrants, tab/order/filter switch clears marks, soft-deleted topic marked via message-bus promptly.
2. After verification, push and close issue #3 (a follow-up `closes #3` commit or manual close both work; the fix commit itself only says `refs #3` so push alone will not auto-close).
3. If changing docs again, rerun `git diff --check` and the README trailing-space scan.

## Suggested Skills

- `$agent-browser-cli` for live browser validation on supported Discourse sites.
- `$handoff` again before ending a future session if more work remains.
