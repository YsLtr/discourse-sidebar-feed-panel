# Discourse 网页语言兼容

面板 (Feed Panel) 与 Discourse 语言行为之间的契约:话题标题跟随站点解析后的语言,持久缓存按语言分版本保留并在语言变化后就地刷新,面板 UI 文案保持 zh-CN/en。

**事实来源**: 本机 discourse 源码克隆 `67bc74d0d` (`2026.10.0-latest`,引用为克隆内路径) + `https://meta.discourse.org/` 在线实测(登录用户 `YsLtr`,语言 `zh_CN`;匿名路径另行实测)。

**工作项来源**: `todo.md` 的「网页语言兼容,如 https://meta.discourse.org/,可能需要请求特定的 api 名称」。调查结论是**端点与参数都无需改动**:差异出在字段选择——`title` 永远是原文,`fancy_title` 才是译文。

## 术语

**页面语言 / Page Locale**:
服务端为该请求解析出的语言,写进响应 `<html lang>`(`zh-CN`)与页面内 `window._discourse_locale_data.locale`(`zh_CN`)。面板文案与持久缓存归属都以它为准。
_Avoid_: 站点默认语言(那是 `/site/basic-info.json` 的 `locale`,与用户选择无关)

**原文语言 / Source Locale**:
话题、分类、标签记录自身的语言(`locale` 字段)。`title` 永远是原文语言的文本。

**译文 / Content Localization**:
服务端把内容按页面语言重写后的结果:`fancy_title`、`excerpt`、帖子 `cooked`、分类名/描述、标签名等。

**Topic Display Title**:
Topic Item 中渲染的标题文本,由 `fancy_title` / `unicode_title` / `title` 按 §五.1 的规则选出,再解码 HTML 实体并转义。

**`fancy_title`**:
服务端已本地化、且已 HTML 转义的标题文本。可含数字实体(`&#8217;`、`&#8220;`)与 `:shortcode:` 残留。
**`unicode_title`**:
仅当**原文**标题含 `:shortcode:` 时出现,是把 shortcode 换成 unicode 字符的**原文**标题,不随译文变化。
**`fancy_title_localized`**:
仅 `content_localization_enabled` 站点出现,标记 `fancy_title` 是否为译文。面板不读它:「无需译文」与「未提供译文」不可区分,当前规则也不需要区分。

## 目标

- 面板话题标题显示页面语言的内容,与原生列表一致(meta.discourse.org 这类站点上 `title` 是英文、`fancy_title` 是中文)。
- 持久缓存按页面语言分版本保留:切回用过的语言零请求,不再整块丢弃;语言变化后(含不伴随刷新的变化)面板自动取用对应版本并重新拉取。
- 不改变请求端点与参数、不新增设置项、不改变已读/筛选/分页语义。
- 面板 UI 文案与相对时间格式保持 2.2.3 迁移对照基线(zh-CN/en)。

## 非目标

- 不新增 UI 语种(仍 zh-CN/en;zh 变体走 zh-CN,其余回落 en),不做 RTL 布局镜像。
- 不在面板内提供语言切换器,不写 `locale` cookie,不调用 `PUT /u/{username}.json`。
- 不显示译文摘要或正文:面板只渲染标题、分类、标签与统计。
- 不把 `:shortcode:` 渲染成站点 emoji 图片。
- 不做预取、翻译请求或服务端/中间层改动。
- 不做跨标签页/跨会话的语言同步:站点自身的页面同样是陈旧的,面板不越权纠正(见 §七)。

## 一、服务端语言解析链

语言是「每请求解析一次」的全局状态,不是端点自带属性:所有控制器共用 `around_action :with_resolved_locale`(`app/controllers/application_controller.rb:438-459`),解析结果写入 `I18n.locale`。

```ruby
def with_resolved_locale(check_current_user: true)
  if check_current_user && (user = current_user rescue nil)
    locale = user.effective_locale
  else
    locale = Discourse.anonymous_locale(request)
    locale ||= SiteSetting.default_locale
    persist_locale_param_to_cookie
  end
  locale = SiteSettings::DefaultsProvider::DEFAULT_LOCALE if !I18n.locale_available?(locale)
  I18n.with_locale(locale) { yield }
end
```

| 请求者 | 来源优先级 | 代码位置 |
| --- | --- | --- |
| 已登录 | `users.locale`(需 `allow_user_locale` 且 `I18n.locale_available?`)否则 `SiteSetting.default_locale` | `app/models/user.rb:501-507` |
| 匿名 | `?tl=` → `locale` cookie → `Accept-Language` → `default_locale` | `lib/discourse.rb:1382-1401` |

- `Discourse::LOCALE_PARAM = "tl"`(`lib/discourse.rb:13`)。
- 四个开关决定哪个旋钮生效,`config/site_settings.yml:1947-2023`:`allow_user_locale`(client,默认 true)、`set_locale_from_param`、`set_locale_from_cookie`、`set_locale_from_accept_language_header`(三者默认 **false**,且都 `depends_on: allow_user_locale`)。
- `?tl=` 会被写回 cookie(需 `set_locale_from_param` + `set_locale_from_cookie`),`app/controllers/application_controller.rb:1163-1171`。
- 错误页用 `check_current_user: false` 解析,即按匿名规则(`:334`、`:353`、`:378`)。
- 匿名响应缓存按 locale 分键(`lib/middleware/anonymous_cache.rb:15-31` 的 `l: key_locale`、`:122-128`),并按 `automatically_translate` cookie 分键(`:200-206`)。
- **已登录用户无法用 `?tl=` 或 `locale` cookie 切语言**,只能 `PUT /u/{username}.json { locale }`(`frontend/discourse/app/components/language-switcher.gjs` 的 `changeLocale`),随后 `window.location.reload()`。

## 二、哪些字段/端点带译文

翻译判定集中在 `lib/content_localization.rb`:`show_translated_topic?` / `show_translated_post?` / `show_translated_category?` / `show_translated_tag?`,共同前提是 `content_localization_enabled`、对象有 `locale`、`!in_user_locale?`,且用户的 `automatically_translate` 为真、该语言不在 `understood_languages` 里。

| 端点/字段 | 是否译文 | 位置 |
| --- | --- | --- |
| `fancy_title`(主题列表/详情/通知/搜索结果) | ✅ | `app/serializers/concerns/localized_fancy_topic_title_mixin.rb:20-22` |
| `title` | ❌ 永远原文 | `app/serializers/basic_topic_serializer.rb:5-8`(无覆写) |
| `excerpt`(列表) | ✅ | `app/serializers/listable_topic_serializer.rb:113-121` |
| 帖子 `cooked` / `topic_title` / `topic_html_title` | ✅ | `app/serializers/basic_post_serializer.rb:30-40`、`post_serializer.rb:149-161` |
| 帖子 `raw` | ❌ | `app/serializers/post_serializer.rb:714` |
| 分类 `name` / `description_text` | ✅(两套机制:`/site.json` 走 serializer `site_category_serializer.rb:67`;`/categories.json` 走模型 `app/models/category_list.rb:193-195`) | 同上 |
| 标签名(`topic.tags` 内 `name`)、侧边栏 section/url/tag | ✅ | `app/serializers/concerns/topic_tags_mixin.rb:39-47` 等 |
| `/search.json` 摘要 | ✅ | `app/serializers/search_post_serializer.rb:22-23`、`lib/search/grouped_search_results.rb:79-90` |
| `/notifications.json` | ✅ 有 `fancy_title`;❌ `data.topic_title` 为原文 | `app/serializers/notification_serializer.rb:4` |
| message-bus `/notification-alert/...` 载荷 | ❌ 用原文 excerpt 拼装 | `app/services/post_alerter.rb:35-64` |
| `locale` / `fancy_title_localized` 字段 | 仅 `content_localization_enabled` 时出现,可判断「是否译文」「原文语言」 | `localized_fancy_topic_title_mixin.rb:11-28` |
| 列表页 HTML DOM | ✅ `format.html`/`format.md` 会把 `title` 就地替换为译文;**`format.json` 不做此替换** | `lib/topic_list_responder.rb:8-27,46-56` |

`fancy_title` 本身是**已 HTML 转义**的文本:`app/models/topic.rb:604-634` 走 `ERB::Util.html_escape` → `HtmlPrettify.render`(`lib/html_prettify.rb`,输出 `&#8216;`、`&#8212;`、`&#8230;` 一类数字实体)→ `Emoji.unicode_unescape`;超长标题回落到未 prettify 的转义文本。译文侧同源(`lib/content_localization.rb:63-67` 读 localization 记录的 `fancy_title`)。上游 discourse/discourse#41261 专门修过 `fancy_title` 被二次转义的问题,说明它在客户端被当作 HTML 处理。

译文回落规则(精确匹配 → 语言变体匹配 → `content_localization_use_default_locale_when_unsupported` 时用站点默认语言):`app/models/concerns/localizable.rb:20-39`。

爬虫/SEO 路径:启用 `content_localization_crawler_param` 时输出 `hreflang`(`app/views/common/_hreflang_tags.html.erb`),并给爬虫视图的站内链接追加 `?tl=`(`lib/middleware/crawler_hooks.rb`)。

## 三、检测当前用户语言

按可靠度排序,均为实测可用:

1. **页面内(推荐,零请求)** — 三者等价于服务端解析结果:
   - `document.documentElement.lang`(`zh-CN`,来自 `app/helpers/application_helper.rb:290-292` 的 `html_lang`)
   - `window._discourse_locale_data.locale`(`zh_CN`,来自 `lib/js_locale_helper.rb:213`,客户端 i18n 同一值)
   - `document.getElementById("data-discourse-setup").dataset.defaultLocale` = **实例默认语言**(`en`),用于区分「站点默认」与「用户语言」,不要当用户语言用
2. **登录用户自己的语言** — `GET /session/current.json` → `current_user.effective_locale`(仅 `content_localization_enabled` 时存在,`app/serializers/current_user_serializer.rb:85,420-425`);页面 preload 的 `currentUser` 同样含 `effective_locale`,**不含 `locale`**(后者是 `private_attributes`,只在 `GET /u/{username}.json` 由本人/管理员可见,`app/serializers/user_serializer.rb:38`)
3. **站点能力** — `GET /site/settings.json`(=`SiteSetting.client_settings_json`,`app/controllers/site_controller.rb:11-13`、`config/routes.rb:127-129`)给出 `default_locale`、`allow_user_locale`、三个 `set_locale_from_*`、`content_localization_*`、`available_content_localization_locales`(`app/models/site_setting.rb:146-166`)。客户端镜像见 `frontend/discourse/app/lib/content-localization.js` 的 `languageSwitcherEnabled`
4. **不要用** — `/site/basic-info.json` 的 `locale` 是实例默认语言(`app/controllers/site_controller.rb:36`),实测在用户语言为 `zh_CN` 时仍返回 `en`

## 四、实测证据

### 站点与接口

站点设置(meta.discourse.org): `content_localization_enabled=true`、`default_locale="en"`、支持 `ar|de|en|es|fr|it|ja|ko|pt_BR|ru|zh_CN`、switcher=`all`、三个 `set_locale_from_*` 全 true。

| 请求 | `title` | `fancy_title` | `fancy_title_localized` | 说明 |
| --- | --- | --- | --- | --- |
| `/latest.json` | 英文原文 | 中文 | true | `locale: "en"`(原文语言),`excerpt` 中文 |
| `/latest.json?tl=ja` | 英文原文 | **中文(未变)** | true | `?tl=` 对登录用户无效 |
| `/latest.json`(匿名,`credentials: omit`,无 `tl`) | — | **中文** | true | 来自浏览器 `Accept-Language: zh-CN` |
| `/latest.json?tl=ja`(匿名) | — | **日文** | true | 匿名时 `?tl=` 生效 |
| `/latest.json?tl=ja`(匿名,`curl` 无 cookie) | — | 日文 | true | 响应 `set-cookie: locale=ja; path=/; SameSite=Lax; Secure`;随后带该 cookie 且无 `tl` 的请求仍为日文 |
| 登录态 + `Cookie: locale=ja` | — | **中文(未变)** | true | 登录用户忽略 `locale` cookie |
| `/top.json?period=weekly` | 英文原文 | 中文 | true | 周期榜同样带译文 |
| `/latest.json?topic_ids=1,414351` | — | 中文 | true | 面板提醒用到的批量端点同样带译文 |
| `/t/1.json` | 英文原文 | 中文 | true | `locale:"en"`;`post_stream.posts[0].cooked` 中文、`is_localized:true`、`raw` 为空 |
| `/notifications.json` | — | 中文 | — | 但 `data.topic_title` 为**英文原文**(message-bus 走同一份数据) |
| `/site.json?tl=ja`(登录态) | — | — | — | 分类名仍中文 |
| `/site.json`(匿名,无 `tl`;`?tl=ja`) | — | — | — | 分类名中文;`?tl=ja` 时为 `ニュースとイベント` |
| `/site/basic-info.json` | `locale: "en"` | — | — | 与用户语言 `zh_CN` 无关 |
| `/site/settings.json` | — | — | — | 返回上表站点设置 |
| 响应头(`/latest.json`) | — | — | — | `vary: Accept-Encoding`、`cache-control: no-cache, private`(登录态) |
| 页面 `<html lang>` | — | `zh-CN` | — | 与 `_discourse_locale_data.locale = zh_CN` 一致 |
| `/latest.md?tl=zh_CN`(匿名爬虫视图) | — | 中文标题 | — | `format.md` 渲染 `# [Discourse 新手？从这里开始！]…`;emoji 标题渲染为字符 `🎙` |
| `/`(匿名爬虫视图,无 `tl`) | — | 英文标题 | — | `<html lang="en">`,并输出 `hreflang` 与 `?tl=` 备用链接 |
| `/latest.json`(匿名,英文 Accept-Language) | 中文原文 | **英文** | true | 反向验证:译文方向由请求语言决定,`fancy_title_localized` 只表示「这是译文」 |

`fancy_title` 与 `unicode_title` 的字段差异(live `/latest.json`):标题 `Resenha … :studio_microphone:` 的 `fancy_title` 保留 shortcode,`unicode_title` 为 `… 🎙`;`include_unicode_title?` 只在原文标题匹配 `/:[\w\-+]+:/` 时输出该字段(`app/serializers/listable_topic_serializer.rb:48-55`)。

### 面板现状(同一页面实测,3.0.1)

| 项目 | 实测结果 | 判定 |
| --- | --- | --- |
| 面板 UI 文案(`刷新`/`设置`/`切换侧边栏信息流`) | 中文 | ✅ 已兼容(读 `<html lang>`,`src/i18n.ts:getUiLocale`) |
| 面板分类标签(`新闻和活动`/`社区`/`通用`) | 中文 | ✅ 已兼容(`/site.json` 已本地化) |
| **面板话题标题** | **英文原文**(`New to Discourse? Start here!`) | ❌ 未兼容 |
| 同页原生列表标题 | 中文(`Discourse 新手？从这里开始！`) | 参照 |

原因:面板渲染 `topic.unicode_title?.trim() || topic.title`(`src/ui/topic-item.ts:256`),`FeedTopic` 类型里没有 `fancy_title`(`src/feed/types.ts`)。

## 五、实现规则

### 1. Topic Display Title

字段选择是一个纯函数(放在 `src/ui/html.ts`,与 `escapeHtml` 同处),顺序为:

1. `fancy_title` 非空白且不含 `:[\w\-+]+:` → 用它(译文优先,与原生列表一致);
2. 否则 `unicode_title` 非空白 → 用它(含 emoji 的原文标题;与 3.0.1 行为相同);
3. 否则 `fancy_title` 非空白 → 用它(含 shortcode 的译文原样显示);
4. 否则 `title`。

输出前必须 `decodeHtmlEntities` → `escapeHtml`,顺序不可颠倒:

- `fancy_title` 是 HTML 转义文本,按纯文本渲染才能把 `&#8220;` 显示成 `“`(否则面板会显示实体原文);
- 不允许把 `fancy_title` 直接写进 `innerHTML`。Discourse 会转义标题,但不把远端转义当成本地 XSS 防线。
- 实体解码用 detached `<textarea>` 的解析(完整覆盖数字与命名实体);`escapeHtml` 沿用现有实现。

标题行加 `dir="auto"`,与原生 `fancyTitle()` 输出的 `<span dir="auto">` 对齐,使 RTL 语言标题按自身方向渲染。分类徽章已有 `dir="auto"`;标签是 slug/ASCII 标识,不额外处理。

字段来源:只把 `fancy_title?: string` 加入 `src/feed/types.ts` 的 `Topic`(`unicode_title` 已存在;`fancy_title_localized` 按 §术语 不读、不入类型)。`TopicMessage.payload` 是 `Partial<Topic>`,无需单独改。

### 2. 请求

- **不添加 `?tl=` 参数**:对已登录用户无效(见 §四),只会造成「匿名正确、登录不对」的不一致。同一页面的 `fetch` 已带 cookie,服务端按请求解析语言,`fancy_title` 自然正确。
- 不新增任何语言相关的请求、探测或跨语言重取:页面语言就是请求语言。

### 3. 持久缓存的语言归属

两个随页面语言变化内容的持久缓存都按语言**分版本保留**,而不是整块丢弃:

- `sfp_category_data_cache_v1`(分类名/描述等站点数据)与 `sfp_tag_style_cache_v1`(`/tags` 页按页面语言渲染的标签名)。
- 缓存值从「单份数据 + 语言标记」改为「按规范化语言索引的版本表」:`{ version, locales: { "zh-cn": { savedAt, … } } }`。加载只取当前页面语言那一份:命中即零请求,该语言第一次使用才请求。
- token 来自 `src/platform/discourse.ts` 新增的 `getPageLocale()`:取 `<html lang>`(`xml:lang` 兜底),小写并把 `_` 换成 `-`(`zh-CN` 与 `zh_CN` 归一为 `zh-cn`)。该 getter 以依赖注入方式传给 `createSiteData` / `createTagStyles`,不在领域模块里直接读 `document`。
- 最多保留**当前语言 + 上一个语言**(写入时按 `savedAt` 剪枝):覆盖「来回切换」的实际用法,同时避免多语言站点把存储撑大(见 §七)。
- 升级前的旧缓存没有语言字段,其语言不可知 → 直接丢弃一次(该语言重新请求一次),不猜成当前语言(见 §七)。
- **不提升** `CATEGORY_DATA_CACHE_VERSION` / `TAG_STYLE_CACHE_VERSION`,**不新增** storage key:`tests/unit/migration-parity.test.ts` 冻结了 `constants.ts` 与 `storage-keys.ts` 的导出集合与取值(见 §五.6)。语言归属只能写进缓存值。
- 页面内内存缓存(话题列表、用户映射、已读状态、宽度与偏好)不写盘:已读状态、宽度、筛选/排序偏好与语言无关;话题列表等随 §五.4 的语言变化重置。

### 4. 语言变化的运行时侦测与刷新

Discourse 自己的语言切换器是硬刷新(`language-switcher.gjs#changeLocale` 末尾 `window.location.reload()`),这条路径上面板随页面重建、按新语言取缓存,无需额外处理。为覆盖**不伴随刷新**的语言变化(主题/插件或脚本改写页面语言),面板自带一个轻量侦测:

- `src/platform/discourse.ts` 提供页面语言观测:用 `MutationObserver` 监听 `document.documentElement` 的 `lang` / `xml:lang` 属性(lifetime 归属,随面板 dispose),回调里把 `getPageLocale()` 与观测建立时记录的语言比较,不同才处理并置位内存标记。
- 处理动作是**面板内就地重建**,不是整页 reload:重置站点数据与标签样式的内存状态、重建头部控件/分类栏/筛选栏(文案按新语言),再走一次既有的重新拉取路径。持久缓存**不删除**——按 §五.3 直接切到新语言那一份。
- 每次页面加载最多处理一次语言变化(内存标记):站点若把 `lang` 反复改写也不会形成刷新循环。
- 不轮询、不读 `locale` cookie、不请求语言信息;跨标签页改语言不处理(见 §七)。

### 5. 面板 UI 文案

- 现状保持:`getUiLocale()` 依次读 `<html lang>`、`xml:lang`、站点 `default_locale`、`navigator.language`;`zh*` → `zh-CN`,其余 → `en`。因此 zh-TW/zh-Hant 显示简体文案,ja/de/fr 等显示英文文案。
- 不在面板内维护语言开关,也不写 `locale` cookie。
- `I18N` 词表、`getUiLocale`、`t`、`formatRelativeTime` 被迁移对照测试冻结:本期不新增、不修改任何文案键。确实需要新文案时,必须同一次改动显式重建对照基线(`node tools/capture-migration-baseline.mjs`)并在提交信息里说明理由。

### 6. 迁移对照的硬约束

`tests/unit/migration-parity.test.ts` 把 2.2.3 的行为当作迁移契约冻结,语言兼容的改动不得绕过或悄悄放宽它:

- `src/constants.ts` 与 `src/storage-keys.ts` 的导出集合/取值必须逐字不变 → 语言归属只能写进缓存值,不能新增 key 或改版本号。
- `src/styles/feed.css` 的签名必须不变 → `dir="auto"` 用属性实现,不新增 CSS 规则。
- `src/i18n.ts` 的 `I18N` 对象与 `getUiLocale`/`t`/`formatRelativeTime` 必须逐字同基线 → 不新增文案、不改语言检测顺序。
- 33 个基线函数(见 `tools/capture-migration-baseline.mjs` 的名单)必须与旧实现等价 → 标题渲染不在其中,可以改。

### 7. 提醒与生命周期路径

message-bus 载荷里的 `data.topic_title` 是原文,但面板只把它当「可能有变化的话题 id」:标题仍来自 `/latest.json?topic_ids=`(带译文),`/delete`、`/recover` 等生命周期事件只用 id。因此提醒路径无需为语言做任何改动,也**不要**改成直接渲染载荷标题去「对齐」站内通知中心。

## 六、验收

命令(`docs/development.md#checks` 的完整清单):

```sh
npm run typecheck
npm test
npm run check:dev
npm run build
npm run check:artifact
npm run check:browser
npm run check:scroll
```

语言兼容新增的断言:

- 单元:Topic Display Title 的表驱动用例(`fancy_title` 优先、含 shortcode 时回落 `unicode_title`、只有 `unicode_title`、只有 `title`、空白与缺失字段);分类数据与标签样式缓存的版本表用例——同语言命中(零请求)、已有另一语言版本时该语言命中、目标语言缺席时未命中、写入第三个语言后按 `savedAt` 剪枝到两个、旧格式(无 `locales` 字段)整体丢弃;页面语言观测的用例——语言未变(含 `zh-CN`/`zh_CN` 归一)不回报、属性反复改写只回报一次、dispose 后不再回报,且 `attributeFilter` 恰为 `["lang","xml:lang"]`。
- 浏览器(`tools/check-built-userscript.py` + `tests/browser/site-fixture.html`):夹具话题带 `fancy_title: "Translated &#8220;Alpha&#8221;"` 时标题行文本为 `Translated “Alpha”`、且带 `dir="auto"`;缓存夹具按 `locales` 写入 `zh-cn`(与夹具 `<html lang="zh-CN">` 一致)并覆盖「当前语言无版本则不采用缓存」(该情形下不发 `/tags` 请求);改写 `document.documentElement.lang` 后断言就地重建——重新拉取当前查询、面板文案切到新语言(`全部` → `All`;夹具话题标题与语言无关,故以面板文案而非标题文本作判据)、且改写前的 `locales['zh-cn']` 版本仍留在持久缓存里未被删除。
- 迁移对照测试必须继续通过,且不对基线做任何修改。

人工核对(可选,需已登录 agent-browser profile):在 meta.discourse.org 上确认面板标题与同页原生列表一致、切换站点语言后分类标签不残留旧语言。

## 七、已知边界

- 含 emoji `:shortcode:` 的**译文**标题显示原文的 `unicode_title`(规则 2):服务端的 `fancy_title` 不转 shortcode,而 `unicode_title` 不随译文变化。完全对齐原生需要站点 emoji 资源,超出本期。
- 判定 shortcode 的 `:[\w\-+]+:` 与服务端决定是否下发 `unicode_title` 的正则相同,因此**只要标题含该形状的冒号片段就会回落原文**,包括 `12:30:45`、`a:b:c` 这类非 emoji 标题:这些标题在面板里显示原文,而同页原生列表显示译文。
- 实体解码(`decodeHtmlEntities`)对三个字段一视同仁,但只有 `fancy_title` 是服务端已转义文本;`title` / `unicode_title` 是未转义原文,若标题**字面**含 `&lt;`、`&amp;` 这类文本,面板会把它还原成 `<`、`&` 显示(概率极低,不针对该情形做字段区分)。
- `fancy_title` 缺失(旧版 Discourse 或非标准实现)→ 回落 `unicode_title`/`title`,与 3.0.1 相同。
- `content_localization_enabled=false` 的站点只涉及 UI 文案语言:此时 `fancy_title` 是转义后的原文,解码后与 `title` 同文本(标点会做 typographic 处理)。
- 升级前写入的持久缓存没有语言字段,语言不可知,因此**整体丢弃一次**:该语言会重新请求一次分类数据与标签样式。这是唯一不保留旧数据的位置。
- 最多保留两个语言版本:切到第三个语言时最早的语言版本被剪枝,再切回去需要重新请求一次。
- 跨标签页/跨会话的语言变化不处理:另一个标签页改了语言时,本页 HTML 与原生列表同样陈旧,面板保持一致而不是抢先切语言;需要手动恢复时用 `SFPFeedPanel.clearCaches()`。
- 侦测只看 `document.documentElement` 的 `lang` / `xml:lang`:站点若只改 `window._discourse_locale_data.locale` 而不动 `<html lang>`,则不触发刷新。
- `/u/{username}.json` 的 `locale` 字段未实测(源码为 `private_attributes`,本人可见)。
- message-bus 实时通知载荷未在页面内实测(无法从页面构造),结论来自 `app/services/post_alerter.rb` 源码。
- 仅在 meta.discourse.org 与官方源码上验证;其它 Discourse 分支/主题的字段差异不受本文件约束。
- 真实用户脚本管理器的升级行为、论坛休眠/唤醒行为与本次改动无关。

## 八、复现方式

浏览器侧(需 agent-browser-cli 与已登录 profile;页面内 `fetch` 自动带 cookie):

```js
// 1) 页面/用户语言
({ htmlLang: document.documentElement.lang,
   i18n: window._discourse_locale_data.locale,
   siteDefault: document.getElementById("data-discourse-setup")?.dataset?.defaultLocale });
// 2) 字段差异(?tl= 对登录用户无效)
JSON.parse(document.getElementById("data-preloaded").textContent); // siteSettings / currentUser.effective_locale
fetch("/latest.json?tl=ja", {credentials:"same-origin"}).then(r=>r.json())
  .then(b=>{const t=b.topic_list.topics[0]; return {title:t.title, fancy_title:t.fancy_title, localized:t.fancy_title_localized}});
// 3) 匿名路径
fetch("/latest.json?tl=ja", {credentials:"omit"}).then(r=>r.json()).then(b=>b.topic_list.topics[0].fancy_title);
```

`preload` 数据位于 `<script type="application/json" id="data-preloaded">` 的**文本内容**(不是 `data-*` 属性),`document.getElementById("data-discourse-setup")` 是 `<meta>` 并带 `data-default-locale`。

HTTP 侧(无需登录,`curl` 全局限速余量不足时不必重复):

```bash
curl -sD - -c jar "https://meta.discourse.org/latest.json?tl=ja" | grep -i set-cookie
curl -s -b jar "https://meta.discourse.org/latest.json" | head -c 200
curl -s "https://meta.discourse.org/latest.md?tl=zh_CN" | head -20   # format.md 已替换标题为译文
```

一次性探针脚本存放在被忽略的 `perf/lang-probe/`(不随仓库提交)。
