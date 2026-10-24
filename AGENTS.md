# Discourse Sidebar Feed Panel - Active Handoff

The userscript replaces a selected area of a Discourse forum with a compact, locally-filtered topic feed panel, hosted from the userscript metadata of a single built file. `CONTEXT.md` holds the domain terms; `docs/INDEX.md` indexes the durable contracts under `docs/`; this file records only the current session.

**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `feat/read-later` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: 创建新分支设计「稍后再读」；随后指出迁移基线已过期、要求按新的交互裁定更新设计。

## 本轮完成的工作

- **新分支与设计稿**（`feat/read-later`，自 `8d3558f` 切出；`e616e28`、`b3b90e8`）：在 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md) 写出「稍后再读」设计稿，并在 [docs/feed/README.md](docs/feed/README.md) 挂索引。设计要点：拖入本站链接加入、localStorage 存储、话题复用 `createTopicItem`、其余用编辑器同一个 `/onebox` 端点生成预览卡片、可拖拽分隔线的「第二空间」、条目自下而上排列。**未实现任何源码**。
- **移除迁移对照基线**（`450e0f6`）：项目已无需要迁移的旧版本，删除 `tests/unit/migration-parity.test.ts`、`tests/fixtures/2.2.3.behavior.json`、`tests/fixtures/2.2.3.metadata.json`、`tools/capture-migration-baseline.mjs`、`tests/css-signature.mjs`、`tests/css-signature.d.mts`、`docs/development/03-迁移基线契约.md`；同步清理 `README.md`、`README.en.md`、`docs/INDEX.md`、`docs/development/README.md`、`docs/development/01-开发与校验.md`、`docs/discourse/01-页面结构与侧边栏宽度.md` §五.4、`docs/discourse/02-网页语言兼容.md` §五.3/§五.5/§六 中的冻结项描述。现在常量、样式与文案都不再受基线约束。
- **按用户裁定更新设计稿**（`b3b90e8`）：打开后不自动移除；自动高度为一个条目起步、两项时变两项、之后不再增高（拖过则以用户值为准）；跨标签页监听 `storage`；主列表刷新后按 id 批量重取已保存话题、缺失的按话题异常处理；非话题链接改用 `/onebox` 预览卡片（客户端只抽字段、不保存 HTML，失败回落 favicon）。

## 当前仓库状况

- HEAD 为 `b3b90e8`，位于 `feat/read-later`；工作区只剩本文件。
- 本轮改动**全部是文档与测试夹具**，`src/` 与 `dist/` 未变；`package.json` 仍是 3.2.0。
- 移除基线后的完整校验：typecheck 0、12 文件 / 63 单测（原 13 / 71）、`check:dev`、`build`（194.49 kB / gzip 44.51 kB）、`check:artifact`、`check:scroll` 12 项、`check:browser` 44 项全绿。
- **本机注意**：`npm test` 的 Vite 配置加载会 `exec("net use")`，在受限文件沙箱下报 `spawn EPERM`；本会话切到 danger-full-access 后才跑通，不是代码问题。

## 未决问题

- **设计稿未实现**：`docs/feed/02-稍后再读.md` 的状态仍是「设计，未实现」，实施顺序见其 §十一。开放问题（键盘/菜单加入入口、摘要行数、匿名用户的 `/onebox` 探测）见 §十二。
- **`/onebox` 的实测缺口**：端点与模板来自本机 Discourse 克隆（`app/controllers/onebox_controller.rb`、`lib/oneboxer.rb`、`frontend/pretty-text/addon/oneboxer.js`），但未在任何真实站点上跑过请求；`requires_login` 与「同一用户一个预览」的排队行为属发布前核对项。
- **未 push**：`main` 上 3.2.0 的发布仍未授权；本分支未推送到远端。
- **`perf/` 产物不可复算**（已记入 `docs/discourse/04-消息总线与主线程成本.md` §八）：原始 trace 与四个分析工具从未入库，`perf/_cpu.txt` 的产出工具在仓库内没有文件记载。
- **`docs/` 的链接与索引无自动化校验**：新增或改名主题文件后，须人工核对 `docs/INDEX.md` 与各级 `README.md` 的相对链接层级（子目录互链为 `../<部分>/<文件>.md`，不使用 `../../`）。
- **`CONTEXT.md` 未纳入新术语**：`Sidebar Track`、`Header Anchor`、`Toggle Button`、`Upcoming-change class` 只在 `docs/discourse/01-页面结构与侧边栏宽度.md` 的术语小节；稍后再读的 `Read Later Section`、`Preview Card` 等只在设计稿内。

## 后续任务

按设计稿 §十一 实施「稍后再读」，或先回答 §十二 的开放问题。

Updated: 2026-10-24 21:52 中国标准时间 +0800
