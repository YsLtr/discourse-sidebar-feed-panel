# 15:35 对照：主线程阻塞还在，滚动已能独立继续

输入：`perf/Trace-20261005T153526.json.gz`。用户关闭插件和侧边栏脚本后，观察到：**滚动正常，但新内容加载不出来，右侧楼层不随滚动更新**。

**实施更新**：用户随后授权改善脚本。2.2.3 已移除 Feed 滚动区的非 passive 边界拦截；实现和回归结果见文末。以下保留修复前的取证过程。

这一现象得到 trace 支持：页面主线程仍被 message-bus 回调连续占用 **6.324 秒**，而滚动输入在这段时间内走合成线程并及时显示。它不是“完全不卡”，也不应描述为整个浏览器或全部页面操作一起冻结。

## 仍然存在的站点长任务

本次主线程 `pid=34092, tid=31268`，相对零点为 `1222387323417 μs`。记录长约 20.651 秒。

- 长任务：**2.308427～8.631960 秒**，共 **6,323.533 ms**。
- 来源：`https://ping.ldstatic.com/message-bus/…/poll` 的 XHRLoad。
- 站点 FunctionCall：**5,594.332 ms**。
- 后续 RunMicrotasks：**728.758 ms**。
- CPU 采样热点：Glimmer tag 依赖校验 `lt` 约 **2,054 ms**，`insertAdjacentHTML` 约 **1,990 ms**。两项包含在上述阶段内，不重复相加。
- 整份记录里，Bitwarden 和 `Discourse-Sidebar-Feed-Panel.user.js` 的可见 FunctionCall 都是 **0**。

关闭范围需按证据表述：UTags、Content Preserver、星号密码显示助手以及其他扩展仍有调用。因此这是“Bitwarden 与侧边栏脚本不再执行”的对照，不能当作完全无扩展的纯站点基线。

## 为什么仍能滚动

对最长任务窗口内的输入事件读取 `chrome_latency_info.component_info`：

| 指标 | 12:11，侧边栏脚本运行 | 15:35，侧边栏脚本无调用 |
|---|---:|---:|
| 主线程长任务 | 8.265 s | 6.324 s |
| 窗口内开始的 GestureScrollUpdate | 11 | 48 |
| 含输入至 frame swap 完整时间的样本 | 10 | 48 |
| 输入至 frame swap 中位数 | **5,882.854 ms** | **12.774 ms** |
| 输入至 frame swap 最大值 | **8,394.578 ms** | **21.595 ms** |
| 窗口内页面 EventDispatch | 0 | 0 |

15:35 的 48 个滚动更新全部包含 `COMPONENT_INPUT_EVENT_LATENCY_RENDERING_SCHEDULED_IMPL`，输入至 frame swap 为 **1.219～21.595 ms**，完成时间都在主线程长任务结束前。页面进程的合成线程在该窗口记录了 **309 次 DrawFrame**，说明并非仅有静止截图或操作系统光标在移动。

与此同时，鼠标进入页面主线程的等待最长仍约 **6.15 秒**，窗口内一次 MouseDown 等待约 **1.85 秒**。没有任何页面 EventDispatch 在这段长任务里执行。EventTiming 虽有记录，但它的开始时间代表输入发生时间，不能误认为主线程当时已经处理了事件。

因此用户描述的组合非常合理：

```text
滚动已有内容 → 合成线程移动已有图层 → 继续响应
加载后续帖子 / 更新右侧楼层 → 需要主线程处理滚动和页面逻辑 → 等待
```

frame swap 是 trace 的显示管线节点，不等同于显示器真实发光时刻；上述比较使用两份记录中同一节点。Browser 级 InputLatency 没有给出具体 DOM 目标，页面 EventTiming、页面合成线程活动和用户的操作描述共同支撑此次解释。

## 侧边栏脚本里存在可修的输入依赖

修复前的 `discourse-sidebar-feed-panel.user.js` 中：

- `_setupScrollLoadMore()` 在 **5449～5465 行附近**给 Feed 滚动区安装 `passive: false` 的 wheel 监听；在边界处调用 `preventDefault()`。
- 同一区域的 touchmove 监听也为非 passive。
- 分类标签栏在 **3444 行附近**使用 wheel 的 `preventDefault()` 将纵向滚轮转换为横向滚动。
- Feed 滚动区 CSS 在 **2095 行附近**已经有 `overscroll-behavior-y: contain`，以及 `touch-action: pan-y pinch-zoom`。

非 passive wheel 监听意味着浏览器需要等页面确认是否取消默认滚动。**回调自身只执行零点几毫秒，也可能在主线程忙碌时先排队几秒，让滚动一起停住。** 因而“回调耗时小”只能说明它没有直接消耗那些 CPU 时间，不能说明它没有影响输入调度。

12:11 记录有对应的实际调用证据：主线程长任务在 **9.479838 秒**结束，随后 **9.483912 秒**派发 wheel，耗时仅 **0.333 ms**，其子调用包含 `Discourse-Sidebar-Feed-Panel.user.js:7035:44`。该录制版本的源码行号与当前移除诊断代码后的版本不同。15:35 相应位置的 wheel 回调不再含该脚本。

以上支持：脚本的非 passive 滚轮拦截是 **Feed 区域滚动被主线程卡顿拖住的优先修复对象**。它不是 6 秒站点同步渲染的制造者。两份录制的 DOM 目标、其他扩展和消息负载并非严格相同，因此还不能把所有区域的差异都归到这一处监听。

## 对此前归因的修正和下一步

现在应区分两个问题：

1. **什么让主线程忙几秒？** message-bus 响应中的 Glimmer 依赖校验和 DOM 插入；Bitwarden 在最早记录中又显著增加了后续观察回调成本。
2. **为什么连滚动也停住？** 滚动是否需要等待主线程。Feed 的非 passive 边界拦截给这种等待提供了直接机制，低 CPU 自耗时不能为它排除这一影响。

脚本侧的具体候选改动是：在支持现有 overscroll CSS 的目标浏览器中，去掉 Feed 区域用于阻止滚动串联的非 passive wheel/touchmove 处理，保留被动 scroll 监听用于加载和状态更新；分类栏的滚轮横向映射单独评估。验证时需同时检查上下边界不会带动正文、触摸缩放行为，以及模拟主线程忙碌时 Feed 已有内容仍可滚动。该改动改善输入路径，不能让加载新帖或右侧楼层在主线程阻塞期间继续运行。

本次仅完成分析，没有修改用户脚本。

复算证据：

```powershell
python perf/compare-wake-traces.py perf/Trace-20261005T153526.json.gz
python perf/analyze-wake-input.py perf/Trace-20261005T121135.json.gz
python perf/analyze-wake-input.py perf/Trace-20261005T153526.json.gz
```

输出为各自的 `*.comparison.json`、`*.input.json`。后者保留滚动时延、EventTiming 和长任务结束后 wheel 的具体子调用。

## 2.2.3 实施与验证

用户授权后，已删除 `_setupScrollLoadMore()` 中的非 passive wheel/touchmove 监听、触点跟踪及不再使用的 `isAtScrollBoundary()`。滚动边界继续使用既有 `overscroll-behavior-y: contain` 和 `touch-action: pan-y pinch-zoom`。加载更多和顶部/离开顶部状态的 passive scroll 回调保留。

分类标签栏的纵向滚轮转横向滚动没有改动，该区域仍需要 JavaScript。此补丁不改变站点 message-bus、查询、驻留话题窗口或已读点布局，也不使新内容加载和楼层更新在主线程阻塞期间继续运行。

回归脚本 `tools/check-scroll-isolation.py` 使用实际源码中的滚动函数与 CSS，构造隔离 Chrome 页面。Chrome 154.0.8037.93 实测：

| 验证项 | 2.2.2 基线 | 2.2.3 |
|---|---|---|
| 一轮滚动的 wheel 是否需要 renderer-main 确认 | **1 次，失败** | **0 次，通过** |
| 主线程忙 1.4 秒期间，已开始的滚动继续显示 | 通过 | 通过，98 个窗口内样本，中位 14.135 ms，最大 27.539 ms |
| 滚轮上下边界、内容不足一屏时不带动正文 | 通过 | 通过 |
| 触摸中段可滚动，上下边界及短列表不串到正文 | 通过 | 通过 |
| 重复绑定后，底部只触发一次加载且阅读状态回调仍执行 | 通过 | 通过 |

新版总计 **12 项检查通过**，另通过 `node --check` 和 `git diff --check`。

这里真正区分新旧的回归项是**首次 wheel 的主线程确认路径消失**，不是连续滚动延迟降低：Chrome 对已经开始的手势可能允许后续 wheel 非阻塞，因此旧版也能通过连续滚动测试。测试在页面忙碌前启动持续手势，让浏览器在忙碌期间继续产生输入，避免把新发 CDP 命令本身等待坐标转换的耗时算成页面滚动耗时。

隔离测试使用加载/状态回调桩，并不重放真实站点全部 message-bus 数据；实际论坛睡眠唤醒和真实移动设备仍需后续使用验证。安装 2.2.3 后应刷新页面，使旧监听器被清理。

复算新版：

```powershell
python tools/check-scroll-isolation.py --label after
```

依赖 Python `websocket-client` 和本机 Chrome；可以通过 `--chrome` 指定浏览器路径，`--source` 指定要比较的用户脚本文件。结果与小型测试 trace 保存在 `perf/scroll-isolation/`，不会修改站点或用户的浏览器配置。
