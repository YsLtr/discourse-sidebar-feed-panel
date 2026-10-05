# vite-plugin-monkey 重构方案

日期：2026-10-05。分析基线：`main` / `9554763`，业务脚本版本 `2.2.3`，最近实现提交 `47794f3`。

本文件保留最初方案，并记录分阶段实施进度。

## 实施进度（2026-10-05，2.3.0 开发版本）

- P0：已保存 2.2.3 元数据基线，登记三处文档/实现差异；本轮按原实现行为迁移。
- P1：已接入锁定版本的 Vite/vite-plugin-monkey、显式 GM imports、版本与元数据配置及产物校验。最终入口为 `src/main.ts`，业务主体已迁移 TypeScript。根目录同步方案已按用户后续决定撤销。
- P2：已抽出 CSS、文案、存储、页面桥接、路由观察、站点数据/标签缓存、查询、已读规则和滚动绑定；滚动检查器直接消费模块 fixture，保留历史源码输入方式。
- P3：已拆出偏好、resident/unavailable、incoming、reading、refresh 和自动补页限速；控制器协调查询、操作 token、请求取消和订阅。三处差异按 2.2.3 实际行为保留，并已同步领域文档。
- P4：已拆宿主、控件、话题条目、列表/锚点；应用源码全部通过严格 TypeScript 检查。完整 start/activate/deactivate/dispose 已实现，包含缺失宿主、拖拽、平滑回顶、标签 iframe 和缓存异步加载的清理。同页重启不会重复注册菜单；开发仍使用整页刷新。
- 已建立规则测试、旧版函数行为对照和构建包浏览器检查；详见[完整性审计](migration-completeness-audit-2026-10-05.md)。默认滚动 fixture 保留 12 项检查；完整 CSS 诊断在旧版和新版均未采到阻塞期间的帧交换样本，详见[验证说明](development.md#full-css-scroll-diagnostic)。
- P5 本地验证命令、CI 和版本校验已实现。当前不保留根目录或 dist 产物，后续改为 Release 发布；发布流程与 URL 尚未调整。真实脚本管理器安装升级、真实站点长驻唤醒和移动端触摸仍待实测。新增 CI 尚未经远端运行。

本轮没有发布到远端。操作入口、实际模块边界和复现命令见[开发与验证说明](development.md)。

以下章节保留最初分析与阶段退出条件；原始结构、待办式措辞和 2.2.3 行号描述的是迁移前基线，当前完成情况以上述进度和开发文档为准。

## 1. 推荐路线

采用 **Vite + vite-plugin-monkey + 原生 DOM + 渐进式 TypeScript**。先建立可重复构建，再按状态所有权拆模块，最后迁移类型和完善生命周期。最终仍发布一个 `discourse-sidebar-feed-panel.user.js`。

vite-plugin-monkey 负责开发入口、GM API 桥接、元数据生成和发布打包。Feed Panel 的查询、候选合并、阅读状态、滚动与 Discourse 适配继续由项目自己的模块实现。

第一期沿用现有 DOM、CSS 类名和交互。Vue/React、虚拟列表、Shadow DOM、跨站自动探测、稍后再读和翻译兼容分别留作后续需求。当前 UI 深度使用 Discourse 的 CSS 变量、分类徽章和 SVG 图标，直接保留原生 DOM 的迁移成本最低。结构迁移本身不解决站点 Glimmer/message-bus 的多秒主线程阻塞。

## 2. 现状与拆分依据

当前仓库没有 `package.json`、构建配置或 npm 测试体系。主脚本共 5,617 行，以一个 IIFE 组织所有功能；约 1,150 行是注入 CSS。源码同时充当用户安装文件。

| 当前部分 | 代码定位（2.2.3 行号） | 迁移目标 |
| --- | --- | --- |
| 元数据、GM 存储、LinuxDO 旧设置迁移 | 1–106，`_siteStorageKey`、`_migrateLegacyLinuxDoStorage` | 元数据配置、`platform/gm`、`preferences` |
| 偏好、数据、请求、计时器、DOM 引用的共享变量 | 132–229 | 各模块持有自己的状态，由应用层组合 |
| Discourse 环境、导航、语言、格式化 | 234–542 | `platform/discourse`、`i18n`、小型工具模块 |
| 站点能力、导航分类、分类缓存、标签样式 | 544–1403 | `site`，拆开数据读取和 DOM 样式提取 |
| CSS 注入 | 1406–2562，`injectStyles` | `styles/feed.css`，保持显式注入 |
| 宿主、开关、宽度、挂载与停用 | 2565–2857 | `ui/host`、`app` |
| 顶部控件、分类标签、筛选、设置浮层 | 2860–3524 | `ui/controls`，按实际复杂度继续拆分 |
| 顶部动作、incoming、限速 | 3526–4264 | `feed/reading`、`feed/incoming`、`feed/controller` |
| 查询、加载、刷新、合并、保留数量 | 4267–4943 | `feed/query`、`feed/resident`、`feed/controller`、`feed/refresh` |
| 异常话题、已读规则、条目渲染 | 4962–5429 | `feed/read-state`、`feed/unavailable`、`ui/topic-item` |
| 原生滚动、分页、路由监视、初始化 | 5432–5617 | `ui/scroll`、`ui/topic-list`、`platform/route-watcher`、`app` |

拆分优先级由依赖决定：文案/CSS/纯函数最容易先移动；`_mergeAndRenderTopics` 同时修改数据、候选、分页和 DOM，必须在明确状态所有权后拆；`loadTopics`、`_applySidebarIncomingTopics` 等流程函数最后迁移。

### 必须先记录的文档与代码差异

以下差异会影响验收标准。机械搬迁阶段保留基线行为；进入对应规则的重写阶段前，要明确是修订文档还是单独修复实现，并给出独立用例，不在“拆文件”提交里顺手选择一种行为。

| 问题 | 文档描述 | 当前实现 | 对重构的影响 |
| --- | --- | --- | --- |
| Incoming Candidate Limit | `CONTEXT.md` 将候选保留上限与 Resident Topic Limit 关联 | `_touchSidebarIncomingTopicId` 累积去重候选；提醒计数不按保留数量截断；`_incomingLoadTopicLimit()` 只限制每次详情加载为一页 | 分清全部候选、提醒候选、当次加载 ID，不能合成一个有限长数组 |
| 自动刷新容量门槛 | `CONTEXT.md` 规定超过 Resident Topic Limit 三倍时跳过自动刷新 | `_shouldSkipAutomaticRefresh()` 只检查不可见/闲置及是否在实际顶部，没有三倍容量判断 | 不把文档中的门槛误报为已实现，也不在迁移中默默新增 |
| “第一屏内”与“实际顶部” | 文档以一个 viewport 区分 Head/Away 阅读状态 | `_isAwayFromHead()` 为 `scrollTop > clientHeight`；自动刷新门槛用 `_isAtFeedHead()`，即 `scrollTop <= 1`；Away 状态还有回到实际顶部才解除的锁定逻辑 | 分开保存按钮阅读状态与自动刷新资格，不能用一个 `isAtTop` 布尔值替代全部规则 |

`CONTEXT.md` 中的 Rendered Topic Window 是领域概念，现码 `renderTopics()` 实际会重建当前过滤结果，追加旧页则增量插入；目前没有独立的虚拟列表实现。不能以“迁移现有虚拟列表”为前提设计。

## 3. 工程接入与发布

### 已验证的工具组合

2026-10-05 从官方 npm registry 核对：

- `vite-plugin-monkey@8.1.1` 的 Vite peer 范围为 `^8.0.0`。
- `vite@8.3.2` 的 Node 要求为 `^20.19.0 || >=22.12.0`。
- 当前完整开发/测试工具链采用更严格的 `^22.20.0 || ^24.12.0 || >=26.0.0`，以覆盖锁定 Vitest 和可选 Linux LZMA binding；Vite 自身要求不等于项目全部工具的支持范围。
- 本机 Node `22.23.2`、npm `10.9.8` 已完成临时构建。实施时锁定经过验证的版本并提交 `package-lock.json`，使用 `npm ci` 重现环境。

第一步将现有主体移动到 `src/main.js`，去掉手写元数据；保留 IIFE 和内部结构，只补充 GM API 的显式导入。Vite 配置可使用 TypeScript，业务 JavaScript 不需要同时全部改成 TypeScript。

建议的 `vite.config.ts` 形态：

```ts
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { userscript } from './build/userscript';

export default defineConfig({
  build: {
    outDir: 'dist',
    minify: false,
    sourcemap: false,
  },
  plugins: [
    monkey({
      entry: 'src/main.js', // 完成业务类型迁移后改成 src/main.ts
      userscript,
      server: { open: false, prefix: (name) => `dev:${name}` },
      build: {
        fileName: 'discourse-sidebar-feed-panel.user.js',
        metaFileName: false,
        autoGrant: false,
      },
    }),
  ],
});
```

`build/userscript.ts` 使用插件的 `MonkeyUserScript` 类型，显式配置元数据。版本从 `package.json` 读取，README 版本由发布检查校验。必须保留：

- `name: 'Discourse Sidebar Feed Panel'`、`namespace: 'https://linux.do/'`，以及作者、描述、图标、MIT 许可证。
- 四个现有 match：LinuxDO、NodeLoc、Chrultrabook Forum、OpenAI Community；用户仍可在脚本管理器中添加其他站点。
- 原有 `downloadURL` / `updateURL`，两者仍指向 GitHub `main` 的根目录 `.user.js`。
- `run-at: 'document-idle'` 和顶层窗口执行检查。
- 六项显式 grant：`GM_addStyle`、`GM_getValue`、`GM_setValue`、`GM_deleteValue`、`GM_registerMenuCommand`、`unsafeWindow`。

固定 grant 便于审阅权限变化；本次已验证 `autoGrant: false` 配合显式 grant 能正确构建。后续新增 API 时一起修改配置并校验产物。无需新增 `GM_xmlhttpRequest` / `@connect`：当前接口是同源 `fetch`。也无需配置运行时 CDN `externalGlobals` 或新增 `@require`。

统一在 GM 适配层导入 API：

```ts
import {
  GM_addStyle,
  GM_getValue,
  GM_setValue,
  GM_deleteValue,
  GM_registerMenuCommand,
  unsafeWindow,
} from '$';
```

`$` 是该版本插件的默认 client alias；TypeScript 配置包含 `vite/client` 和 `vite-plugin-monkey/client`。第一步可以把这段导入放在旧主体入口，随后集中进 `platform/gm.ts`。继续使用同步 `GM_getValue` / `GM_setValue` 语义，避免同时改为异步存储而改变启动顺序。

实施时的开发入口验证发现，8.1.1 的字符串 `prefix` 会成为整个名字，因此配置使用回调追加前缀。实际 `vite.config.ts` 还在 serve 模式移除正式 downloadURL/updateURL，`npm run check:dev` 验证开发元数据与模块转换。

### CSS 与开发模式

CSS 首先整体移到一个文件，保留规则顺序及所有 `.sfp-*` 选择器。现有 CSS 模板没有 JavaScript 插值，可使用 `import cssText from './styles/feed.css?inline'`，在启动阶段调用 `GM_addStyle(cssText)`。这样样式注入时机和销毁责任明确，也避免自动 CSS 注入和手动注入重复执行。

初期使用整页刷新开发。开发脚本通过 Vite 开发入口安装，`dev:` 前缀用于区分正式脚本；目标站点只启用一个版本。开发脚本可能使用独立的 GM 存储，不能用它代替正式身份下的升级迁移测试。

稳定的完整卸载实现之前，不增加手写 HMR accept / 重复初始化逻辑。以后若支持应用热替换，必须先释放旧实例、阻止旧请求回写、保证菜单与全局入口不重复注册。开发服务器入口只用于开发；三个脚本管理器均需验证最终构建文件。页面 CSP、HTTPS 站点访问本地开发服务器以及页面环境桥接的兼容性需要实际验证，构建成功不等于这些问题已解决。

### 当前产物策略（按用户后续决定调整）

当前流程：`src/ → vite build → 临时 dist/*.user.js → 校验`。

根目录文件已删除，不再自动恢复；`dist/`、`node_modules/` 忽略，dist 验证后可以保留，不再例行清理。保留 `perf/`、`*.trace.json` 忽略规则。后续另行配置 Release 分发与更新 URL，本轮完成迁移审计及交接提交。禁止把仓库根目录设为可清空的 `outDir`。

建议命令职责：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发入口 |
| `npm run build` | 生成 dist 安装包，不发布 |
| `npm run typecheck` | 模块类型检查；Vite 构建不代替类型检查 |
| `npm test` | 查询、数据合并及生命周期规则测试 |
| `npm run check:scroll` | 生成滚动 fixture 并调用 Chrome 检查器 |
| `npm run check:artifact` | 检查元数据、权限、单文件输出及无开发服务器引用 |

CI 用相同锁文件执行构建、规则测试、滚动检查和产物检查，不再检查根目录文件。滚动检查需要 Chrome 与 Python `websocket-client`，在非本机环境通过 `--chrome` 指定路径。元数据暂保留旧版发布身份与 URL，用于兼容性对照；正式发布前必须完成独立的 Release 流程调整。

结构迁移首个正式版本应递增版本号，具体版本在发布时确定；临时试验使用 `2.2.3` 仅用于元数据对比。

## 4. 模块边界与状态所有权

以下是最终建议结构，按阶段创建；不要在第一步就把所有目录建成空壳。

```text
build/
  userscript.ts
src/
  main.ts
  app.ts
  preferences.ts
  i18n.ts
  platform/
    gm.ts
    discourse.ts
    route-watcher.ts
  site/
    site-data.ts
    categories.ts
    tag-styles.ts
  feed/
    types.ts
    query.ts
    read-state.ts
    resident.ts
    unavailable.ts
    incoming.ts
    reading.ts
    refresh.ts
    controller.ts
  ui/
    host.ts
    controls.ts
    topic-item.ts
    topic-list.ts
    scroll.ts
  styles/
    feed.css
tests/
  unit/
  browser/
tools/
  check-scroll-isolation.py
  build-scroll-fixture.mjs
  check-artifact.mjs
  sync-userscript.mjs
vite.config.ts
tsconfig.json
package.json
package-lock.json
discourse-sidebar-feed-panel.user.js
```

依赖方向为 `main → app → controller / UI / platform`。Feed 规则模块只依赖数据类型和显式参数；UI 通过回调调用 controller；platform 适配层不反向导入 controller。由 `app` 注入接口、时钟、存储、渲染回调和 disposer。

| 状态所有者 | 持有内容 | 边界 |
| --- | --- | --- |
| `preferences` | 开关、宽度、排序、周期、分类、筛选、刷新偏好 | 唯一负责偏好持久化；存储 key 和 origin 隔离规则不变 |
| `site` | 站点能力、分类索引、导航分类、标签样式及加载 Promise | 不持有 Feed 的 DOM，不因重建面板重复抓取站点数据 |
| `feed/controller` | 当前查询、请求 token、loading、待重载和待应用操作 | 唯一协调加载/刷新流程，拒绝过期响应 |
| `feed/resident` | Resident Topics、loaded IDs、Topic Display User Map、页深和分页信号 | 合并、裁剪、去重通过明确方法执行 |
| `feed/incoming` | 去重候选、粗筛缓存、提醒候选、待加载候选 | 区分计数和加载批次；不直接修改 DOM |
| `feed/reading` / `refresh` | 阅读状态、动作选择、刷新资格、时钟与倒计时 | 规则可测试；DOM 测量由 UI 提供 |
| `ui` | 面板引用、浮层、拖拽、滚动锚点、动画 | 不读写 GM 存储，不直接发 API 请求 |
| `app` / 平台适配 | 全页订阅、observer、路由包装、全局入口、清理集合 | 负责启动、挂载恢复及完整销毁 |

不建立任意模块都能修改的 `globalState.ts`。过渡期可以保留一个旧 controller 闭包，但新抽出的模块应通过参数和返回值连接，不通过相互导入可变变量连接。

`FeedQuery.snapshot()` 改由 controller 提供数据，`key(query)` 和 `buildUrl(query, page, categories)` 保持纯函数。`_mergeAndRenderTopics()` 最终拆成“合并数据并返回变化信息”和“保存锚点、渲染、恢复锚点”两个步骤，保持原有执行顺序和本地已读合并规则。

TypeScript 优先覆盖 `FeedQuery`、Topic/API 可选字段、分类能力、Incoming 状态、Scroll Anchor 和请求状态。外部 JSON 在适配边界处理缺失字段；不要把大量断言或 `any` 当作类型迁移完成。纯函数可用 Vitest 测试；真实滚动仍使用现有 Chrome/CDP 检查，不用模拟 DOM 环境代替。

### 生命周期必须成为显式接口

建议提供 `start()`、`activate()`、`deactivate()`、`dispose()`：启动注册全页能力；激活挂载 Feed；停用清理 Feed 并恢复宿主；销毁释放应用持有的全页资源。

现码需要特别处理的地方：

- `RouteWatcher.start()` 包装 `history.pushState/replaceState` 并添加匿名 `popstate` 回调，`stop()` 仅断开 observer。改为可移除的具名回调；恢复 history 前确认当前函数仍为本实例的包装，避免覆盖其他脚本后来安装的包装。
- `body` 的 `MutationObserver` 有明确的宿主重建用途。先保留观察范围，回调保持轻量并保证挂载幂等；不要在重构时删除观察或借每次 DOM 变化重建全部 Feed。
- `_setupPageActivityTracking`、全局关闭浮层 click、拖拽期间 document 监听、debounce、RAF、计时器、标签抓取 iframe 均需有清理归属。
- incoming 的 `/latest`、`/new` 与异常话题的 `/delete`、`/recover`、`/destroy` 两组订阅继续独立启停，不能因停止 incoming 而丢失其他排序下的异常话题跟踪。
- 所有异步回调保留 query 快照与操作 token；可增加 AbortController 来取消请求，但仍需 token 拦截已经完成或无法取消的回调。覆盖 A→B→A、关闭后返回、旧实例销毁后返回等场景。
- 当前 `deactivateFeed()` 在找不到 sidebar 时直接返回。新清理接口必须在宿主已经被站点移除时仍能停止订阅、计时器并使请求失效。
- 菜单注册放在页面级 bootstrap，只注册一次；保留 `SFPFeedPanel.clearCaches()`。第一期整页刷新无需增加菜单权限。若后续同页重启要注销菜单，应明确引入 `GM_unregisterMenuCommand` 及相应 grant，不假定现有权限已经支持。
- `dispose()` 先使旧回调失效，再释放监听与 DOM；模块导入阶段不做存储迁移、订阅、样式注入或挂载。iframe 顶层检查通过后才执行有副作用的启动流程。

页面环境访问集中在 `platform/discourse.ts`，包括 `unsafeWindow.Discourse`、message-bus lookup、`window.require('discourse/lib/url')` 导航与缓存控制入口。Discourse 的页面模块加载器属于运行时适配，不把其模块名称当成 npm 依赖交给 Vite 解析。第一期保留已验证的导航桥接方式，直接调用页面对象等变化另行验证。

## 5. 分阶段实施与退出条件

| 阶段 | 工作 | 完成标准 |
| --- | --- | --- |
| P0：基线固化 | 记录 2.2.3 元数据和关键行为；登记上述三处规则差异；保留滚动基线 | 有明确对照源码、检查命令和规则差异清单 |
| P1：只接构建 | 添加 npm/Vite/monkey；旧主体进入 `src/main.js`；显式 GM imports；元数据生成和根目录产物同步 | 单 `.user.js`；身份/权限/URL 等价；管理器安装及基本 Feed 冒烟通过 |
| P2：抽取低耦合部分 | CSS、文案、存储、页面适配、站点数据、查询与已读纯函数；同步改造滚动 fixture | key 迁移、分类和 URL 用例通过；滚动 12 项仍通过 |
| P3：拆业务状态 | 明确差异项决策；拆 resident/incoming/reading/refresh/controller；保留原渲染路径 | 竞态、合并、分页、异常话题和顶部动作测试通过，无循环依赖 |
| P4：UI 与生命周期 | 拆宿主/控件/条目/滚动；完整清理；逐模块完成 TS；最终入口改为 main.ts | 反复开关、宿主替换、路由切换及销毁后响应通过；无重复订阅或计时器 |
| P5：发布验收 | CI、版本、README、生成产物一致性；三个脚本管理器和真实站点验证 | 从正式旧版升级保留设置，单文件可独立运行，真实长驻/唤醒及触摸结果有记录 |

每阶段形成可单独审阅和回退的变更。格式化旧主体、业务行为修复、UI 重写分别提交，便于确认行为变化的来源。正式发布失败时从保留的稳定源码重建修复版本，并使用递增版本号发布；不要依赖管理器自动安装一个更低版本来回滚。

## 6. 回归范围

优先为会在拆分中被改变的关键规则补测试，不为每个工具函数或文件移动编写形式化测试。

| 验证面 | 必须覆盖的行为 |
| --- | --- |
| 存储与升级 | 原 `sfp_site:${encodeURIComponent(origin)}:${key}`；LinuxDO 旧 key 迁移不覆盖已存在站点值；清理旧 key；`default → activity`；其他 origin 隔离 |
| 站点适配 | 只挂载 Native Sidebar Host；导航分类缺失只显示“全部”；父分类包含子分类；站点能力控制排序/筛选；中英文及未知语言回退 |
| 查询与分页 | latest/top 的周期语义；本地页号递增；`more_topics_url` 只作 More Pages Signal；裁剪后仍可加载旧页；查询切换重置页深和限速 |
| 并发 | 分类/排序/筛选快速切换后旧响应不回写；加载期间重复刷新；停用、销毁和宿主替换时的在途请求 |
| 保留与合并 | 本地已读不被旧服务器快照覆盖；刷新后页深重置；裁剪同时释放 loaded IDs 并重建首位 poster 用户映射；追加旧页不走刷新裁剪 |
| Incoming | 提醒计数与当次取详情数量分离；同轮消息合批；深读只积累；点击数量先回顶再应用；回顶被打断时保留候选 |
| 自动刷新 | 手动刷新与自动 gate 分离；闲置/隐藏页面；0 秒静默刷新与 interval 路径；离开头部冻结与回顶恢复；三处差异按决策后的标准测试 |
| 异常话题 | 真正消失与正常下沉区分；排序位置、独立订阅、保留名额豁免；累计新进入话题达到限额时过期；全量切换清除 |
| DOM 与交互 | 每个 Topic Item 始终包含一个已读点，已读使用 `visibility: hidden`；时间行位置不变；普通点击/中键/修饰键导航；宽度、分类拖拽、浮层 |
| 生命周期 | 重复开关和宿主重建后只有一个 Feed；订阅和监听不叠加；全局入口可用；已销毁实例不再改 DOM |
| 产物与升级 | 元数据等价；只有指定安装文件；无运行时模块分片/CDN/开发服务器依赖；保留旧设置和管理器自定义匹配规则 |

### 滚动检查器先适配，再移动实现

`tools/check-scroll-isolation.py` 当前通过 `^  function ...` 找函数，并在单文件中抓取 `.sfp-feed-scroll` CSS。临时构建确认：即使关闭压缩，Vite 输出排版已经使函数匹配失败。因此不能只把 `--source` 改为 dist 文件就宣称检查器可用。

建议新增 fixture 构建入口，直接导入真实 `ui/scroll` 与 `feed.css?inline`，仅替换“读取加载状态、请求加载、同步阅读状态”等依赖；把真实模块打包成 fixture 的内联 JS/CSS，再让现有 Python/CDP 代码加载它。检查器保留旧 `--source` 模式用于运行 2.2.2/2.2.3 历史基线，新增 fixture 输入模式用于模块化版本。

不要把滚动实现复制进测试。测试入口和正式入口使用同一实现；正式安装包另外做浏览器冒烟，避免只有 isolated fixture 正确。

保留原 12 项检查，尤其是：边界/短内容 wheel 和 touch、重复绑定后仅加载一次、首次 wheel 没有 renderer-main acknowledgement、1.4 秒主线程阻塞期间已渲染内容仍可滚动。Feed 区域继续依赖 `overscroll-behavior-y: contain` 和 `touch-action: pan-y pinch-zoom`，只保留 passive 观察；分类横向标签栏的 wheel 映射维持独立。

真实站点的长驻、睡眠唤醒和真实移动端触摸仍须单独验证。新内容加载和楼层指示依赖主线程，不能把这些停顿当成原生滚动隔离失败，也不能把隔离 fixture 通过当成已消除站点卡顿。

## 7. 本次核验结果与参考

本次临时试验将完整 2.2.3 主体加上 `$` 的显式 GM imports，以 Vite 8.3.2 + vite-plugin-monkey 8.1.1 构建，未安装到真实站点：

- `vite build` 成功，输出一个 178,486 字节的 `.user.js`。
- `node --check` 成功。
- 按字段和值集合比较，构建前后元数据等价；原有 name、namespace、版本、match、grant 和更新地址均保留。
- 未新增 `@require`，输出没有顶层 ESM import。
- 原滚动检查器的函数正则不能匹配构建产物，已作为必改项纳入 P2。

这些结果证明初始构建方案可行；模块化后的业务、CSS 提取、开发服务器桥接和脚本管理器运行兼容性尚待实施验证。构建体积变化不代表运行性能提升。

参考：

- [项目领域约束](../CONTEXT.md)、[README](../README.md)。
- [ADR 0001：离开头部冻结刷新](adr/0001-freeze-refresh-away-from-head.md)。
- [ADR 0002：按 match 跨站支持](adr/0002-match-based-cross-site-support.md)。
- [ADR 0003：原生滚动隔离](adr/0003-native-feed-scroll-isolation.md)。
- [滚动响应调查](scroll-responsiveness-analysis-2026-10-05.md)。
- [vite-plugin-monkey 官方仓库](https://github.com/lisonge/vite-plugin-monkey)。
- [vite-plugin-monkey 8.1.1 官方 npm 元数据](https://registry.npmjs.org/vite-plugin-monkey/8.1.1)、[Vite 8.3.2 官方 npm 元数据](https://registry.npmjs.org/vite/8.3.2)。

官网文档本次 TLS 连接失败；配置字段依据官方 npm 包内 `dist/node/index.d.mts`、`client.d.ts`、实现及上述构建试验核对，未将无法访问的网页视为已验证来源。
