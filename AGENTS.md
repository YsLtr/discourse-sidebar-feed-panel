# Discourse Sidebar Feed Panel - Active Handoff

The userscript replaces a selected area of a Discourse forum with a compact, locally-filtered topic feed panel, hosted from the userscript metadata of a single built file. `CONTEXT.md` holds the domain terms; `docs/INDEX.md` indexes the durable contracts under `docs/`; this file records only the current session.

**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `main` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: some Discourse forums changed their page UI after an update, which broke the width drag; `https://linux.do/` could not be resized and `https://meta.discourse.org/` did not even show the sidebar toggle. Re-do the compatibility with `agent-browser-cli`, find locators that work on both old and new versions, and never remove an old-version locator (e.g. `https://www.nodeloc.com/`).

## 本轮完成的工作

- **实测定位**(`agent-browser-cli` 只读探测 5 个站点,原始记录在 `.pi/tmp/dom-probe*.md`、`.pi/tmp/probe/`,已 gitignore):
  - 真因不是版本号:linux.do / meta / nodeloc 跑的都是 `2026.10.0-latest`,而 chrultrabook(`2025.12.0-latest`)与被判为「失效」的站点表现相反。区别在站点是否命中核心的 `uc-enable-main-outlet-grid-layout-change`(`<body>` 上),它声明 `--d-sidebar-width: 15em`,隔断了写在 `<html>` 上的值。
  - 侧边栏宽度由 `#main-outlet-wrapper` 的 grid 首列(`var(--d-sidebar-width)`)决定;宿主是 `flex-shrink:1` 的 flex item,给它写 `width !important` 只是上限。可逆实验:写 `<html>` 无效(轨道停 240px)、写 `body` 或 `#main-outlet-wrapper` 有效(450px)。
  - `#d-header` 在 5 个站点命中数全为 0(现在只有 `header.d-header`);`[data-sidebar]`、`.sidebar-panel`、`.sidebar-toggle` 等也全为 0;`.home-logo-wrapper-outlet` 与其 `.title` 5 站全命中。
  - meta.discourse.org 的 `sfp-` 痕迹为 0 的唯一原因是它不在内置 `@match` 里;手动加 match 后脚本正常,宽度问题在同一处复现(轨道 240px vs 宿主 inline 373px)——即「页内有没有 `sfp-` 痕迹」不能当定位失败的判据。
- **计划入档 / 实现**(`b20b704` docs + `cd800f1` code):`src/ui/host.ts` 把 `--d-sidebar-width` 同时写到 `documentElement`、`body`、`#main-outlet-wrapper`;宿主与页头插入点改为「首个命中即止」的候选链(旧候选不删);`controller.onMutation` 在按钮不在文档中时按候选链补回;内置 match 加入 `https://meta.discourse.org/*`;版本 3.1.0 → **3.2.0**。
- **两轮审查修复**(`11b6636`/`7fcc9c4`/`fe964fc` 代码,`04ec876`/`c5475a0`/`46f2ca1` 文档,`ef8e103` 注释):
  - F1 宿主消失时面板关闭但宽度变量残留(清理挂在动画路径上,无宿主直接 return)。
  - F2 还原而不是删除:写之前用 `captureInlineValues` 记下每个目标的原值与优先级,`restoreInlineValues` 放回;面板没写过就不碰(同一规则后来也用到宿主自身的 `width`,即 B1)。
  - F5 候选表删掉被另一条完全覆盖的条目;文档写明「只在覆盖者排在它前面时才可删」。
  - F6 容器被替换后重挂会丢宽度:旧实现只按 `widthAnimationTimer` 句柄取消动画,而句柄在帧回调内才赋值,同一轮两次动画时旧清理会在约 260ms 后清掉新宽度。改为自增 `widthAnimationEpoch`,帧回调发现自己过时即返回(插桩日志 `unmount → anim(cleanup=true) → ensure → anim(cleanup=false) → restore t=269` 已消除)。T1 后来把那行「还原时自增 epoch」删掉:rAF 探针证明 dispose 路径上帧被安排在已被 `viewScope.dispose()` 取消的作用域里(无 `ran`),那行无路可依。
  - 新增断言(浏览器检查 36 → **44**):宽度驱动 grid 轨道、页头替换后按钮补回、宿主消失时清变量且轨道回默认、容器重挂过动画窗口仍保持宽度、dispose 还原已有 inline 值(0.12s/0.42s 两次采样)、feed 未启用时不动宿主 inline 宽度;`tests/unit/host.test.ts`(13 例,由 `host-locators.test.ts` 改名而来)并补记忆规则。变异复核(dist 副本 + `--source`):M1/M3/M4 会失败,MR 全绿。
- **文档复位**(`3ae3a82` docs commit):`docs/discourse/01-页面结构与侧边栏宽度.md`(§一~§八)记录了术语、宽度链路、候选链、新旧对照、实现规则、验收、边界与复现;`docs/development/01-开发与校验.md` 增加 DOM compatibility 段并更新检查覆盖;`docs/discourse/03-跨站适配范围.md` 更新跨站范围条款;本轮的 `Native Sidebar Host` 术语补了与 `CONTEXT.md` 的交叉说明。
- **最终校验**:typecheck、13 files / **71** 单测、`check:dev`、`build`(193.35 kB / gzip 44.15 kB)、`check:artifact`、`check:scroll`(12)、`check:browser`(**44**)全绿;`.pi/tmp/t14-checks.log`、`f6b-checks.log` 等日志在 scratch。

## 当前仓库状况

- HEAD is `3ae3a82`(文档复位);本交接提交(`AGENTS.md`)叠在其上,工作区只剩本文件。
- **未 push**:3.2.0 只存在于本地,push `main` 会触发 release workflow 创建 `v3.2.0` 并发布资产(已发布资产不可覆盖),用户本会话未授权。
- `.pi/` 已被 `.gitignore` 忽略(提交 `9158cb6`),里面是本轮的 deep-plan scratch:探针脚本、插桩日志、变异体、审查报告。

## 未决问题

- **是否发布 3.2.0 未定**(同上一轮):push `main` 即发布;`npm version` 已在本地完成。
- **未经实测,不得当作已验证**:真实站点安装 3.2.0 后的行为;用户脚本管理器隔离世界(`window`/`document` 可达性);窄视口/移动端(写入 inline 变量会覆盖核心 `@media (width<64rem)` 的收窄,面板未适配抽屉式侧边栏);真实站点上「容器被替换」(触发 F6 路径)的实际频率;meta.discourse.org 上按钮与宽度的真机观感。
- **审查接受的残余风险**(已记入 `docs/discourse/01-页面结构与侧边栏宽度.md` §七):正确性依赖「`deactivateFeed` 先 dispose viewScope、再 `host.unmount()`」的顺序不变量;无宿主分支不清理动画定时器(仅 260ms 后一次幂等清理);面板运行期间被第三方改写的变量仍会被覆盖且 dispose 时不还原;变量不自愈;`.home-logo-wrapper-outlet` 在 Chat 使用时会被占用(候选链与自愈是缓解);同一宿主节点 detach→reattach 会把面板自己写的值当原值还原。
- **`CONTEXT.md` 未加入本轮新术语**:`Sidebar Track`、`Header Anchor`、`Toggle Button`、`Upcoming-change class` 的定义目前只在 `docs/discourse/01-页面结构与侧边栏宽度.md` 的 §术语;`Native Sidebar Host` 与 `CONTEXT.md` 的 Feed Panel Host 关系已在该文件里交叉说明。下次动 `CONTEXT.md` 时可考虑把这些术语合并进去。
- **docs/ 的链接与索引无自动化校验**:`devDependencies` 不含 markdown lint 类工具,`check:artifact` 只校验 README 的 Release 链接。新增或改名主题文件后,须人工核对 `docs/INDEX.md` 与各级 `README.md` 的相对链接层级(子目录互链为 `../<部分>/<文件>.md`,不是 `../../`)。

## 后续任务

用户本次会话未指定后续任务。

Updated: 2026-10-15 16:35 中国标准时间 +0800
