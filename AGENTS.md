# Discourse Sidebar Feed Panel - Active Handoff

**Updated**: 2026-10-05 16:18:51 CST +08:00
**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch**: `main`
**Current objective**: preserve the completed wake-freeze investigation and version `2.2.3` scroll-isolation fix. The user requested implementation, a commit including `.gitignore` and docs, then this handoff. Real-site wake validation remains a follow-up; no push was performed.

## Current State

- Implementation commit: `47794f3` — `fix(feed): preserve native scrolling during main-thread stalls`.
- Main userscript and both READMEs now report `2.2.3`.
- `_setupScrollLoadMore()` no longer installs non-passive wheel/touchmove boundary handlers. Removed touch tracking and the unused `isAtScrollBoundary()` helper.
- Existing `overscroll-behavior-y: contain` and `touch-action: pan-y pinch-zoom` handle Feed boundary isolation. Passive scroll callbacks still update reading state and load older topics.
- The category tab bar retains its separate wheel-to-horizontal-scroll behavior, which still requires JavaScript.
- Commit includes the regression checker, investigation docs, ADR 0003, and `.gitignore` rules for `perf/` and `*.trace.json`. Earlier evidence was committed in `bb542b2`.

## Investigation: Two Different Causes

1. **Main-thread CPU blockage:** Discourse message-bus response processing triggers synchronous Glimmer dependency-tag validation (`lt` / `TAG_COMPUTE`) and HTML insertion. This persists without Bitwarden or this userscript. Bitwarden substantially amplified the earliest freeze with repeated DOM observer callbacks.
2. **Scrolling also becoming unresponsive:** a non-passive wheel handler can make the first wheel in a gesture wait for the blocked main thread, despite negligible handler execution time. Earlier statements that low userscript CPU time excluded its input impact were incomplete. Version 2.2.3 addresses this coupling, not the site's heavy rendering.

The four local recordings are `perf/Trace-20261005T<time>.json.gz`:

| Time | Main observation |
|---|---|
| `084754` | 11.86 s task: site 5.50 s + microtasks 6.36 s; Bitwarden had 13 heavy observer calls with distinct script IDs. |
| `104725` | Bitwarden absent; no second-scale task, but comparable heavy message processing was not captured. This did not prove the root cause was fixed. |
| `121135` | Bitwarden absent; 8.26 s task, including 7.63 s site work. Saved view began at 8.25 s and hid most of the task. |
| `153526` | Bitwarden and Feed script absent; still a 6.32 s task, while compositor scrolling took 1–22 ms. Other extensions/scripts remained active. |

User confirmed the last recording allowed scrolling, but new posts did not load and the right-side floor indicator stopped updating. Those latter operations need the main thread and are not fixed by this patch.

Authoritative detail: `docs/scroll-responsiveness-analysis-2026-10-05.md`, `docs/init-trace-analysis-2026-10-05.md`, and `docs/adr/0003-native-feed-scroll-isolation.md`. Older claims in `docs/freeze-trace-analysis-2026-10-05.md` were revised in the later reports. Do not treat different recordings as identical workloads or infer message counts from poll duration.

## Validation

- `python tools/check-scroll-isolation.py --label after`: **12 checks passed** on Chrome 154.0.8037.93. Requires Python `websocket-client`; `--chrome` overrides the browser path and `--source` selects a baseline userscript.
- The checker extracts actual scroll setup/CSS into an isolated fixture. Covers wheel/touch boundaries, short content, listener rebinding/loading, first-wheel routing, and continued scrolling during a 1.4 s main-thread block.
- Discriminating regression: baseline 2.2.2 has **1 renderer-main wheel acknowledgement** and fails; 2.2.3 has **0** and passes. Both versions can continue an already-started gesture, so continuous scrolling alone is not proof of improvement.
- New-version busy-window scrolling: 98 samples, median 14.135 ms, max 27.539 ms. These are not a measured before/after latency reduction.
- Passed `node --check discourse-sidebar-feed-panel.user.js`.
- Passed `git diff --check`.
- Local artifacts: `perf/scroll-isolation/{before,after}.results.json` and `.trace.json`. Trace analysis helpers `perf/compare-wake-traces.py` and `perf/analyze-wake-input.py` are ignored local files, not available in a fresh clone. CPU chunks must be joined by `(pid, profile id)` and timed from Profile start, not each chunk's writeout timestamp/tid.

## Constraints

- Keep one dot element for every Topic Item so read-state changes never alter the time-row layout.
- Use `visibility: hidden` for read topics; do not remove the dot or use `display: none`.
- Preserve the feed/query/retention constraints documented in `CONTEXT.md` and `docs/adr/`.
- Do not reintroduce cancelable Feed wheel/touchmove handlers just to stop scroll chaining; follow ADR 0003.
- Preserve local read-state merging (`c4fd636`) and unavailable-topic behavior (`674fbb7`, `a7c96c2`; README FAQ). Read-dot layout fixes are already committed through `dc46e17`.

## Next Steps

1. Install 2.2.3 and reload the page to remove old listeners; validate a real long-resident/sleep-wake session and actual mobile touch behavior. The isolated checker stubs loading/state callbacks and does not replay the full site.
2. If investigating remaining multi-second stalls, focus on message-batch render/flush frequency and components whose dependency graphs dominate `TAG_COMPUTE`; do not mistake remaining site work for failure of the scroll-isolation patch.
3. Confirm current git/remote status before any publication. Implementation is committed locally; this session did not push.

## Suggested Skills

- `$diagnose` for further performance work; `$agent-browser-cli` for live browser validation.
- `$handoff` if later work changes the state above.
