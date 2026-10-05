# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-10-05 20:04:08 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Next objective**: implement GitHub Release distribution. The user requested this handoff and a combined local commit of the completed migration/audits; release workflow changes belong to the next session. No push or publication was performed.

## Current State

- Version `2.3.0` migrates the original `2.2.3` single-file script to strict TypeScript, Vite and vite-plugin-monkey. This handoff is included in the migration commit; use `git log -1` for its hash. Baseline source is at `47794f3:discourse-sidebar-feed-panel.user.js` (also unchanged in pre-migration HEAD `9554763`).
- `src/main.ts` / `app.ts` compose platform, site services, feed state/controller and UI. `src/styles/feed.css` preserves the original stylesheet. `build/userscript.ts` owns metadata; `package.json` owns the version. Module responsibilities and commands: `docs/development.md`.
- Two migration audits are complete; all three independent sub-agents finished. Findings and evidence: `docs/migration-completeness-audit-2026-10-05.md`; original plan: `docs/vite-plugin-monkey-refactor-plan.md`.
- Fixed migration regressions in width persistence, head-request coalescing, lifetime cleanup, same-turn silent-refresh queues, incoming insertion complexity, malformed lifecycle messages and optional page-API publication fallback. Preserve these fixes and their regression coverage.
- The user tested the migration and reported no issues; their test scope was not specified. The user's existing LICENSE attribution change to `YsLtr` is included in the same snapshot.
- Root `discourse-sidebar-feed-panel.user.js` was intentionally deleted and must not be restored. Root synchronization and CI equality checks are removed. `dist/` is ignored and may remain after builds/checks; do not routinely clean it or commit its contents.

## Validation and Commands

- Final source passed **44 unit tests**, **31 production-bundle browser checks**, strict TypeScript (including noUnusedLocals/noUnusedParameters), production build, artifact metadata/standalone-output/README-version checks and whitespace checks. Development bridge verification passed earlier.
- Independent old/new comparisons passed **25,000 data operations**, **37 site-data scenarios** and **23 full-script UI scenarios**; CSS and all 56 messages per language match.
- First-audit **12 native-scroll checks** passed; second-audit changes did not alter scroll logic or CSS. Optional full-CSS diagnostic failed to collect busy-window frame samples in both versions; do not report that diagnostic as passing.
- Fixtures do not establish real userscript-manager sandbox compatibility, real-site sleep/wake behavior or physical touch acceptance. Those remain follow-ups. Independent evidence under ignored `perf/agent-*` is local only; permanent regressions and the audit report are in the repository.
- Use Node `^22.20.0 || ^24.12.0 || >=26.0.0` (local validation: 22.23.2; CI: Node 22), `npm ci`, and `python -m pip install -r requirements-dev.txt`. Run `npm run typecheck`, `npm test`, `npm run check:dev`, `npm run build`, `npm run check:artifact`, `npm run check:browser`, and `npm run check:scroll`. Browser checks use temporary headless Chrome profiles; `CHROME_BIN` and `PYTHON` override executables.

## Durable Constraints

- `CONTEXT.md` and `docs/adr/` govern feed/query/retention behavior. Keep one read dot per Topic Item; use `visibility: hidden` for read topics, never remove it or use `display: none`.
- Preserve monotonic local read-state merging and unavailable-topic ordering, recovery and expiry. Use only the native Sidebar Host, navigation-sourced categories with All fallback, and descendant-inclusive category queries.
- Do not add cancelable Feed wheel/touchmove boundary handlers. Keep passive scroll callbacks and CSS `overscroll-behavior-y: contain` / `touch-action: pan-y pinch-zoom`. Category-tab wheel mapping is separate; follow ADR 0003.
- Pagination follows local depth; `more_topics_url` is only a hasMore signal. Refresh resets depth/trims; ordinary append and local read filters preserve depth.
- Incoming reminder counts accumulate while detail requests are capped at one page. Preserve the Set insertion path, unknown-payload handling, batching, busy queues and stale-request tokens.
- Away latches after one viewport until the actual head; automatic refresh requires `scrollTop <= 1` plus visibility/activity gates. The baseline has no three-times-capacity auto-refresh gate.
- Pure duplicate pages do not count toward the empty-filter stop; the baseline permits pagination during refresh. Do not describe these existing boundaries as stronger protections.
- Version 2.2.3 fixed input coupling during main-thread stalls, not the separate Discourse message-bus/Glimmer CPU blockage. Authoritative investigation: `docs/scroll-responsiveness-analysis-2026-10-05.md`, `docs/init-trace-analysis-2026-10-05.md`, `docs/adr/0003-native-feed-scroll-isolation.md`. Do not equate different recordings or mistake fixture latency for a real-site improvement.

## Next Session: Release Distribution

1. Recheck Git/remote status. Remote: `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`. This session made a local commit only.
2. Define release tags/version policy, asset names and build/check/upload workflow. `.github/workflows/check.yml` currently validates only; there is no Release workflow.
3. Replace the historical GitHub Raw `downloadURL` / `updateURL` in `build/userscript.ts` and installation links in both READMEs together. Assess the upgrade path for existing Raw installations while honoring the deleted root artifact.
4. Update `tools/artifact.mjs`: it currently compares metadata to `tests/fixtures/2.2.3.metadata.json`, allowing only version changes. Accommodate intentional Release URLs while preserving strict identity/grant/match checks.
5. Validate the release artifacts and manager upgrade path. Real-site wake and physical touch checks remain outstanding. Source migration is complete, but the current Raw URLs mean this snapshot is not yet ready for publication.

## Suggested Skills

- `$git-commit` for the release-workflow commit; `$handoff` to preserve the next state.
- `$agent-browser-cli` for real browser validation when needed.
