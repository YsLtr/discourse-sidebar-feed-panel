# Discourse Sidebar Feed Panel - Active Handoff

The userscript replaces a selected area of a Discourse forum with a compact, locally-filtered topic feed panel, hosted from the userscript metadata of a single built file. `CONTEXT.md` holds the domain terms; `docs/INDEX.md` indexes the durable contracts under `docs/`; this file records only the current session.

**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `feat/read-later` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: 创建新分支设计「稍后再读」，随后按裁定实现，并按真站反馈逐条修。

## 本轮完成的工作

- **设计与裁定**（`e616e28`、`450e0f6`、`b3b90e8`、`d4eef17`）：设计稿 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md)；迁移对照基线整体移除（项目已无旧版本需要迁移）。
- **实现**（`ec49d36`）：新增 `src/read-later.ts`（纯逻辑）与 `src/ui/read-later.ts`（DOM），控制器接线，样式、文案、常量，两个新单测文件，夹具与浏览器检查。
- **文档转契约**（`64b979e`）：设计稿状态改为现行契约并补 `file:line`。
- **两轮真站反馈修正**（`08501a4`、`91c8ce0`、`49b3766`）：共 13 处，见下。
- **第三轮真站反馈修正**（`c84537b`）：8 处，见下。行为细节以 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md) 为契约，不再在本文复述。
- **第四轮真站反馈修正**（`be3d4da`）：5 处，见下。

## 真站反馈修掉的问题

第一轮（`08501a4`）：

- 分隔线原本是 `<section>` 的第一个子节点、section 还有 `border-top`，于是「线上方」仍是稍后再读的地盘 → 分隔线改为 section 的兄弟节点，section 去掉 `border-top`。
- 列表从上往下排：`margin-top: auto` 在块级父元素里算 0 → `.sfp-rl-scroll` 加 `display: flex; flex-direction: column`。
- 「加载中」行既占高度又误导 → 删除 `.sfp-rl-pending` 与 `pendingUrls`，预览期间直接显示降级卡片。
- 主列表已有的话题还要再请求一次 → 命中 `resident.topics` 就复制快照并跳过 `syncReadLater()`。
- 个人资料预览不出来 → `/onebox` 补 `refresh=true`、`X-Requested-With`、`credentials: include`。**`refresh=true` 不能省**：服务端缓存按 URL 只存一份，曾缓存成纯 `<a>` 兜底的 URL 会永远拿回兜底。
- 从发布者区域拖出得到话题链接 → `dragstart` 先认 `[data-user-profile-link]`。

第二轮（`49b3766`）：

- 分隔线上下仍有留白 → 改成 3 px 的元素本身，去掉 `::before` 与 7 px 命中带。
- 拖分隔线时内容跟着走 → `setSectionHeight()` 每次改完 `pinToBottom()`，拖线只改可见窗口。
- 滚动条与主区域不一致 → `.sfp-rl-scroll` 复用主滚动区的 `--scrollbarThumbBg`/`--scrollbarWidth`/`scrollbar-gutter`。
- 新条目仍在下方 → 渲染倒序 + 列表贴底，新条目出现在最上方。
- 清空后高度不回落 → 删到零时 `setHeight(null)`，下次回到一个条目高。
- 指示框只在最下面一条 → 改为 `section` 内 `position: absolute; inset: 2px; z-index: 3` 的遮罩，覆盖整区、压在条目上。
- 昵称/用户名拖出仍是话题 → 文本拖拽时 `dragstart.target` 会退到外层 `<a>`，补 `selectionProfile()` 从选区祖先找发布者链接。
- 顺带修：`dragstart` 只切遮罩、不重建条目节点——把正在被拖的节点换掉会让浏览器取消拖拽。

第三轮（`c84537b`）：

- 刷新时连主列表已有的话题也再请求一次 → `syncReadLater()` 先用常驻窗口里的话题，只有主列表没有的才发 `topic_ids`。
- `/onebox` 返回 200 但仍是失败（纯 `<a>` 兜底）被当成成功 → `extractPreview` 改成必须找到 `aside`/`.onebox` 容器；判据与编辑器 `prosemirror/extensions/onebox.js:694` 一致。
- 稍后再读区内容与外面的链接无法区分 → 预览卡片自带 `.sfp-rl-card`/`.sfp-rl-fallback` 结构，话题条目与主列表同款但包在 `.sfp-rl-item` 里，拖动时半透明。
- 删除按钮 → 删掉按钮，改为把条目拖出区域即删除。
- 无法调整顺序 → 拖动条目到目标位置即重排，`store.move()` 持久化。
- `setSectionHeight()` 每次 `pinToBottom()` 导致滚到顶部再拖分隔线会跳到底部 → 删掉那次强制滚动；渲染也不再改 `scrollTop`（除了新条目时回顶部）。
- 从昵称/用户名拖出仍是话题 → `dragstart` 增加 `elementFromPoint` 路径（最准），并把 `data-user-profile-*` 铺到整块 `.sfp-topic-meta-col`。
- 遮罩文案一次到位 → 分两段：未进入「拖进加入稍后再读」无底色，进入后「松开后加入稍后再读」并加深底色。
- 顺带：存储版本升到 2（数组新→旧，索引即视觉顺序），v1 读取时反转一次。

第四轮（`be3d4da`）：

- 遮罩两段文案没生效 → 原来只有 `dragover` 落在 `section` 上才切换，而容器的 `dragover` 抢先设了 `dropActive`；现在容器的 `dragover` 只负责 `preventDefault()` 与让区域出现，高亮只由 `section` 自己的 `dragenter`/`dragover`/`dragleave` 驱动。
- 移除条目上的 `title`（拖出即删除）提示，连 `readLaterDragOut` 词条一起删。
- 「松开后加入稍后再读」→「松开加入稍后再读」。
- 拖分隔线会搬动内容 → 根因是「贴底」靠 `margin-top: auto`，在「放得下」与「放不下」之间会换一次对齐方式。改为 `.sfp-rl-scroll { flex-direction: column-reverse }`：主轴原点在底部，`scrollTop = 0` 就是贴底、向上滚为负方向，改高度只让上方多露内容。所有 `pinToBottom()`/`scrollTop` 补丁彻底删除，DOM 按存储倒序 append。
- 删掉非话题条目再加回来不取预览 → 页内 `failedUrls`/`requestedUrls` 会永久记住这个 URL。现在每次 `render()` 按当前列表清理这两个集合与待发队列，重新加入就重新取一次。

## 当前仓库状况

- HEAD 为 `be3d4da`，位于 `feat/read-later`；工作区干净。
- `package.json` 仍是 3.2.0。
- 完整校验全绿：typecheck 0、14 文件 / 85 单测、`check:dev`、`build`、`check:artifact`、`check:scroll`、`check:browser` **98 项**。
- **本机注意**：`npm test` 的 Vite 配置加载会 `exec("net use")`，在受限文件沙箱下报 `spawn EPERM`；需要 danger-full-access 才跑通，不是代码问题。

## 未决问题

- **`/onebox` 未在真站跑过**：端点、模板与客户端节奏都来自本机 Discourse 克隆（`app/controllers/onebox_controller.rb`、`lib/oneboxer.rb`、`frontend/pretty-text/addon/oneboxer.js`）；`requires_login`、`recently_failed?` 与「同一用户一个预览」的排队行为属发布前人工核对项。夹具里的 `/onebox` 是模拟的。
- **昵称/用户名拖出**依次尝试指针位置、`target` 祖先与文本选区；三者都指不到发布者 span 时仍会退回话题链接。
- **删除与排序只有拖动**：没有按钮，也没有键盘等价操作；触摸设备上等于无法删除。
- **分隔线只有 3 px 高**，鼠标命中区偏窄；这是「不遮挡两侧内容」的直接代价。
- **侧边栏高度变化不会自动重新钳制**：只在渲染、窗口 `resize`、头部重建时重算。真站上 `#d-sidebar` 高度是否随滚动/头部折叠变化未实测；若会变，需要 `ResizeObserver`。
- **未 push**：`main` 上 3.2.0 的发布仍未授权；本分支未推送到远端。
- **`perf/` 产物不可复算**（已记入 `docs/discourse/04-消息总线与主线程成本.md` §八）：原始 trace 与四个分析工具从未入库。
- **`docs/` 的链接与索引无自动化校验**：新增或改名主题文件后须人工核对 `docs/INDEX.md` 与各级 `README.md` 的相对层级（子目录互链为 `../<部分>/<文件>.md`）。
- **`CONTEXT.md` 未纳入新术语**：`Read Later Section`、`Preview Card`、`Preview Availability` 只在 `docs/feed/02-稍后再读.md` 的术语小节。

## 后续任务

真站再核对（拖入四个位置、拖昵称/用户名、拖出删除、拖动排序、拖分隔线看内容是否稳定、两标签页同步、`/onebox` 的登录与 429、语言切换），再决定是否 push。

Updated: 2026-10-25 01:20 中国标准时间 +0800
