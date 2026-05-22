# Discourse Sidebar Feed Panel — Active Handoff

**Updated**: 2026-05-22 (Asia/Shanghai)
**Project root**: `C:/Users/28676/builds/discourse/userscript`
**Current objective**: 下一阶段对整个脚本进行结构和逻辑审查，去除重复代码和死代码，优化整体质量。

## Current State

- Main file: `discourse-sidebar-feed-panel.user.js`
- Branch: `master`
- Current userscript version in file: `0.6.63`
- Latest completed work:
  - 帮助提示 tooltip 重构为 body 级 portal 模式：从侧边栏 DOM (`position: absolute`) 移出到 `document.body` (`position: fixed`)，彻底解决被侧边栏 `overflow: hidden` 裁剪和被主内容区 stacking context 覆盖的问题。
  - tooltip 用 `visibility: hidden` 预测量高度后定位，处理视口边界翻转（右超→左翻，下超→上翻）。
  - 淡入动画通过双层 `requestAnimationFrame` 恢复，`offsetWidth` 替代硬编码 178px。
  - 帮助图标改为纯悬浮交互：去掉 `focus`/`blur` 事件和 CSS `:focus` 样式，点击仅阻止冒泡，不留下焦点高亮。

## Validation

- `node --check discourse-sidebar-feed-panel.user.js` passed.
- No live browser verification was done for the tooltip changes.

## Constraints

- Do not commit unrelated untracked files unless explicitly requested.
- Current unrelated untracked/reference files: `LINUX DO Timeline-1.29.1.user.js`, `discourse-content-preserver.user.js`.
- Sidebar minimum width remains `DEFAULT_WIDTH = 272`.
- Do not claim a page refresh applies userscript code changes; the user must reinstall/update the userscript for metadata/code changes.
- Preserve `0.6.21+` period behavior: `period=all` ranked orders stay on `/latest.json?order=...`; non-`all` ranked periods use `/top.json?period=...&order=...`.
- Keep the intended internal horizontal scroll of `.sfp-tab-bar`; do not regress board filter scrolling or the closed-sidebar overflow fix.
- Prefer Discourse/Horizon CSS variables and native DOM conventions over hardcoded approximations.
- `globalHelpTooltip` 生命周期与页面绑定，不需要主动清理（脚本启/禁用依赖页面刷新，feed 开关不重建 DOM）。

## Key Code Points

- `globalHelpTooltip`: body 级共享 tooltip 元素，在 `init()` 中创建一次
- `_buildSettingLabelHtml`: tooltip 文本存储在按钮的 `data-tooltip` 属性中
- `_buildSettingsPanel` → `panel.querySelectorAll(".sfp-setting-help")` 事件绑定处：`showTooltip`/`hideTooltip` 闭包

## Next Steps

1. 对整个 `discourse-sidebar-feed-panel.user.js` 进行完整代码审查
2. 识别并消除重复代码和死代码
3. 优化结构和逻辑组织
4. 审查结束后进行 live browser 验证

## Suggested Skills

- `/review` or `/simplify` for code quality pass
- `$agent-browser-cli` for live linux.do verification
- `/diagnose` if regressions found
