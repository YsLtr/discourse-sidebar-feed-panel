# 2026-10-05 唤醒卡顿 trace 独立复核

输入：`perf/Trace-20261005T084754.json.gz`。独立流式解析全部 2,671,322 个事件；复核程序为 `perf/verify-wake-trace.py`，输出为 `perf/verified-wake-trace.txt`。这是对已有 `freeze-trace-analysis-2026-10-05.md` 的复核与补充，不代表已完成现场修复验证。

**后续更新**：12:11 的禁用扩展记录再次捕获 **8.26 秒 message-bus 主线程长任务**，其中站点处理 7.63 秒，Bitwarden 调用为零。10:47 未复现不能解释为根因已经消除；完整证据和 `lt` 源码定位见 [12:11 trace 分析](init-trace-analysis-2026-10-05.md)。

## 确认的直接原因

页面主线程 `pid=34092, tid=31268` 在相对时间 **8.298202～20.156791 秒**执行一个 **11.858589 秒**的 RunTask。相对零点为该线程最早 X 事件 `1197938391570 μs`。

该任务包含 `https://ping.ldstatic.com/message-bus/…/poll` 的 XHRLoad。这里的时长是响应回调处理时间，不能理解为网络下载用了 11.86 秒。

| 连续阶段 | 相对起点 | 耗时 | 证据 |
|---|---:|---:|---|
| 站点响应处理及同步渲染 | 8.299123 s | 5.500908 s | `FunctionCall`, `chunk-hue237mp.digested.js:15:8071` |
| 后续微任务批次 | 13.800103 s | 6.356479 s | `RunMicrotasks` |

这两段都在同一个任务里，页面主线程没有机会正常处理后续鼠标交互、悬停效果和依赖主线程的滚动更新。它能解释页面无法跟随鼠标的症状；trace 显示的是长时间阻塞，不能据此称为永久死锁。

## 站点在做什么

复核 CPU Profile 后，主要热点仍是：

- 原生 `insertAdjacentHTML`：约 **2.45 秒**采样自耗时。
- 站点压缩函数 `lt`：约 **1.38 秒**采样自耗时，处于 `evaluate → rerender → renderRoots/revalidate` 的渲染链上，包含递归调用。
- `countCategoryByState`：约 **58 毫秒**，不是主导热点。

最重的 HTML 插入采样栈由外到内可简写为：

```text
XHR 响应 success
  → Discourse 回调 ce / le
  → run loop join / flush
  → revalidate / renderRoots / rerender
  → 列表 sync / insertItem
  → appendDynamicHTML / trustedContent
  → __appendHTML / insertHTMLBefore
  → insertAdjacentHTML
```

因此能确认的是消息响应中的渲染和 HTML 插入成本很高。仅凭 trace 无法确定具体组件、确切消息条数，也不能证明“每一条消息都重建了全部 DOM”。“睡眠后积压消息补发”符合场景，但需要响应内容或分发计数才能证实。

## 最值得追查的扩展异常：13 个脚本身份执行同一个观察回调

扩展 ID：`bmnpopeennajofpobnoapccokbbppohj`。现有项目记录将其确认为 Bitwarden；原始 trace 可直接确认以下 URL 和函数：

```text
content/bootstrap-autofill-overlay.js
CollectAutofillContentService.handleMutationObserverMutation
```

这个函数在同一微任务批次中有 **13 次重调用**，每次 **355.985～516.129 毫秒**，累计 **5,124.034 毫秒含子调用耗时**。其中包含约 **1,747.050 毫秒 MinorGC**，所以不能把这两项再次相加。

更关键的是，这 13 次调用在相同页面 frame 和 isolate 下，分别使用不同的 `scriptId`：

```text
2886, 3147, 3256, 3269, 3549, 3557, 3571,
3583, 3592, 3606, 3615, 4031, 3662
```

这不是仅看到同一脚本身份的一次慢调用；它提示多个编译脚本实例的观察回调同时参与处理，**重复注入、扩展重载后旧观察器未清理**是优先验证的原因。`scriptId` 本身不能证明具体注入机制，也不能直接等同于已数出 13 个存活 MutationObserver 对象。

同一窗口全体 MinorGC 为 **40 次、2,209.318 毫秒**。它们分布于上述阶段内部，不能再与 5.50 秒、6.36 秒相加；也不能把全部 GC 都归到 Bitwarden。

## 侧边栏脚本的归属

该阻塞窗口内，带 `Discourse-Sidebar-Feed-Panel.user.js` URL 的 FunctionCall 只有一条，耗时 **0.070 毫秒**，位于 14.345650 秒。

结合重栈指向站点渲染和扩展观察回调，本次直接执行瓶颈没有指向侧边栏脚本。但 URL 标记调用很少不等于排除了它在更早时间对 DOM 状态产生的所有间接影响。

## 对旧报告测量方法和结论的修正

1. 旧分析器将 `ProfileChunk.ts` 当作每块采样起点，并按块的 `tid` 归属采样。应按 `(pid, profile id)` 拼接，从 `Profile.args.data.startTime` 连续累加 `timeDeltas`，线程归属取 Profile 事件。此次已独立重算；热点顺序基本不变，函数耗时取近似值。
2. 旧分析器默认丢掉小于 200 μs 的部分 X 事件，因而旧报告的轮询总次数不完整；跨线程汇总也不能当成主线程的严格占比。
3. `CpuProfiler::StartProfiling` 有一次 3.31 秒事件位于其他进程。它不是页面主线程的直接调用分支，但不能仅因它在别的线程就断言录制开销与卡顿完全无关。trace 中部分 `tdur` 甚至大于 `dur`，本报告采用 `ts/dur` 时间轴，不使用该异常线程时间推算 CPU 利用率。
4. 禁用 Bitwarden 后是否恰好从 11.86 秒降到 5.50 秒，不能用减法保证；GC、其他观察器和录制开销会改变。需要做同场景对照。

## 最短验证路径

1. 暂时禁用该 Bitwarden 扩展，**重新加载页面**后重复睡眠/唤醒场景，检查 13 个观察回调和后半段微任务长阻塞是否消失。重载是为了清理已经注入的代码与观察器。
2. 扩展启用时，比较全新加载页面与长期驻留页面：统计同名回调涉及的 `scriptId` 数量，判断是否随使用或扩展重载增长。若关闭自动填充浮层设置，也应重新加载后再测。
3. 若站点部分仍有秒级阻塞，继续采集 poll 消息数量及 `rerender → insertItem → insertAdjacentHTML` 对应组件。优化方向是合并消息带来的状态更新、减少同步列表插入并让批处理让出主线程。

本次只完成归因和可复算证据留存，未改动用户脚本，也未执行扩展开关或现场 A/B 验证。

## 用户禁用 Bitwarden 后的新记录：10:47 对照

用户随后提供 `perf/Trace-20261005T104725.json.gz`，说明已经禁用 Bitwarden，且没有明显卡顿。对两份 trace 使用相同的 `perf/compare-wake-traces.py` 重算，结果分别保存在同目录 `*.comparison.json`。

**新记录没有重现原来的十余秒冻结，且 Bitwarden 的调用完全消失，支持它是本次卡顿的重要致因。**

| 指标 | 08:47，扩展启用 | 10:47，扩展禁用 |
|---|---:|---:|
| 主线程记录跨度 | 61.33 秒 | 76.26 秒 |
| 最长 `RunTask` | 11,858.589 ms | 487.855 ms |
| 最长 `RunMicrotasks` | 6,356.479 ms | 524.156 ms |
| 超过 1 秒的 `RunTask` | 1 | 0 |
| Bitwarden URL 的 `FunctionCall` 次数 | 64,440 | 0 |
| 全记录 MinorGC/MajorGC 区间并集 | 2,583.667 ms | 614.485 ms |
| 侧边栏脚本 `FunctionCall` 次数 | 1,593 | 1,745 |
| 侧边栏脚本最长一次 `FunctionCall` | 7.345 ms | 7.342 ms |
| 捕获的 message-bus `XHRLoad` 次数 | 17 | 1 |
| 最长 message-bus `XHRLoad` | 11,857.501 ms | 0.413 ms |

统计只针对页面 `CrRendererMain`，不把其他进程或子线程加进来。Bitwarden 调用次数计入该扩展 URL 下的全部 FunctionCall，不能等同于 MutationObserver 回调次数；前文的 13 次是旧冻结窗口中的特定重回调。

新记录最长可见主线程 X 事件为 **524.156 ms 的微任务**，大于所捕获的最长 RunTask；不能只报 487.855 ms 就声称所有主线程工作都短于该值。两者都远小于旧记录的 11.86 秒。新记录仍有 17 个超过 50 ms 的 RunTask，说明仍有短卡顿，不应表述成“完全没有卡顿”。

最长 RunTask 出现在相对 **48.532 秒**，来自话题请求 `/t/2983748.json?track_visit=true&forceLoad=true` 的响应处理；内部约 485 ms 是微任务和页面渲染。它不是之前的 message-bus 长回调。侧边栏脚本在新记录中持续执行，因此改善不是由侧边栏脚本同时停止工作造成的。

### 对因果关系的更新

旧记录已经直接显示 Bitwarden 在冻结窗口中占用大量主线程时间；禁用后的记录又显示其执行消失、秒级冻结不再出现。结合用户体感，**优先把 Bitwarden 的自动填充 DOM 观察及其多脚本实例问题作为排障对象，是有充分依据的**。

但这不是相同消息和 DOM 状态的严格重放。新记录只捕获到一个 0.413 ms 的 message-bus 完成回调，其余网络活动也不能直接换算为相同消息负载。不能据此断言旧站点渲染的 5.50 秒全部由 Bitwarden 造成，或断言禁用后已经覆盖相同规模的唤醒补发。前文“站点 5.50 秒 + 扩展/微任务 6.36 秒”是那次观测到的调用阶段，不是两个独立且固定的成本。

当前可以保留禁用状态，继续正常使用验证。若需要恢复密码填充功能，后续只改变自动填充浮层设置并重新加载页面，再观察较长时间驻留后的表现；是否这样做取决于用户需求，本次未操作扩展开关。

复算命令：

```powershell
python perf/compare-wake-traces.py perf/Trace-20261005T084754.json.gz
python perf/compare-wake-traces.py perf/Trace-20261005T104725.json.gz
```

CPU 采样按 Profile 身份及累计时间解码，并在遇到负采样间隔时排序时间点避免重叠计时；上表的主要结论直接取自 X 事件，不依赖采样自耗时估计。未改动用户脚本。
