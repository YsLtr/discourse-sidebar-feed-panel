# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-22 01:23:35 +08:00
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: UI 优化已完成一轮；下一步如继续，应重点做 live browser 验证和更系统的上手提示设计。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Branch: `master`
- Current userscript version in file: `0.6.63`
- Latest completed work:
  - 刷新按钮在手动刷新、普通自动刷新、自动静默刷新、incoming 应用时显示旋转 busy 状态。
  - 最新活动设置中 `新活动提醒` 与 `自动静默刷新` 互斥：开启提醒会停止并隐藏静默刷新运行态，但保留静默刷新保存偏好；关闭提醒后按原偏好恢复。
  - 设置面板使用动态高度，宽度保持原 `204px`；复选框和输入框右列对齐。
  - 设置项增加 SVG 问号说明图标，hover/focus 只由图标本体触发，说明框向右下展开。
  - 说明文案补充速率限制：普通自动刷新不要太快；自动静默刷新只处理已收到候选，无速率限制。
  - 停用/重建 feed 时重置 refresh busy counter、清旧按钮引用，并清理 incoming filter timeout。
  - 静默 incoming 应用在过滤候选后会二次检查 busy 状态，避免与刚启动的手动刷新竞争 `activeRefreshToken`。

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- `git diff --check -- discourse-sidebar-feed-panel.user.js` passed with only the repo LF/CRLF warning.
- No live browser automation was completed in this pass.

## Code Structure Review Notes

- Refresh paths are still guarded by `isLoading || isLoadingMore || isRefreshing`; a manual click during an active refresh returns `false` instead of queuing. This is safe but can feel like the click was ignored. If improving UX, prefer disabling the refresh button while busy or adding an explicit manual-refresh queue.
- Auto timers are not expected to idle-run:
  - `_startAutoSilentRefresh()` stops any old timer, then starts only when saved silent-refresh preference is enabled, incoming hint is off, view is latest activity, and interval > 0.
  - `_startAutoRefresh()` stops any old timer, then starts only on non-latest views when auto refresh is enabled.
  - `_stopSidebarIncomingTracking()` now clears delayed incoming-filter refresh.
- Tooltip layout remains CSS/DOM only; live verification at narrow width is still recommended because no browser session was available.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files remain: `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.

## Next Steps

1. Reinstall/update the userscript, then manually verify the settings menu at the minimum sidebar width.
2. Check tooltip direction, hover hit area, and panel height on linux.do with Chinese labels.
3. Decide whether refresh clicks while busy should disable the button or queue one manual refresh.
4. Continue onboarding/first-use hints if UI polish is accepted.

## Suggested Skills

- `$agent-browser-cli` for live linux.do UI, DOM, and layout checks once extension connectivity is restored.
- `/diagnose` if refresh, incoming hint, or settings state regresses.
- `$handoff` again after the next UI/onboarding pass if work remains.
