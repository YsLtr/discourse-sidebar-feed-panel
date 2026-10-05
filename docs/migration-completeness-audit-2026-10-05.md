# vite-plugin-monkey 迁移完整性审计

日期：2026-10-05。范围：旧版 `2.2.3` → 当前未发布的 `2.3.0` TypeScript 模块与构建包。

首轮对照修复了四类迁移回归。用户随后反馈已测试、暂未发现问题，并要求子 agent 独立重新对照；第二轮又发现并修复三处性能/异常保护退化，另修正工具链 Node 支持范围。两轮发现的问题均已处理，当前覆盖范围内未发现其他迁移遗漏。用户手工测试范围未进一步限定，不能由此认定所有管理器、长驻唤醒及物理触摸设备均已验收。

## 第二轮：三个子 agent 独立复核

三个子 agent 均直接使用 Git 中 `47794f3` 的完整旧脚本，并独立检查当前源码/构建包；没有仅以既有报告或既有测试通过作为结论。主 agent 另核对冻结夹具的 33 个函数文本及源码 SHA-256，确认原样匹配 Git 基线。

| 复核范围 | 独立验证 | 结果 |
| --- | --- | --- |
| Feed 数据/控制器 | 100 个固定随机种子 × 250 步操作，对照追加、刷新合并、已读、删除/恢复、消失检测，共 25,000 步；另逐段检查限流/忙时队列/查询切换/计时器 | 数据状态对照一致；发现并修复候选插入复杂度退化和空生命周期消息兜底遗漏 |
| UI/样式/体验 | 两个隔离 Chrome 分别运行完整旧脚本和重构包，23 组快照/交互对照；全量 CSS 及中英文各 56 个键值直接比较 | 全部一致，无新增 UI 回归；包括浮层互斥、宽度边界/持久化、分类拖排、资料/中键跳转、已读点、失败重试、忙碌箭头、四种回顶中断与超时兜底 |
| 平台/缓存/工具链 | 37 组实际旧函数与当前站点服务差分：导航字段/路径解析、能力、预载 JSON、单/双接口失败、缓存形状/版本、并发请求复用；另模拟公开 API 只读/写入抛错 | 站点场景全部一致；发现并修复公开 API 发布失败阻断启动，以及 Node 支持声明超出依赖支持范围 |

本轮新增修复：

1. `feed/incoming.ts`：恢复候选 Set 索引。旧版新 ID 直接追加；迁移版每次都 `filter` 全量复制累积列表，同轮 n 个新候选变为 O(n²)。现在新 ID 保持 O(1) 追加，重复 ID 才移到末尾，remove/clear 同步索引，不截断候选计数。Node 局部微基准中 10,000 个唯一候选修复前约 183 ms，修复后约 0.59 ms、旧版约 0.64 ms；这是算法路径证据，不是实站卡顿或端到端速度测量。
2. `feed/resident.ts`：恢复 `null`/`undefined`、缺失和非有限 topic ID 的忽略保护。此前列表有条目时空消息会抛 TypeError；现在异常消息不影响现有条目及后续有效事件。
3. `app.ts`：恢复公开 `SFPFeedPanel` 写入的 try/catch，并沿用旧版对现有 API 对象的扩展方式。只读属性或桥接 setter 抛错时发出警告，Feed 与 GM 清缓存菜单照常启动；不会留下已缓存但从未启动的实例。实际构建包新增两个失败注入场景，均完成挂载和菜单清缓存重载。
4. `package.json` / 锁文件 / 开发说明：项目支持范围改为 `^22.20.0 || ^24.12.0 || >=26.0.0`，覆盖锁定 Vitest 的 Node 要求及可选 Linux LZMA binding 的更高补丁版本要求。没有升级依赖；本机验证使用 Node 22.23.2，CI 沿用 Node 22。

修复后完整复验：**44 项单元测试、31 项构建包浏览器检查通过**；严格类型检查（含 noUnusedLocals/noUnusedParameters）、构建、产物元数据和 whitespace 检查通过。滚动模块与 CSS 未改动，首轮 12 项滚动结果继续作为该部分证据，本轮 UI agent 额外核对了回顶中断行为。

独立审查的临时脚本/输出位于被忽略的 `perf/agent-feed-independent.mjs`、`perf/agent-ui-check.py`、`perf/agent-ui-results.json`、`perf/agent-ui-review.md`、`perf/agent-platform-site-parity.mjs`、`perf/agent-platform-api-fallback.mjs`、`perf/agent-platform-report.md`，新克隆不包含它们；已将确证问题对应的回归覆盖加入常规测试及本文，常规测试不依赖这些临时文件。

复核同时确认两个旧版边界：纯重复页不累计“连续空筛选停止”；刷新进行中仍可启动翻页，旧版也没有在该入口加入 isRefreshing 互斥。本次不把这两点算作迁移遗漏，也不夸大原有保护范围。

## 基线与行数

基线直接取自 `git show 47794f3:discourse-sidebar-feed-panel.user.js`，与迁移提交前的 HEAD `9554763` 的脚本内容一致。SHA-256：`ecd29ecbf502126827b190f60ac6dee963be8a7412c8b2c8b1589f15be39e572`。

| 文件范围 | 行数 | 字节数 |
| --- | ---: | ---: |
| Git 中的 2.2.3 单文件脚本 | 5,617（计入末尾空段为 5,618） | 199,116 |
| 审计前用户指出的迁移构建包 | 4,218（计入末尾空段） | 188,562 |
| 首轮修复后的临时构建包 | 4,252（计入末尾空段为 4,253） | 189,376 |
| 子 agent 复核修复后的临时构建包 | 4,268（计入末尾空段为 4,269） | 189,876 |

用户提到的 5,608 行与可复现 Git 基线略有差异，本次以 Git 内容为准。旧脚本 CSS 模板占约 1,155 行，构建时进入单个字符串；空行、注释、函数格式和模块打包也会改变行数。首轮结束时 `src/` 的 TypeScript、类型声明和 CSS 合计 7,538 行。构建包行数不能用于判断功能是否减少，也不应作为后续验收门槛。

## 首轮发现与修复

| 问题 | 旧版保护 | 审计前迁移差异 | 本轮修复与验证 |
| --- | --- | --- | --- |
| 宽度持久化 | mousemove 仅改变运行态/CSS，mouseup 写入一次 GM 存储 | `onWidth` 在每次 mousemove 调用偏好 setter，同步写存储 | `ui/host.ts` 在拖动时只预览宽度，松手保存一次；浏览器连续发送 15 次移动，检查途中无写入、松手恰好写入一次及移除监听器 |
| 首屏重复请求 | `isLoading` / `_pendingReload` 将加载期间的变更合并为一次后续重载 | 每次变更均取消并立即发送替代请求，丢失合并保护 | `feed/controller.ts` 使用当前加载轮次与 pending 标记；立即淘汰旧 token，等待旧轮次结束后只加载最新查询；即使 fetch 忽略 abort 也不会并发堆叠首屏请求；A→B→A 浏览器检查通过 |
| 生命周期记录积累 | 旧版没有新增的统一清理集合 | 使用全局 clearTimeout 取消 Lifetime 定时器，集合中的闭包不会删除；每次拖拽的 defer 在松手后也不删除 | `Lifetime.clearTimeout/cancelFrame` 同步释放跟踪项；相关调用改走所有者，拖拽结束解除 defer；500 次定时器与 RAF 取消后 dispose 无重复清理，已完成定时器也不保留 |
| 零秒静默刷新队列卡住 | 同轮 incoming 合并到 microtask，后续可继续应用 | 新增 viewEpoch 检查使旧 microtask 提前返回，但遗留 applyQueued=true；同轮切换筛选后无法排入新任务 | `invalidateRequests()` 释放旧轮次排队标记；保留候选供新查询重新筛选。新增真实构建包用例先复现超时，再验证修复后一次请求成功应用 incoming |

首屏合并同时保留迁移新增的过期响应保护。局部筛选变化若发生在首屏加载期间，也合并到后续最新快照；退出 Feed 会清空加载轮次，旧 finally 无法重启已销毁的视图。刷新/分页的 token 和 AbortController 继续生效。

## 行为对照范围

审计通过旧版函数与迁移模块逐组对照，再以冻结的旧版函数执行结果、浏览器构建包和现有滚动检查交叉验证。函数重命名、移入类方法和共享辅助函数不以“同名函数数量”判定等价。

| 行为与策略 | 迁移位置 | 核查证据 |
| --- | --- | --- |
| 站点匹配、脚本身份、六项 grant、document-idle、iframe 不启动 | `build/userscript.ts`、`platform/gm.ts`、`main.ts` | 元数据基线检查；入口源码核对；开发桥与生产单文件检查 |
| origin 隔离、15 个已发布存储键、LinuxDO 旧键迁移、default→activity、刷新偏好与宽度默认值 | `storage-keys.ts`、`preferences.ts` | 全量常量/键名对照，存储迁移与隔离测试，构建包 default 值迁移 |
| 预加载站点 JSON、`/site.json` 与 `/categories_and_latest.json` 独立失败兜底、缓存版本验证、重复加载复用、清缓存旧响应失效 | `site/site-data.ts` | 编码预加载、双接口部分/全部失败、旧缓存拒绝、缓存复用和 reset 竞态测试；失败后仅保留“全部”入口 |
| 分类仅取导航来源、旧 slug 标签迁移、父子分类与后代范围、能力驱动排序/周期/筛选 | `site/site-data.ts`、`feed/query.ts`、`controller.ts` | 分类/能力测试；216 组旧版 URL 对照覆盖全部排序、周期、分类/全部与页码；父链与包含子分类参数保留 |
| 标签缓存、名称/slug/id 别名、已有 DOM 样式提取、隐藏 `/tags` iframe、颜色/图标白名单及异常兜底 | `site/tag-styles.ts`、`appearance.ts` | 函数源码对照；保留 12 秒超时、250 ms 轮询、finally 移除 iframe；浏览器验证加载中销毁不会残留 iframe/轮询 |
| 原生侧栏宿主、宽度范围/恢复动画、开关、浮层、分类拖动排序、分类栏横向滚轮 | `ui/host.ts`、`controls.ts` | 函数与 CSS 对照；宽度 clamp 272–500、260 ms 清理、分类栏独立 wheel 映射保留；构建包挂载、替换宿主和拖拽保存检查 |
| 页码只按本地深度增加、more_topics_url 仅作 hasMore 信号、去重、手动加载/重试 | `feed/api.ts`、`resident.ts`、`controller.ts`、`ui/topic-list.ts` | 伪造远端 page=8 链接仍请求本地 page=1；503 后重试原页不跳页；失败保留已加载条目；请求携带 CSRF |
| 自动补页 300 ms 防抖、距底部小于 200 px、忙状态保护、5 秒最多 3 次、连续 3 次筛选无结果停止、手动旁路、查询变化重置 | `ui/scroll.ts`、`feed/auto-load.ts`、`controller.ts` | 旧版限流函数对照；浏览器验证三次空结果停止超过时间窗仍有效、第四次自动请求被限流、手动加载/重试可继续、切换筛选重置门控 |
| 刷新重置深度并裁剪、普通 append 不裁剪、释放 topic ID 与多余用户数据、本地已读状态单调合并 | `feed/resident.ts`、`read-state.ts` | 18 轮旧版合并函数对照；既有 resident 测试；构建包验证服务端旧快照不会把本地已读改回未读 |
| `/latest`、`/new` 推送候选去重/重排、缓存仅用于分类粗筛、未知 payload 保留、详情一页上限、累计计数与详情批次分离 | `feed/incoming.ts`、`controller.ts` | 旧版候选函数对照；浏览器 40 条同轮消息仅请求最新 30 条一次；message_type 与直接 payload 数据形状保留 |
| incoming 150 ms 筛选调度、零秒 microtask 合批、忙时延后、正间隔倒计时与非活动排序刷新分开 | `feed/controller.ts`、`refresh.ts` | 调度/守卫源码对照；零秒实际构建包批量请求；计时器重启不叠加、停止清理及倒计时重置测试 |
| 页面隐藏或 10 分钟无活动跳过自动刷新、离头超过一屏后 Away 锁定、真正回头才解除、scrollTop≤1 才可自动刷新 | `feed/reading.ts`、`refresh.ts`、`controller.ts` | 状态/空闲门控测试；浏览器离头时 incoming 保持排队，回到头部后才应用；保留缺失计时器恢复逻辑 |
| 平滑回顶、双击立即回顶、用户输入打断、1,200 ms 超时兜底、锚点与高度差兜底 | `ui/topic-list.ts`、`feed/controller.ts` | 源码逐项对照；构建包回顶后应用及销毁打断检查；先同步恢复锚点、再 RAF 复校保留 |
| 异常话题独立生命周期订阅、按排序位置保留、不占正常容量、新进入话题才推动过期、周期榜/置顶/同键/深页防误判 | `feed/unavailable.ts`、`resident.ts`、`controller.ts` | 96 组旧版消失检测对照；既有异常保留/恢复/过期测试；构建包独立 `/delete` 行为验证；`/destroy`、`/recover` 订阅源码核对 |
| 阅读链接决定已读、所有条目始终保留一个 dot、visibility:hidden、头像/作者/中键与修饰键跳转、状态徽章、3 个标签、10 秒高亮 | `feed/read-state.ts`、`ui/topic-item.ts`、`platform/discourse.ts` | 40 组阅读进度边界与旧版对照；渲染/跳转源码及 CSS 对照；构建包确认已读 dot 节点与时间横坐标不变 |
| 全量 CSS、浅深色/徽章样式与兼容降级、中英文文案、语言选择/时间格式 | `styles/feed.css`、`i18n.ts` | PostCSS 结构摘要一致，保留规则顺序/选择器/声明/important，忽略注释与排版；全部文案一致；12 组语言来源组合与时间边界对照 |
| 原生滚动隔离与无阻塞输入路径 | `ui/scroll.ts`、`styles/feed.css` | passive scroll、overscroll-behavior-y:contain、touch-action:pan-y pinch-zoom；默认滚动 fixture 12 项检查；没有恢复 Feed 的非被动 wheel/touchmove 边界处理器 |
| Ember 等待/稳定页头、SPA URL 变化/宿主重建、取消与销毁、公开清缓存/重启入口 | `platform/`、`app.ts`、`controller.ts` | 15 秒/500 ms Ember 等待、双 RAF、300 ms 激活延迟源码核对；构建包宿主替换、退出后旧响应、完整销毁、同页重启与单一菜单/订阅检查 |

### 与旧文档不同、但未在迁移中改写的行为

- incoming 提醒计数累计，详情请求最多一页；不会按当前驻留深度扩大请求批次。
- 旧代码没有“驻留数量超过三倍容量就禁止自动刷新”的门槛，本次没有添加或声称保留不存在的保护。
- Away 从超过一屏进入，直到真正回头解除；自动刷新门槛更严格，要求 `scrollTop <= 1`。
- 已读/未读筛选是本地操作，保留驻留深度；分类/排序/周期变化才重新加载。
- 连续空结果门控沿用旧语义：计数的是有新去重条目、但本地筛选没有可见项的自动补页。全重复页主要受窗口限速与 hasMore 约束。此次没有悄悄扩展这个停止条件。

迁移增加了请求取消、A→B→A token 失效、可销毁/重启生命周期、清缓存世代隔离、导航路径 JSON 转义及 API 异常行过滤。这些属于更严格的边界处理；不是业务功能的裁剪。

## 自动化与复现

冻结夹具 `tests/fixtures/2.2.3.behavior.json` 保存从 Git 原样提取的 33 个函数、FeedQuery 对象、常量、文案及 CSS 结构摘要，标记来源提交和完整源码哈希。测试使用旧函数的实际执行结果，DOM 渲染等副作用在数据对照中才被桩替代。`node tools/capture-migration-baseline.mjs` 可在含历史提交的仓库重新提取，普通测试不依赖 Git 历史，CI 浅克隆可直接运行。

```sh
npm ci
npm run typecheck
npm test
npm run check:dev
npm run build
python -m pip install -r requirements-dev.txt
npm run check:artifact
npm run check:browser
npm run check:scroll -- --label migration-audit
```

首轮结果：42 项单元测试、28 项构建包浏览器检查、12 项原生滚动检查通过；类型检查（含 noUnusedLocals/noUnusedParameters）、开发桥、构建与产物元数据检查通过。Chrome 154.0.8037.93 的首轮滚轮测试中 renderer-main acknowledgement 为 0；1.4 秒主线程阻塞窗口有 97 个滚动延迟样本，中位数 14.636 ms、最大 29.325 ms。这是本次夹具结果，不是与旧版真实站点的延迟降幅。可复查本地忽略产物 `perf/scroll-isolation/migration-audit.*`。

滚动 fixture 不等于实际论坛。此前可选 full-css 诊断在旧版和新版均未采到阻塞期间的帧交换样本，因此不把该诊断当作真实站点的延迟改善证据；详见 [Development / Full-CSS scroll diagnostic](development.md#full-css-scroll-diagnostic)。站点 Glimmer/message-bus 多秒主线程阻塞仍是既有独立问题。

## 当前产物与发布状态

按用户后续决定保留源码过程态：根目录 `.user.js` 不恢复，`dist/` 已被忽略，构建验证后可以保留本地产物，不再例行清理，也不提交其中的文件。已移除根目录同步命令与脚本、CI 根目录一致性检查，并更新两份 README 与开发说明。

正式 Release 分发、downloadURL/updateURL 与发布工作流留到下一轮。当前元数据仍保留旧版 URL 作为兼容性对照，不表示这个分支可直接发布。迁移、两轮审计修复及 `AGENTS.md` 交接记录按用户要求合并为一次本地提交，既有 `LICENSE` 署名改为 `YsLtr` 的修改一并纳入。未推送或发布；agent 未向用户浏览器安装脚本，用户已自行测试并反馈暂未发现问题。
