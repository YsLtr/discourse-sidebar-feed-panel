# Discourse Sidebar Feed Panel - Active Handoff

The userscript replaces a selected area of a Discourse forum with a compact, locally-filtered topic feed panel, hosted from the userscript metadata of a single built file. `CONTEXT.md` holds the domain terms; `docs/INDEX.md` indexes the durable contracts under `docs/`; this file records only the current session.

**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `main` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: 创建新分支设计「稍后再读」，随后按裁定实现，按真站反馈逐条修，最后合并进主分支并升版 3.3.0；随后适配话题关注度（跟踪/关注显示新回复数）。

## 本轮完成的工作

- **设计与裁定**（`e616e28`、`450e0f6`、`b3b90e8`、`d4eef17`）：设计稿 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md)；迁移对照基线整体移除（项目已无旧版本需要迁移）。
- **实现**（`ec49d36`）：新增 `src/read-later.ts`（纯逻辑）与 `src/ui/read-later.ts`（DOM），控制器接线，样式、文案、常量，两个新单测文件，夹具与浏览器检查。
- **文档转契约**（`64b979e`）：设计稿状态改为现行契约并补 `file:line`。
- **两轮真站反馈修正**（`08501a4`、`91c8ce0`、`49b3766`）：共 13 处，见下。
- **第三轮真站反馈修正**（`c84537b`）：8 处，见下。行为细节以 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md) 为契约，不再在本文复述。
- **第四轮真站反馈修正**（`be3d4da`）：5 处，见下。
- **话题关注度适配**（`3.4.0`）：`notification_level >= 2`（跟踪/关注/关注第一帖）且 `unread_posts` 大于 0 时，时间后的未读圆点换成新回复数徽章（`>99` 显示 `99+`，`title` 为「N 条新回复」）。判定在 [src/feed/read-state.ts](src/feed/read-state.ts) 的 `_unreadReplyCount`，与 Discourse `Unread#unread_posts`、`topic-footer-buttons.gjs:98` 的 `>= TRACKING` 一致：静音/常规级别服务端恒给 0，从未打开过的话题同样给 0，这两种情况仍显示圆点。字段直接来自 `latest.json` 的 `notification_level`（`listable_topic_serializer.rb:24,96`），无新增请求、无新设置项。三条刷新链（手动/自动/静默）都会重新拉 topic 数据，计数随之更新；message-bus 的 `/latest` payload 不含计数，只当触发信号。`#d-menu-portals > div > div > ul` 是 Discourse 原生话题菜单，与本脚本无关。
- **静默刷新补齐稍后再读**（`3.4.1`）：增量刷新路径此前只合并主列表，条目快照要等下一次手动刷新才更新。现在 `_applySidebarIncomingTopics()` 拿到数据后调 `applyReadLaterSnapshot()`，用纯函数 `mergeTopicSnapshot()` 覆盖命中条目（标题、新回复数、首个 poster），**不发任何请求**；这一轮没取到的话题原样保留，不猜、不补拉。见契约 §五。
- **话题快照页内缓存 + latest 优先**（`3.4.3`）：`src/ui/read-later.ts` 新增 `topicCache`（渲染到带快照的条目时记下 `topic`/`user`/`title`，控制器 `addReadLaterLink()` 经 `cachedTopic()` 复用，删掉再加回来不再请求 latest）。同时改掉「两路并发」：话题在渲染时**不再**排 `/onebox`，只有 `syncReadLater()` 这一轮 latest 结束（成功或失败，`signal.aborted` 时除外）仍没有快照的，才由 `settleTopicPreviews()` 退到预览；回退拿到的卡片进 `previewCache`，删掉再加回来也不重发。见契约 §四.2、§四.3、§五。
- **新回复数不再被本地点击清零**（`3.4.2`）：此前 `_applyReadMarker()` 把 `unread_posts`/`new_posts` 置 0、`markRead()` 连 `.sfp-unread-count` 一起藏，于是点开一个还有 N 条新回复的话题，徽章当场消失，下次刷新又被服务端数字顶回来。现在本地标记只推进 `last_read_post_number`/`is_seen`/`unseen`，计数原样留给刷新覆盖；`markRead()` 只藏圆点。未读筛选不受影响——它判的是 `_isTopicRead`（跳转 URL 是否带楼层号），不是计数。


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

- 第五、六轮真站反馈（`d463df2`…`3a89c61`，共 6 个提交）：列表恢复正序、预览页内缓存、重复拖入幂等并移到最新、onebox 失败回退 OG、条目高取最近分隔线那条、隐形命中区与把手命中条，细节见契约 [docs/feed/02-稍后再读.md](docs/feed/02-稍后再读.md)。
- `feat/read-later` 已快进合并进 `main`（`3a89c61`）；`main` 领先 `origin/main` 38 个提交。
- 版本升到 **3.4.3**：`npm version 3.4.3 --no-git-tag-version`，`package.json` 与 `package-lock.json` 同步；根目录 3.0.0 迁移快照保持不变。
- 3.4.1 只改一处：增量刷新（`_applySidebarIncomingTopics()`）拿到数据后用 `mergeTopicSnapshot()` 校正命中条目，**不发请求**；这一轮没取到的话题保持原样（见契约 §五）。
- 3.4.2 只改两处：`_applyReadMarker()` 不再把 `unread_posts`/`new_posts` 置 0，`markRead()` 只藏圆点不藏计数。
- 3.4.3 只改两处：话题快照进页内缓存（`topicCache`/`cachedTopic()`），话题不再在渲染时并发排 `/onebox`，改由 latest 结束后 `settleTopicPreviews()` 兜底。
- 完整校验全绿：typecheck 0、14 文件 / 92 单测、`check:dev`、`build`、`check:artifact`、`check:scroll`、`check:browser` **116 项**。
- **本机注意**：`npm test` / `npm run build` 的 Vite 配置加载会 `exec("net use")`，在受限文件沙箱下报 `spawn EPERM`；本机已切到 danger-full-access，不是代码问题。

## 未决问题

- **`/onebox` 未在真站跑过**：端点、模板与客户端节奏都来自本机 Discourse 克隆（`app/controllers/onebox_controller.rb`、`lib/oneboxer.rb`、`frontend/pretty-text/addon/oneboxer.js`）；`requires_login`、`recently_failed?` 与「同一用户一个预览」的排队行为属发布前人工核对项。夹具里的 `/onebox` 是模拟的。
- **昵称/用户名拖出**依次尝试指针位置、`target` 祖先与文本选区；三者都指不到发布者 span 时仍会退回话题链接。
- **删除与排序只有拖动**：没有按钮，也没有键盘等价操作；触摸设备上等于无法删除。
- **分隔线只有 3 px 高**，鼠标命中区偏窄；这是「不遮挡两侧内容」的直接代价。
- **侧边栏高度变化不会自动重新钳制**：只在渲染、窗口 `resize`、头部重建时重算。真站上 `#d-sidebar` 高度是否随滚动/头部折叠变化未实测；若会变，需要 `ResizeObserver`。
- **话题关注度的真站核对**：`notification_level` 只在登录用户且 `user_data` 存在时才序列化；未登录或 `latest.json` 未带该字段时 `_unreadReplyCount` 返回 0，继续显示圆点。真站需确认跟踪/关注话题确实带出 `notification_level >= 2` 且 `unread_posts > 0`。
- **未 push**：`main` 上 3.4.3 的发布尚未授权，本地提交只在本地。
- **`perf/` 产物不可复算**（已记入 `docs/discourse/04-消息总线与主线程成本.md` §八）：原始 trace 与四个分析工具从未入库。
- **`docs/` 的链接与索引无自动化校验**：新增或改名主题文件后须人工核对 `docs/INDEX.md` 与各级 `README.md` 的相对层级（子目录互链为 `../<部分>/<文件>.md`）。
- **`CONTEXT.md` 未纳入新术语**：`Read Later Section`、`Preview Card`、`Preview Availability` 只在 `docs/feed/02-稍后再读.md` 的术语小节。

## 后续任务

真站再核对（拖入四个位置、拖昵称/用户名、拖出删除、拖动排序、拖分隔线看内容是否稳定、两标签页同步、`/onebox` 的登录与 429、语言切换），再决定是否 push。

Updated: 2026-10-25 16:05 中国标准时间 +0800
