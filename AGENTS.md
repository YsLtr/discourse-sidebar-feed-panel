# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-10-05 20:24:16 中国标准时间 +0800
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `main` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: hand off, commit all release changes together, and push `main`. That push is authorized to trigger the 3.0.0 Release workflow. This file is written before the commit/push; verify remote Actions/Release status rather than treating publication as already confirmed.

## Current State

- Version **3.0.0** is in package.json, package-lock.json and both READMEs. Previous migration commit: `78ea6be`; baseline single-file source: `47794f3:discourse-sidebar-feed-panel.user.js`.
- `.github/workflows/release.yml` triggers on pushes to `main`, reads package.json from the latest commit of that push, and checks for an existing stable `v<version>` Release. A complete same-version Release is skipped; incomplete releases, orphaned tags and non-404 API failures stop explicitly. The separate check workflow still validates ordinary commits.
- New versions run all existing checks, then automatically create the version tag at `GITHUB_SHA` and publish the built userscript as latest. **No manual tag creation/push.** Use increasing stable MAJOR.MINOR.PATCH versions; published assets are not overwritten. Workflow runs are serialized.
- `build/userscript.ts` points both `@updateURL` and `@downloadURL` to the latest asset. README installation/update instructions and `docs/development.md#release-distribution` describe the new flow.
- The user explicitly reversed the prior root-artifact deletion policy: retain `discourse-sidebar-feed-panel.user.js` as a full **3.0.0 migration snapshot** at the old Raw path. It has the original identity and new Release URLs. Keep this snapshot at 3.0.0 in later releases; do not edit it directly. `tools/artifact.mjs` checks it against the current bundle while package version is 3.0.0, with line-ending normalization; later versions check snapshot metadata. All other baseline identity/grant/match checks remain strict.
- `dist/` stays ignored and may remain after local checks. Do not routinely delete it or commit its contents. Source ownership and commands: `docs/development.md`. Migration audit: `docs/migration-completeness-audit-2026-10-05.md`.

Latest installation / download / update URL:
https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/latest/download/discourse-sidebar-feed-panel.user.js

Version-specific asset:
https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/download/v3.0.0/discourse-sidebar-feed-panel.user.js

## Validation and Remaining Work

- Local 3.0.0 validation passed: strict typecheck, **44 unit tests**, dev bridge, build, artifact identity/URL/README/snapshot checks, **31 production-bundle browser checks**, **12 native-scroll checks**, and whitespace checks.
- After changing the workflow to push-to-main, local YAML/job/commit-target validation and **11 mocked cases executing the embedded version-check JavaScript** passed (new/existing versions, malformed versions, incomplete releases, API failures and orphan tags). Artifact validation passed again. These are local checks, not a completed GitHub Actions run.
- Check the run for the pushed commit (`gh run list`, `gh run view`) and confirm the v3.0.0 asset is available. Initial push exposes the Raw bridge before the Release finishes; users checking during that window may need to retry. If Actions fails, inspect logs and fix the concrete cause; do not overwrite a published asset or blindly delete an orphan tag/release.
- User will manually synchronize external publication sites using the latest URL. No external-site edits are requested.
- Real userscript-manager upgrade/sandbox compatibility, actual forum sleep/wake behavior and physical touch acceptance remain unverified. Name/namespace and update-path checks do not prove manager-specific behavior. Optional full-CSS diagnostic previously failed to collect busy-window frame samples in both old/new versions; do not report it as passing.
- Prior migration comparison evidence and regression fixes are documented in the audit; preserve width persistence, request coalescing, lifetime cleanup, same-turn silent-refresh queues, Set insertion, malformed lifecycle handling and optional page-API fallback.

Use Node `^22.20.0 || ^24.12.0 || >=26.0.0` (CI Node 22), `npm ci`, and `python -m pip install -r requirements-dev.txt`. Checks: `npm run typecheck`, `npm test`, `npm run check:dev`, `npm run build`, `npm run check:artifact`, `npm run check:browser`, `npm run check:scroll`. Browser checks use temporary Chrome profiles; `CHROME_BIN` / `PYTHON` override executables.

## Durable Constraints

- `CONTEXT.md` and `docs/adr/` govern feed/query/retention behavior. Keep one read dot per Topic Item; use `visibility: hidden` for read topics, never remove it or use `display: none`.
- Preserve monotonic local read-state merging and unavailable-topic ordering, recovery and expiry. Use only the native Sidebar Host, navigation-sourced categories with All fallback, and descendant-inclusive category queries.
- Do not add cancelable Feed wheel/touchmove boundary handlers. Keep passive scroll callbacks and CSS `overscroll-behavior-y: contain` / `touch-action: pan-y pinch-zoom`. Category-tab wheel mapping is separate; follow ADR 0003.
- Pagination follows local depth; `more_topics_url` is only a hasMore signal. Refresh resets depth/trims; ordinary append and local read filters preserve depth.
- Incoming reminder counts accumulate while detail requests are capped at one page. Preserve the Set insertion path, unknown-payload handling, batching, busy queues and stale-request tokens.
- Away latches after one viewport until the actual head; automatic refresh requires `scrollTop <= 1` plus visibility/activity gates. The baseline has no three-times-capacity auto-refresh gate.
- Pure duplicate pages do not count toward the empty-filter stop; the baseline permits pagination during refresh. Do not describe these existing boundaries as stronger protections.
- Version 2.2.3 fixed input coupling during main-thread stalls, not the separate Discourse message-bus/Glimmer CPU blockage. Authoritative investigation: `docs/scroll-responsiveness-analysis-2026-10-05.md`, `docs/init-trace-analysis-2026-10-05.md`, `docs/adr/0003-native-feed-scroll-isolation.md`. Do not equate different recordings or mistake fixture latency for a real-site improvement.
