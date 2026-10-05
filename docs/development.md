# Development and validation

The project uses Vite 8.3.2 and vite-plugin-monkey 8.1.1, with exact dependency versions in `package-lock.json`. Use Node.js `^22.20.0 || ^24.12.0 || >=26.0.0` and `npm ci` (Node 22 LTS is used in CI). This range covers the locked test runner and the optional Linux LZMA binding as well as Vite itself.

## Source and output

`src/main.ts` guards iframe execution before calling `app.ts`. The app migrates storage, composes preferences, site services, the Discourse adapter and controller, injects `styles/feed.css`, and starts the UI. Imports do not mount the panel or migrate storage.

| Module | Responsibility |
| --- | --- |
| `build/userscript.ts` | Published name, namespace, match rules, permissions and update URLs; version comes from package.json |
| `src/platform/gm.ts` | Explicit imports from vite-plugin-monkey's `$` client alias |
| `src/preferences.ts`, `storage-keys.ts` | Preference state and persistence, origin-scoped synchronous storage and LinuxDO legacy-key migration |
| `src/platform/discourse.ts`, `lifetime.ts` | Page environment, CSRF, navigation, cancellable readiness and owned listeners/timers/RAFs |
| `src/platform/route-watcher.ts` | Idempotent route/host observation and reversible history wrappers |
| `src/site/` | Category/navigation data, capabilities, versioned caches, tag styles and appearance rules |
| `src/feed/query.ts`, `read-state.ts` | Shared URL/query and reading-progress rules |
| `src/feed/resident.ts`, `unavailable.ts` | Topic/user retention, pagination depth, local-read merging, vanished-topic detection and expiry |
| `src/feed/incoming.ts`, `auto-load.ts` | Candidate count versus load batch; query-scoped pagination rate limits |
| `src/feed/reading.ts`, `refresh.ts` | Latched reading state, page activity and restartable refresh clocks |
| `src/feed/api.ts`, `controller.ts` | API boundary, query snapshots, operation tokens, cancellation, subscriptions and application flows |
| `src/ui/host.ts`, `controls.ts`, `topic-item.ts`, `topic-list.ts` | Native host and width, controls, topic rendering, pagination UI, anchors and interrupted smooth scrolling |
| `src/ui/scroll.ts` | Passive scroll observation and cancellation of pending work on rebind/disposal |
| `src/i18n.ts`, `src/ui/html.ts`, `icons.ts` | Existing text and presentation helpers |

All application source is TypeScript and passes strict type checking. There is no unchecked JavaScript controller or shared mutable global-state module. Domain data owners have no DOM/GM/network effects. UI receives read-only preferences, view data and action callbacks; preference writes remain in the preference owner.

The migration preserves the baseline behavior for three previously inconsistent definitions: incoming IDs accumulate for reminder counts but detail fetching is capped at one API page; the automatic-refresh gate has no three-times-capacity check; Away begins beyond one viewport and remains latched until the actual head, while automatic refresh requires `scrollTop <= 1`. `CONTEXT.md` now reflects these distinctions. No virtual list or viewport-protection trimming was introduced.

Read-filter changes continue to render locally without resetting resident depth. They now retire older request generations as well; if the first page is still loading, its replacement load uses the new filter snapshot. This prevents A→B→A filter changes from accepting a pre-switch response. The browser fixture covers this together with category-switch races.

`npm run build` writes a self-contained, unminified userscript under ignored `dist/`. This intermediate migration commits source only: the root userscript was intentionally deleted. Build output may remain locally after verification; do not routinely clean `dist/` or commit its contents. Never use the repository root as Vite's output directory.

After changing source or a version, build and check the temporary artifact. CI checks the two README versions and metadata against the 2.2.3 baseline (allowing the package version to change). It no longer expects or restores a root artifact. Release distribution and replacement of the historical GitHub Raw update URLs are deferred; this branch is not ready for publication until that workflow is configured.

## Development

Run `npm run dev`, then install the development script using the local installation URL exposed by vite-plugin-monkey. It has a `dev:` name prefix. Enable only one script version on a test site. The development script may have a separate GM storage namespace; validate upgrades using the production script identity too.

The dev name uses a callback: in plugin 8.1.1 a string `prefix` replaces the full name. Serve mode omits production download/update URLs. The plugin's development bridge requests its own broader GM grants; the production artifact is checked to retain exactly the original six grants. `npm run check:dev` validates the local install endpoint, metadata, TypeScript entry and GM alias without installing anything in a browser.

Use full-page reloads for development; no custom HMR accept handler is installed. The controller now exposes `start`, `activate`, `deactivate` and `dispose`. `SFPFeedPanel.clearCaches()` remains available, and `SFPFeedPanel.dispose()` / `SFPFeedPanel.start()` support explicit disposal and restart for diagnostics. These operations are idempotent. The GM menu is registered once per bootstrap and delegates to the current instance, retaining the original six grants. If the optional page API cannot be published, the feed and GM menu still start; the browser check covers readonly properties and throwing bridge setters.

Deactivation retires operation tokens and cancels requests even when the sidebar has disappeared. Full disposal also removes global activity/drag listeners, route observation/history wrappers, timers/RAFs, style elements, tooltip and loading tag iframe. Query tokens remain authoritative when a mock or completed request ignores abort. Cache resets use their own lifetimes so old responses cannot repopulate cleared data. Real userscript-manager sandbox compatibility of the page API still needs release validation.

## Checks

```sh
npm run typecheck
npm test
npm run check:dev
npm run build
python -m pip install -r requirements-dev.txt
npm run check:scroll
npm run check:browser
npm run check:artifact
```

Both browser commands launch a temporary headless Chrome profile and clean up only that profile. They do not install or update a script in the user's browser. Set `CHROME_BIN` or append `-- --chrome /path/to/chrome` to select Chrome; `PYTHON` can select the Python executable.

- Unit tests cover storage migration/isolation, query URLs and category paths, read state, retention/expiry, incoming batches, auto-load/reading gates, countdown and lifetime disposal, site capabilities/navigation/cache reset races, route cleanup, and scroll debounce cancellation. Migration parity tests execute 33 unchanged functions extracted from commit `47794f3`, and compare the complete stylesheet structure, bilingual text and constants. The fixture is reproducible with `node tools/capture-migration-baseline.mjs`; normal test runs do not require Git history.
- `check:scroll` bundles the real `ui/scroll.ts` implementation into an inline fixture. Loading/state callbacks are stubbed. By default the fixture imports just the `.sfp-feed-scroll` rule from the real CSS, matching the previous checker's scope. The existing 12 wheel/touch/rebind/first-wheel/busy-main-thread assertions remain in place.
- Historical single-file baselines remain supported: `python tools/check-scroll-isolation.py --source path/to/2.2.3.user.js --label baseline`. Running Python without a source requires a previously built module fixture; the npm command builds it first.
- `check:browser` evaluates the actual dist userscript, including all CSS, on a local mock Discourse page. Checks cover mount, default-order migration, navigation/read-dot layout, read-state merge, local-page pagination, incoming application, independent lifecycle subscriptions, host replacement, request coalescing, A→B→A and local-filter races, width persistence on mouseup, complete disposal, idempotent restart, interrupted smooth scrolling and tag-iframe cleanup. It also checks zero-second message batching, the three-empty-page stop, the three-requests-per-window limit, manual bypass and retry of the failed page. The mock deliberately ignores fetch cancellation to exercise token checks.
- These fixtures do not verify script-manager sandbox behavior, actual forum APIs, sleep/wake sessions, or physical touch devices. Those remain release checks.

### Full-CSS scroll diagnostic

Run `npm run check:scroll -- --full-css --label full-css` to include scrollbar pseudo-elements and all other stylesheet rules in the isolated scroll fixture.

On 2026-10-05, Chrome 154.0.8037.93 passed the first-wheel check with zero renderer-main acknowledgements in both the original 2.2.3 and migrated full-CSS fixtures, but neither fixture recorded frame-swap samples during the 1.4-second main-thread block. Both failed the busy-window frame assertion. The default container-only fixture passed all 12 checks after migration (97 busy-window samples in that recording).

This is an unresolved limitation of the broader fixture, not evidence that the complete product remains responsive under every main-thread stall. Its cause has not been isolated. The refactor preserves the existing CSS and keeps this optional diagnostic available; do not loosen the assertion or report the full-CSS diagnostic as passing. Local records are ignored under `perf/scroll-isolation/` (`baseline-full`, `migrated-full`, and `migrated`). Real-site wake testing remains necessary.

## Local completion record — 2026-10-05

Version 2.3.0 after both audits: strict typecheck (including noUnusedLocals/noUnusedParameters), 44 unit tests, production build, 31 built-script browser checks, artifact metadata/standalone-output/README-version checks and whitespace checks passed. Development endpoint verification and 12 default scroll checks passed earlier; the second audit did not change scroll logic or CSS. The first-audit scroll recording is `perf/scroll-isolation/migration-audit.*`: zero renderer-main wheel acknowledgements and 97 busy-window latency samples (median 14.636 ms, maximum 29.325 ms). This is a fixture result, not a measured real-site latency improvement.

The root installation file is intentionally absent. The migration, audits and AGENTS.md handoff are captured together in the requested local commit; no push, publication, agent-managed real-manager installation or remote CI run was performed. The user reported testing without issues, with scope unspecified. Source migration and local build/check commands are implemented; the next session will change Release distribution, metadata URLs and installation links together. Manager upgrades, real-site wake and physical touch acceptance remain follow-up work. See the [completeness audit](migration-completeness-audit-2026-10-05.md) for evidence and fixes found after the initial migration.
