# 冻结 trace 分析报告(首次拿到浏览器内核级归因)

**输入**: `perf/Trace-20261005T084754.json.gz`(44MB gzip → **569.9MB** 明文)
**工具**: `tools/analyze-trace.cjs`(流式解析,不整载)
**规模**: 61.33s 时间轴,解析事件 2,671,322 条,保留关注事件 137,942 条
**日期**: 2026-10-05

---

## 0. 结论(一句话)

**那次卡顿是一次 `message-bus` 轮询响应的回调,在主线程上连续跑了 11.86 秒。** 其中:
- **5.50s** 是站点自己的代码(懒加载 chunk `chunk-hue237mp.digested.js`);
- **约 3.2s** 是 **Bitwarden Password Manager**(扩展 ID `bmnpopeennajofpobnoapccokbbppohj`)的 content script 在同一个微任务批次里被反复调用 13 次;
- **约 2.0s** 是它引发的 V8 MinorGC;
- **本项目的 userscript 在该窗口内累计只跑了 0.1ms。**

---

## 1. 冻结的调用栈(主线程,完整还原)

```
+8298.2ms  RunTask                                            11858.6ms (自 0.1ms)
 └ ResourceRequestSender::OnRequestComplete                   11857.7ms
   └ URLLoader::Context::OnCompletedRequest                   11857.7ms
     └ XHRLoad  https://ping.ldstatic.com/message-bus/<id>/poll 11857.5ms   ← message-bus 轮询的 onload
       └ v8::Debugger::AsyncTaskRun                           11857.5ms
         └ v8.callFunction                                    11857.5ms
           ├ RunMicrotasks                                     6356.5ms (自 69.6ms)
           │  ├ v8::Debugger::AsyncTaskRun → v8.callFunction
           │  │   └ FunctionCall  chrome-extension://bmnpope…/content/bootstrap-autofill-overlay.js   380.3ms (自 244.2ms)
           │  ├ …同形态共 13 次(每次 356~380ms,自耗时 226~314ms)
           │  ├ MinorGC ×~10                                       152~192ms 每次(合计约 2.0s)
           │  └ FunctionCall  chrome-extension://dhdgffk…/userscript.html?name=…(UTags)              225.9ms (自 204.5ms)
           └ FunctionCall  https://cdn3.ldstatic.com/assets/br/chunk-hue237mp.digested.js            5500.9ms (自 5222.6ms)
```

要点:
- 冻结**不是**滚轮/点击处理,也**不是**我们的刷新链路 —— 它就是**一次轮询响应的处理**。
- `RunMicrotasks`(微任务批次)与站点 chunk 是**并列**的两大块:**6.36s + 5.50s ≈ 11.86s**。
- 微任务批次里几乎全是那个扩展的 content script 调用 + 它引发的 GC。

## 2. 这次的轮询是 1000 倍离群值(佐证「补发爆发」)

同一 trace 里所有 message-bus 轮询的 `XHRLoad` 时长:

| 时刻 | 时长 |
|---|---|
| **+8299.1ms** | **11857.5ms** ← 冻结 |
| +54030.1ms | 71.3ms |
| +46033.1ms | 66.3ms |
| 其余 7 次 | 0.6 ~ 11.9ms |

平时约 **8~12ms**,那一次是 **11857ms**。⇒ 该次轮询确实带回了一批需要大量处理的补发消息(与源码分析一致:唤醒/断线后客户端用旧位置 poll,服务端回放保留窗口)。

## 3. 全 trace 归属(必须三分,否则会把别人家扩展算成我们)

| 类别 | 自耗时合计 | 占 61.3s | 调用次数 |
|---|---|---|---|
| ① 我方脚本 `Discourse-Sidebar-Feed-Panel.user.js` | **248.9ms** | **0.41%** | 1,593 |
| ② 其它 Tampermonkey 脚本(UTags 等) | 584.2ms | 0.95% | — |
| ③ 其它浏览器扩展 | **9348.1ms** | **15.24%** | — |
| ③-a 其中 Bitwarden(`bmnpopeennajofpobnoapccokbbppohj`)的 `content/bootstrap-autofill-overlay.js` | **8971.8ms** | 14.63% | **64,436** |

**冻结窗口(+8298~+20160ms)内我方脚本累计事件时长:0.1ms。**

## 4. 「GIF 没停、但鼠标输入卡住、滚不动」的机制 —— 已确认

- **输入本身极快**:滚轮 140 条最长 **0.5ms**;滚动 1911 条最长 **1.9ms**;布局/样式重算 3279 条合计 1454.8ms。
- ⇒ **不是"被抢滚动"**,而是**主线程被 11.86s 的任务独占**,排在其后的输入/滚动全部拿不到执行机会。
- **合成器/GPU 线程照常活动**:窗口内 `GpuVSyncThread` 889 事件、`CrGpuMain` 1598、`ImageDecodeTask` 自 1360ms、`RasterTask` 自 388ms、`CompositeLayers` 正常。
- ⇒ **动画 GIF 由合成器/专用解码驱动,主线程卡死时照常播** —— 你观察到的"GIF 没停"正是"主线程独占"的特征签名。

## 5. 被本 trace 否掉的假设

| 假设 | 判定 | 依据 |
|---|---|---|
| 我方 `_restoreFeedScrollAnchor` 在抢滚动 | **否** | 滚轮/滚动事件最长 1.9ms,无争抢痕迹 |
| 卡顿发生在我们的刷新链路 | **否** | 冻结块是轮询 XHR 回调;窗口内我方 0.1ms |
| LoAF 报 `oursMs: 0` 可作为我方免责证据 | **本就无效,现被替代** | 本 trace 直接按 URL 归因,我方 0.41%(且冻结窗口内 0.1ms)——这次是**正面证据**,不依赖 LoAF |
| 滚动/输入密集导致卡顿 | **否** | 输入事件数量大但每条都极快 |

## 6. 必须声明的测量开销(不要当成页面问题)

- `CpuProfiler::StartProfiling` **3308.8ms @ +12624.6ms**:位于**非页面主线程**(主线程树中不出现),属 DevTools 采样分析器自身的开销。
- 录制开始处 `CpuProfiler::StartProfiling` 783.6ms(+27.9ms)与 292.8ms(+88.7ms):录制启动成本(调试器附着到扩展的隔离世界)。
- ⇒ 这些**不构成长帧**,与 11.86s 冻结无因果关系;但说明"边录边卡"时 trace 里会混入工具开销。

## 7. 行动项(可验证)

1. **已确认该扩展 = Bitwarden Password Manager**(用户核对 `chrome://extensions/?id=bmnpopeennajofpobnoapccokbbppohj`)。trace 里它同时注入 `content/bootstrap-autofill-overlay.js` 与 `content/fido2-page-script.js`,与「自动填充 + 通行密钥」的密码管理器特征吻合。
2. **可falsify的预测**:临时禁用该扩展后重复同一场景 —— 预期冻结从 ≈11.9s 降到 ≈5.5s(站点那 5.5s 不受影响)。若降幅吻合,则本报告的三分账成立。
3. **站点那 5.5s 不是我们能修的**:那是 Discourse 的消息处理链(源码比对报告见 `docs/message-bus-source-comparison.md`)。
4. 我方脚本当前贡献可忽略(0.41%),**无需为了这个卡顿改代码**;若要进一步降低干扰面,仍建议把每消息回调里的强制布局读/DOM 写改为批处理(见比对报告第 5 节)。

## 9. 站点那 5.5 秒在干什么 —— 函数级实测(解码 trace 内嵌 CPU 采样)

`--cpuwin=8299:20160` 解码采样(窗口内主线程 36,764 个采样点,按函数自耗时排序):

| 归属 | 函数(自耗时) | 位置 |
|---|---|---|
| **站点** | `insertAdjacentHTML`(原生)**2437.0ms** ← 由 `insertHTMLBefore` 调用 | `chunk-yz2ioxql.digested.js:0` |
| **站点** | `lt` **1380.9ms**,其中 **`lt ← lt` 自递归 1365.9ms** | `chunk-d5qas15v.digested.js:3` |
| **站点** | `(anonymous)` 127.5ms;`countCategoryByState` **58.2ms**(其调用者 `(anonymous)` 120.8ms) | `discourse-dtwvtxcn.digested.js:173` |
| **站点** | `(anonymous)` 101.8ms、`insertHTMLBefore` 80.7ms、`__appendHTML` 80.7ms、`il` 83.4ms | `chunk-yz2ioxql.digested.js:0` |
| **站点** | `Gp` 83.5ms(←`removeChild`)、`removeChild` 84.2ms、`insertBefore` 102.9ms | `chunk-d5qas15v` / 原生 |
| **Bitwarden** | `CollectAutofillContentService.handleMutationObserverMutation` **1990.6ms** | `bootstrap-autofill-overlay.js:25111` |
| **Bitwarden** | `shouldListenToTopLayerCandidate` 541.9ms(其内 `get attributes` 原生 **194.0ms**)、`checkMutationsInShadowRoots` 231.2ms、`isPopoverAttribute` 48.0ms | 同上 |
| GC | `(garbage collector)` **2400.6ms** | — |
| 其它扩展 | UTags `handleMutations` 121.8ms、`foceohgl…/content.js:119` 105.7ms、`jcokkip…observerHandler` 90.9ms | — |

站点侧合计约 **4.5s**(与 X 事件树里那 5.5s 帧吻合,其余为零星项)。

### 机制(实测链)

1. **那次 poll 带回积压**:该次 `XHRLoad` = 11857ms,其余 9 次 0.6~71ms(平时 8~12ms)—— **1000 倍离群值**。
2. **同步分发**:`processMessages`(message-bus-client 4.6.0 dist:107-140)「消息 × 全部回调」双层循环,不 yield、不分片。
3. **站点处理每条消息都触发 DOM 重建**:窗口内站点最大单项是**原生 `insertAdjacentHTML` 2.44s**,调用者为 `insertHTMLBefore`(Ember/Glimmer 的 DOM 构建路径)⇒ 是**用 HTML 字符串反复插入元素**,不是增量打补丁;配套还有 `removeChild`、`insertBefore`。
4. **另有一个自递归紧循环** `lt` 1.38s(`lt ← lt`,中间无其它帧)。
5. **分配风暴引发 GC 2.40s**。
6. **DOM 变更唤醒 Bitwarden 的 MutationObserver**:`handleMutationObserverMutation` 2.0s + `checkMutationsInShadowRoots` 0.23s + `shouldListenToTopLayerCandidate` 0.54s(内含读属性 0.19s)≈ **3.0s** —— 即**站点的 DOM 抖动被 Bitwarden 放大**。
7. **全部跑在同一个任务里** ⇒ 输入没有机会被处理 ⇒「GIF 照跳但滚不动」。

### 对上一版解释的更正(重要)

上一版依据源码成本模型推断:「5.22s ÷ 100 条 ≈ 52ms/条,主因是侧边栏 `countCategoryByState` 对最多 4000 条状态的全量扫描」。
**函数级实测不支持这个主导性判断** —— `countCategoryByState` 在该窗口只有 **58.2ms**(其调用者 120.8ms)。
真正的大头是 **DOM 重建(原生 `insertAdjacentHTML` 2.44s)+ 自递归 `lt` 1.38s + GC 2.40s**,外加被 DOM 抖动放大的 **Bitwarden 3.0s**。
侧边栏全量扫描确实存在(源码、采样两边都证明了),但**它不是这次 5.5s 的主因**。

### 仍无法确定

- 站点 chunk 是压扁单行文件(采样里 `lineNumber:0`),无法把 `lt`/`il`/`Gp` 这类压缩名映射回源码函数名。
- 消息条数仍未知(位置差不能还原条数);要拿条数需在那次 `XHRLoad` 内数 `processMessages` 的分发次数。

## 8. 未解 / 待证

- `chunk-hue237mp.digested.js` 是**部署哈希命名**,已随部署失效(无法回读源码);其 5.22s 自耗时只能定性为"站点消息处理链"。
- 该扩展被调用 **64,436 次/61s(≈1000 次/秒)**,强烈提示它由 MutationObserver 驱动、按 DOM 变更重跑。**它是否被"站点消息处理引发的 DOM 变更"与"我方面板的 DOM 变更"分别触发、各占多少,本 trace 无法区分** —— 若要查,可在我方脚本 DOM 写入处加计数,或禁用我方脚本后对比该扩展的调用次数。
- 该轮询具体带回多少条消息:位置差无法还原条数(见比对报告 §0 结论 1),需在回调处计数或独立探针。
