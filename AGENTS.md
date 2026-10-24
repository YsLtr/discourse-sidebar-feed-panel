# Discourse Sidebar Feed Panel - Active Handoff

The userscript replaces a selected area of a Discourse forum with a compact, locally-filtered topic feed panel, hosted from the userscript metadata of a single built file. `CONTEXT.md` holds the domain terms; `docs/INDEX.md` indexes the durable contracts under `docs/`; this file records only the current session.

**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `feat/read-later` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: 创建新分支设计「稍后再读」，随后按裁定实现。

## 本轮完成的工作

- **设计与裁定**（`e616e28`、`450e0f6`、`b3b90e8`、`d4eef17`）：设计稿 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md)；迁移对照基线整体移除（项目已无旧版本需要迁移）。
- **实现**（`ec49d36`）：新增 `src/read-later.ts`（纯逻辑）与 `src/ui/read-later.ts`（DOM），控制器接线，样式、文案、常量，两个新单测文件，夹具与浏览器检查。行为细节以 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md) 为契约，不再在本文复述。
- **文档转契约**（`64b979e`）：设计稿状态改为现行契约并补 `file:line`；`docs/feed/README.md` 与 `docs/development/01-开发与校验.md` 同步。

## 实现中做出的两处修正

- **高度钳制的 `available`**：设计稿原写 `feedScroll.offsetHeight + section.offsetHeight`，实测在区域溢出容器时这个和会跟着虚高，永远钳不住（面板缩到 `chrome + 100px` 时区域仍是 316px）。改为 `feedContainer.clientHeight - feedScroll.offsetTop`，并让拖拽与键盘共用同一个 `clampHeight()`。
- **打开条目后的已读**：`resident.markRead()` 对不在常驻窗口里的话题是空操作。改为在控制器里用 `_applyReadMarker()` 改快照并持久化，DOM 侧只加 `sfp-read`。

## 当前仓库状况

- HEAD 为 `64b979e`，位于 `feat/read-later`；工作区只剩本文件。
- `package.json` 仍是 3.2.0。
- 完整校验全绿：typecheck 0、14 文件 / 83 单测、`check:dev`、`build`（224.12 kB / gzip 51.24 kB）、`check:artifact`、`check:scroll`、`check:browser` 68 项。
- **本机注意**：`npm test` 的 Vite 配置加载会 `exec("net use")`，在受限文件沙箱下报 `spawn EPERM`；需要 danger-full-access 才跑通，不是代码问题。

## 未决问题

- **`/onebox` 未在真站跑过**：端点、模板与客户端节奏都来自本机 Discourse 克隆（`app/controllers/onebox_controller.rb`、`lib/oneboxer.rb`、`frontend/pretty-text/addon/oneboxer.js`）；`requires_login`、`recently_failed?` 与「同一用户一个预览」的排队行为属发布前人工核对项。夹具里的 `/onebox` 是模拟的。
- **侧边栏高度变化不会自动重新钳制**：只在渲染、窗口 `resize`、头部重建时重算。真站上 `#d-sidebar` 高度是否随滚动/头部折叠变化未实测；若会变，需要 `ResizeObserver`。
- **未 push**：`main` 上 3.2.0 的发布仍未授权；本分支未推送到远端。
- **`perf/` 产物不可复算**（已记入 `docs/discourse/04-消息总线与主线程成本.md` §八）：原始 trace 与四个分析工具从未入库。
- **`docs/` 的链接与索引无自动化校验**：新增或改名主题文件后须人工核对 `docs/INDEX.md` 与各级 `README.md` 的相对层级（子目录互链为 `../<部分>/<文件>.md`）。
- **`CONTEXT.md` 未纳入新术语**：`Read Later Section`、`Preview Card`、`Preview Availability` 只在 `docs/feed/02-稍后再读.md` 的术语小节。

## 后续任务

真站核对（拖入四个位置、两标签页同步、`/onebox` 的登录与 429、语言切换），再决定是否 push。

Updated: 2026-10-24 23:05 中国标准时间 +0800
