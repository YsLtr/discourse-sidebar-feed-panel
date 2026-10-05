# message-bus 源码比对报告（子代理交叉核对 + 人工复核）

**日期**: 2026-10-04
**目的**: 用 Discourse 源码判定「休眠唤醒后 5.8~11.9 秒主线程冻结」的成因归属,以及第三方 userscript（本项目的 `discourse-sidebar-feed-panel.user.js`）在此机制中的角色。
**仓库**: `C:\Users\28676\builds\discourse\discourse` @ `2026.10.0-latest`（只读,未修改）
**依赖版本**: gem `message_bus 5.0.0`（`Gemfile.lock:350`）、前端 `message-bus-client 4.6.0`（`pnpm-lock.yaml:5975`）
**取证方式**: 三路子代理分工（JS 客户端 API / 站点订阅与回调成本 / userscript 假设比对）;仓库内无 `node_modules` 与 gem 源码,依赖源码取自 upstream 对应版本;关键结论已由人工逐行复核（下文标「人工复核」者为本人亲读源码确认）。

---

## 0. 结论摘要（含对前序判断的推翻）

| # | 结论 | 证据 |
|---|---|---|
| 1 | **「位置推进」不等于「消息条数」** —— 它等于「客户端落后频道头部多远」。此前把 1608 读成「交付 1608 条」是误读,由此产生的「47 分钟推进 41 条 vs 5.5 秒推进 1608 条」的 2000 倍矛盾**不存在**。 | `dist:108-140`（每条消息把 `callback.last_id` 推到该消息 id,故一跳=整段落后量）**人工复核**;`client.rb` backlog 返回「保留窗口内、id 大于起点」的全部消息 |
| 2 | **保留窗口有上限**: Discourse 把 `max_backlog_size` 覆盖为 **100**（gem 默认 1000）,`clear_every = 50`。故一次积压回放**最多约百条**,不可能回放上千条。 | `config/discourse_defaults.conf:218`、`config/initializers/004-message_bus.rb:146-147` |
| 3 | **冻结仍可由回放解释,但代价来自「单条成本」而非「条数」**: `unread/read/delete` 类每条同步触发 `_afterStateChange`,其消费者对最多 4000 条 states × 每个侧边栏 link **全量扫描**;百条即数十万次 × links,与数秒量级相符。 | `models/topic-tracking-state.js:935,982,1080`、`lib/sidebar/user/categories-section/category-section-link.js:567`、`:69`（`_trackedTopicLimit = 4000`） |
| 4 | **分发确实是 XHR 回调栈内的同步双循环**,chunked 路径整体在 `onprogress` 内 —— 与「冻结被归因到核心包 `XMLHttpRequest.onprogress`」一致。 | `dist:107-140`（消息×回调）**人工复核**、`dist:190-216`（`handle_progress`→`reqSuccess`→`processMessages`）、`dist:242-266`（安装 xhr 钩子） |
| 5 | **userscript 永远拿不到积压**:它对 5 个频道都以 `lastId = -1` 订阅,而 `-1` 在服务端是 `next`（完全不发积压）。故它**不可能**被积压洪水冲击。 | gem `Client#backlog`:`elsif last_client_id == -1 then next`（人工复核 upstream v5.0.0 源码文本）;`dist:508-512`（未传 lastId 默认 -1）;userscript:5445-5446、5522-5524 |
| 6 | **但 userscript 的同步工作确实嵌在站点 XHR 回调栈内**:两个回调都对每条消息做强制布局读取（`scrollTop`）与 DOM 写入;生命周期消息还会整表 `renderTopics()` 重建。 | userscript:5590-5596 → 5275-5277/4982、5251-5253/5040-5078;生命周期:5547/5560 → 6725-6729 |
| 7 | **userscript 存在一处真实干扰（新发现）**:它对 `/latest`、`/new`、`/delete`、`/recover`、`/destroy` 重复订阅且传 `-1`,而请求体里**每频道取最后一个回调的 `last_id`** → 站点的真实位置被覆盖成 `-1` → 服务端对这些频道**不发积压**,反而下发 `__status` 把站点位置直接归位到头部 → **站点静默丢掉这些频道的积压回放**。 | 请求构造:`dist:449-452`（`data[channel] = callbacks[i].last_id`,后写覆盖前写）**人工复核**;状态分支:gem `Client#backlog` 尾部 `if v.to_i == -1 \|\| new_message_ids[k] → status_message[k] = last_bus_ids[k]`（人工复核） |
| 8 | **`_getMessageBusLastId` 是死代码**:它依次读 `lastId / lastIdForChannel / lastIds / last_ids / channels`,4.6.0 中**五个全不存在**,恒返回 `-1`（静默,不抛错）。可用的等价读面只有 `MessageBus.callbacks[].last_id`（本脚本在 627-635 已在用,但没用在订阅路径）。 | userscript:5463-5479;`dist:366-372`（仅暴露 `callbacks`）、`:513-517`（元素形状 `{channel, func, last_id}`）;仓库内先例 `frontend/discourse/tests/helpers/qunit-helpers.js:599` |
| 9 | **唤醒后无任何「跳过积压」逻辑**:`onVisibilityChange` 只清 timeout 并**用原 last_id 立刻发 poll**;隐藏 >20 分钟时 `shouldLongPollCallback` 转假,掉到 background 轮询,期间位置继续陈旧。 | `dist:479-497`、`dist:86-93`（`minHiddenPollInterval: 1500`）、`instance-initializers/message-bus.js:82-93`、`site_settings.yml:3565-3579` |
| 10 | **站点与 userscript 在 `/latest` 等频道是重复订阅、同一起点**:站点自己也订阅 `/latest` `/new` `/unread` `/delete` `/recover` `/destroy`,起点均为 preload 的 `topicTrackingStateMeta`（值来自服务端 `MessageBus.last_ids`,即频道全局头 id）。 | `models/topic-tracking-state.js:122,129,135,141,148,154,160`;`serializers/topic_tracking_state_serializer.rb:17`;`lib/application_layout_preloader.rb:95`;userscript:5483-5486 |

### 被推翻 / 需撤回的旧判断

- ❌「1608 = 交付了 1608 条消息」→ 撤回（见 #1、#2）。
- ❌「保留上限 ~37 或 1000」→ Discourse 用 **100**;实际生效值见「遗留问题」。
- ❌「`group_ids` 过滤导致 `/latest` 归位」→ 在**公开分类**上不成立:`secure_category_group_ids` 对公开分类返回 `nil`（`topic_tracking_state.rb:645-657`),`/latest` 是无定向广播;但**受限分类主题**仍会带 `group_ids`,故该机制**存在**、只是不适用于公开站常态。
- ✅ 保留的是:「冻结不是 userscript 的同步工作造成的」——因为 (a) userscript 拿不到积压（#5),(b) 它的同步工作在长帧里的占比可由自身计时独立量出（LoAF 对本脚本不可见,不能作为免责依据)。

---

## 1. 服务端机制（gem `message_bus 5.0.0` `Client#backlog`,人工复核原文）

```ruby
if last_client_id < -1            # lookbehind:相对总线头的回溯
  last_client_id = last_bus_id + last_client_id + 1
  last_client_id = 0 if last_client_id < 0
elsif last_client_id == -1        # 不请求积压
  next
elsif last_client_id == last_bus_id   # 已最新
  next
elsif last_client_id > last_bus_id    # 客户端超前于总线:重置为 -1
  @subscriptions[k] = -1
  next
end
messages = @bus.backlog(k, last_client_id, site_id)   # zrangebyscore(last_id+1, "+inf")
messages.each do |msg|
  if allowed?(msg) then r << msg
  else new_message_ids ||= {}; new_message_ids[k] = msg.message_id   # 记录「被过滤」
  end
end
# ...
status_message = nil
@subscriptions.each do |k, v|
  if v.to_i == -1 || (new_message_ids && new_message_ids[k])   # ← 归位条件
    status_message ||= {}
    @subscriptions[k] = status_message[k] = last_bus_ids[k]    # ← 跳到频道头部
  end
end
r << MessageBus::Message.new(-1, -1, '/__status', status_message) if status_message
```

要点:
- 频道位置被**归位到头部**只有两种触发:①订阅值 `-1`;②该频道存在「客户端无权看见」的消息。**不是**「因为落后就归位」。
- 落后时正常路径是回放「保留窗口内、id 大于起点」的消息,客户端收到后按条推进（#1）。
- `-1` 的官方语义（`dist:496-500` 注释）:`0+` 只收该 id 之后;负数=lookbehind;`-1` 订阅所有新消息;`-2` 最近 1 条 + 之后;`-3` 最近 2 条 + 之后。

---

## 2. 客户端机制（`message-bus-client 4.6.0`）

- 公开读面只有 `callbacks`（`dist:366-372`),元素 `{channel, func, last_id}`;无任何 `lastId*`/`lastIds`/`channels` API。
- `processMessages`（`dist:107-140`,人工复核):外层消息、内层**全部回调**;命中频道即 `callback.last_id = message.message_id` 并**调用 `func`——不看该回调自己的 last_id**。故站点订阅拉回的积压消息,会**逐个触发同频道的所有回调,包括 userscript 的回调**。
- `__status` 在同一双循环里处理（`dist:131-137`,人工复核):`callback.last_id = message.data[callback.channel]`,**不调用 `func`**（静默跳过,无任何交付）。
- 请求体每频道位置取**最后一个回调**的值（`dist:449-452`,人工复核）→ 后注册的订阅可覆盖先注册的真实位置。
- 唤醒:`onVisibilityChange`→ 立刻用原位置 poll（`dist:479-497`);无重置/清空逻辑。

---

## 3. 站点侧成本（为什么百条也能卡数秒）

| 环节 | 位置 | 说明 |
|---|---|---|
| 逐条入口 | `models/topic-tracking-state.js:935` `_processChannelPayload` | 每条一次,**无批处理/无节流/debounce** |
| `latest` 型 | `:982` → `:1052` `_addIncoming` | 只影响 `incomingCount`（`includes()` 线性查重),**不写 `states`** |
| `new/unread/read` 型 | `:768 modifyState` → `:788 _setState`（`JSON.stringify` 比较）→ `:1080 _afterStateChange` | **同步串行调用所有注册回调** |
| 侧边栏消费者 | `components/sidebar/user/categories-section.gjs:32,106-108` → `category-section-link.js:12,26,34` → `:567 countCategoryByState` | 对 `Array.from(states.values())` **全量扫描**;states 上限 `_trackedTopicLimit = 4000`（`:69`） |
| 话题列表消费者 | `components/discovery-topics-list.js:13` | 遍历当前页 ~30-50 项 `setProperties` |
| 量级 | — | 单条 `unread/read`-族 ≈ O(4000 × links);百条串行即与数秒相符 |

发布侧（`app/models/topic_tracking_state.rb`):`publish_latest:78`（`group_ids: secure_category_group_ids`)、`publish_new:60`、`publish_unread:168`（**`user_ids:` 定向**)、`publish_read:230`（`/unread/<uid>`)、`publish_delete:217`、`publish_recover:178`、`publish_destroy:227`。

---

## 4. userscript 假设逐条比对

| # | userscript 的写法 | 仓库/依赖实际 | 判定 |
|---|---|---|---|
| 1 | `_getMessageBusLastId` 读 5 个属性（:5463-5479） | 4.6.0 无任何一个;可用读面仅 `callbacks[].last_id`（:627-635 本已在用)、或 preload `topicTrackingStateMeta` | **失效**（恒 -1,静默） |
| 2 | 用 `-1` 订阅 5 个频道（:5445-5446、5522-5524） | `-1` = 不请求积压;且因「最后回调覆盖」会**改写站点同频道位置** | **有副作用**（见 #7) |
| 3 | 生命周期频道读 `topic_id` / `message_type`（:5539-5558） | `{topic_id, message_type: "delete"\|"recover"\|"destroy"}` | **一致,够用** |
| 4 | 只处理 `latest` / `new_topic`（:5569） | 站点另有 `unread` / `read` 型（`topic_tracking_state.rb:130-166`) | 覆盖边界,非错误 |
| 5 | 注释称「举报隐藏不广播」「unlist/relist 复用这两频道」(5498-5503) | 门控对象是 flag 可见性（`topic_status_updater.rb:63-73`)与分类受限变更（`topic_tracking_state.rb:183-203`),开关 `experimental_topic_category_change_notification` | **注释与源码不符**（行为不受影响,应改注释） |
| 6 | `getDiscourse().__container__.lookup("service:message-bus")`（:1714-1720） | 成立（application instance 有 `__container__`,`service:message-bus` 即 `window.MessageBus`) | **一致** |
| 7 | 回调内同步读 `scrollTop` + 写 DOM / 整表 `renderTopics`（:5590-5596、5547-5560） | 确在站点 XHR 同步栈内执行（`dist:107-140`） | **应搬出该栈**（microtask/rAF 批处理） |

---

## 5. 对 instrumentation 的修正（本项目 `discourse-sidebar-feed-panel.user.js`）

1. 「message-bus 位置推进」这个命名与解读**是错的**:它量的是「落后量」。已改为在冻结报告中同时给出「覆盖冻结的窗口」,并注明 `bus` 只是「距上次探针」的窗口（2.2.12）。
2. `initJumps`（`__status` 归位计数）语义现已明确:归位 = `-1` 订阅 **或** 该频道存在被过滤消息。它是「站点可能静默丢消息」的指示器,而**不是**「积压条数」。
3. **位置差无法还原「交付条数」**。要得到条数,只有两条路:①对 `MessageBus.callbacks` 里各回调的 `func` 做包装计数（侵入式,仅 debug 开);②用独立探针（`docs/probes/*.probe.js`)以自建 client 复现同一保留窗口。
4. 长帧自测窗口（冻结结束后才跑）**不能代表冻结期间**:实测出现过 `{windowMs: 44, total: 3}` 而本帧 5281ms。已单独输出 `busCoveringFreeze`。

---

## 6. 遗留问题（未查证,不要当成已知）

1. **linux.do 实际生效的 `message_bus_max_backlog_size`**（站点设置可覆盖默认 100)。探针 v1 在 lookbehind -2000 下只回 **37** 条 → 需用 `docs/probes/message-bus-retention-v2.probe.js` 的 `span`/`holes` 判别:连续=保留窗口就那么大;稀疏=保留很多但被过滤。
2. **线上实际打包版本**:仓库无 `node_modules`,4.6.0 取自 registry;线上 bundle 未核验。
3. `__status` 在受限频道下的下发频率、以及「后注册覆盖位置」造成的站点丢消息窗口长度,未量化。
4. chat 插件（~20 处订阅/发布）逐条成本未量化。
5. `plugins/discourse-ai` 对个别频道设 `max_backlog_size: 2`（`playground.rb:964`),与主站无关,仅记录。
