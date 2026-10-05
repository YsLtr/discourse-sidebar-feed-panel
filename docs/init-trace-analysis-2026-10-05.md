# 12:11 trace：禁用 Bitwarden 后仍出现的消息处理长阻塞

输入：`perf/Trace-20261005T121135.json.gz`。用户描述为 init 时卡住，恢复后才开始 trace。复算输出：`perf/Trace-20261005T121135.comparison.json`。

## 结论

**文件中实际包含一次完整的 8.265 秒主线程长任务，主因是 message-bus 响应触发的 Glimmer 依赖校验和同步渲染。该窗口没有 Bitwarden 调用。** 这不能仅凭用户感知时间就等同于录制前那次卡顿，但足以证明：关闭 Bitwarden 后，站点这条链路仍可单独导致秒级失去响应。

之前 10:47 的记录没有重现大规模消息处理，因此“关闭扩展后没有卡顿”只成立于那段观测。本记录补上了反例：Bitwarden 是旧记录中的明显放大器，不能作为全部卡顿的唯一解释。

## 为什么打开 trace 容易错过它

页面主线程为 `pid=34092, tid=31268`，本报告相对零点为该线程最早 X 事件 `1210161579310 μs`。

- 文件实际覆盖约 **19.151 秒**。
- 长任务起止：**1.215117～9.479838 秒**，持续 **8,264.721 ms**。
- 元数据 `modifications.initialBreadcrumb.window.min` 为 `1210169825585 μs`，即保存的默认视图从相对 **8.246275 秒**开始，只覆盖长任务末尾约 1.23 秒。
- `hiddenEntries` 为空；事件并未被删除，主要是默认查看范围截去了前半段。

在 Performance 中回到最上层时间范围或缩小到完整录制，查看 **1.2～9.5 秒**即可看到。不要仅根据保存的当前视图判断录制没有抓到。

主线程 `CpuProfiler::StartProfiling` 位于 **0.002～0.393 秒**，约 **391 ms**。它和 1.215 秒开始的消息回调是不同事件，不能把后者全部解释为 DevTools 初始化开销。录制仍可能放大时间成本，不能据此推算未录制时的精确耗时。

## 8.26 秒具体花在哪里

| 同一个 RunTask 内的连续阶段 | 起点 | 时长 |
|---|---:|---:|
| message-bus 响应中的站点 FunctionCall | 1.215282 s | **7,634.898 ms** |
| 随后的 RunMicrotasks | 8.850239 s | **629.188 ms** |

回调 URL：`https://ping.ldstatic.com/message-bus/…/poll`。站点 FunctionCall 来自 `chunk-hue237mp.digested.js:15:8071`。XHRLoad 时长是主线程处理响应的耗时，不是网络等待时长。

窗口内 CPU 采样热点（约数，不与上表再次相加）：

| 函数/操作 | 采样自耗时 | 含义 |
|---|---:|---|
| `lt` | **5,087 ms** | Glimmer 响应式依赖 tag 的递归校验 |
| `insertAdjacentHTML` | **1,271 ms** | 渲染链中的原生 HTML 插入 |
| `(garbage collector)` | **260 ms** | 垃圾回收；X 事件 GC 区间并集约 248 ms |
| `countCategoryByState` | **36 ms** | 存在分类状态扫描，但不是主导成本 |

微任务里还能看到 UTags 的 `handleMutations` **191 ms**，其他扩展的 `onDomChanged` / `observerHandler` 等数十毫秒级调用。它们属于后半段约 629 ms 的成本，无法解释站点前半段的 7.63 秒。

本次全记录 Bitwarden URL 的 FunctionCall 为 **0**，CPU 采样也没有该扩展。长任务窗口内带侧边栏脚本 URL 的 FunctionCall 为 **1 次、0.075 ms**。这只界定可见的直接执行占用，不排除其他时间的间接 DOM 影响。

## `lt` 已定位到具体源码语义

之前仅凭压缩函数名无法辨认的 `lt`，本次已成功取得同哈希资源：

`https://cdn3.ldstatic.com/assets/br/chunk-d5qas15v.digested.js`

本地副本：`perf/chunk-d5qas15v.digested.js`。所有对应采样节点的位置均为零基 `lineNumber=3, columnNumber=7581`；该位置精确对应 `lt` 类的 `[ot]()` 方法，其中 `ot = Symbol('TAG_COMPUTE')`。

源码能直接看到它的工作：

- 保存 `revision`、`lastChecked`、`lastValue` 和 `subtag`。
- 当前全局 revision 与 `lastChecked` 不同时重算。
- `subtag` 为数组时逐一调用每个子 tag 的 `[TAG_COMPUTE]()`，否则递归调用单个子 tag。
- 将依赖 revision 合并成 `lastValue`，供 `validateTag` 决定渲染是否需要更新。

调用栈同时包含 `evaluate → _execute → renderRoots → revalidate → flush`，与该语义吻合。源码导出的 validator 模块也包含 `validateTag`、`valueForTag`、`updateTag` 等名称。

因此本次可以将主要热点准确表述为 **Glimmer 依赖图的同步校验**，而不只是泛称“某个递归函数”。不过采样没有记录依赖图对象和消息体，仍不能确定是哪一个组件、多少个依赖，或是否存在异常循环。正常的嵌套依赖本来也会递归，不能仅看到递归就断言死循环或框架 bug。

该资源引用的 source map 返回 HTTP 204、无内容；上述定位依赖实际压缩源码与 trace 行列号的匹配，不依赖 source map。

## 三份记录合起来的判断

| 记录 | 站点重回调 | 后续微任务 | 是否有 Bitwarden |
|---|---:|---:|---|
| 08:47，旧冻结窗口 | 5.50 s | 6.36 s | 有，多脚本身份重回调 |
| 10:47，禁用后的较流畅窗口 | 未重现同级消息长回调 | 最长 0.52 s | 无 |
| 12:11，本次冻结窗口 | **7.63 s** | **0.63 s** | **无** |

两次重卡顿的共同点是消息响应中的同步渲染；Bitwarden 显著增加了第一次的后续 DOM 观察成本。各次消息和 DOM 负载不同，不能按两列相减估算关闭扩展的精确收益。

后续若继续修因，取证重点应转到消息批次触发多少次 render/flush，以及哪些组件的依赖图在 `TAG_COMPUTE` 中被反复检查。可以考虑合并状态更新、减少重复校验/渲染，但在定位具体组件前，不宜用修改侧边栏刷新逻辑来冒充修复。

本次未改动用户脚本。复算命令：

```powershell
python perf/compare-wake-traces.py perf/Trace-20261005T121135.json.gz
```
