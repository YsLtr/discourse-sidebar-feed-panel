# Discourse Sidebar Feed Panel - Active Handoff

The userscript replaces a selected area of a Discourse forum with a compact, locally-filtered topic feed panel, hosted from the userscript metadata of a single built file. `CONTEXT.md` holds the domain terms; `docs/INDEX.md` indexes the durable contracts under `docs/`; this file records only the current session.

**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `main` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: 按 deep-plan 文档规范重整 `docs/` 目录，去掉多余的 ADR 与其他内容；随后按审查裁定修正重整引入的缺陷。

## 本轮完成的工作

- **文档重整**（`eb4884c`）：把原 `docs/` 的 `adr/`（3 份）、11 份散落在根层的文档与 `probes/` 重整为 `docs/INDEX.md` + 三个部分（`discourse/` 4 个主题、`feed/` 1 个主题、`development/` 3 个主题），每部分带 `README.md` 作为范围与索引。带日期的取证型分析（`freeze-trace`、`init-trace`、`scroll-responsiveness`、`wake-trace`、`migration-completeness-audit`、`vite-plugin-monkey-refactor-plan`）按其结论分流并入对应主题后删除，ADR 内容并入主题正文，`adr/` 与 `probes/` 一并移除。现为 12 份文档、共约 1 226 行。
- **README 链接修复**（`f2f3690`）：`README.md` / `README.en.md` 中 4 处指向重构前路径的链接改为 `docs/development/01-开发与校验.md#release-distribution` 与 `docs/INDEX.md`。
- **仓库清理**（`335d3a6`）：删除 `CLAUDE.md` 与 `todo.md`，`.gitignore` 增加对应规则。
- **九轮审查与修复**（`7cd553f`、`7049109`、`c9534a3`、`502195a`、`d407426`、`03a01c8`、`ab734ff`、`f218a04`、`762ceef`）：每轮由静态检查、离线测试、对抗审查三个变体给出结论，用户裁定后修复。累计修复的内容类别为：跨子目录链接层级（`../../` → `../`，6 处）、与 `src/feed/controller.ts` 不符的订阅描述、计数与编号不一致（`三次`/`四次`、`五个`/`四者`、`四条`/`五条`）、重复词、`git log -S` 可反证的过强断言（「在本仓库内无记录」→「在仓库内没有文件记载」）、句内相抵、`tools/analyze-trace.cjs` 与 `perf/` 产物的归属配对、GC 与 Bitwarden 计数的统计口径（64 430 / 64 436 / 64 440 三个范围）。
- **`.gitignore` 修正**（并入 `7cd553f`）：`todo` 改为锚定的 `/todo`（原写法会连 `src/todo/` 一起忽略），并补结尾换行。
- **交接文件复位**（`59aeacb`、`3ae3a82` 及其后的提交）：根 `AGENTS.md` 的文档指针改为新路径，删除已不存在的 `docs/adr/`、`host-locators.test.ts`、`todo.md` 引用。
- **本轮文档复位核对**：`deep_plan_linerefs({path: "docs/"})` 位移 0 处；41 处指向仓库外文件的引用（Discourse 源码克隆、`perf/`、压缩 chunk）无法推定，逐条记录。逐项核对 file:line 内容、被引符号、取值类论断、能力范围与非目标、工具与命令清单、索引同步，**偏差清单为空**，故本次复位不产生 docs 修复提交。

## 当前仓库状况

- HEAD 为本交接提交之前的 `762ceef`（收窄 cpu 产物归属的断言并消除句内相抵）；工作区只剩本文件。
- **未 push**：`package.json` 的版本已是 3.2.0，只存在于本地。push `main` 会触发 release workflow 创建 `v3.2.0` 并发布资产（已发布资产不可覆盖），本次会话未授权。
- `.pi/` 已被 `.gitignore` 忽略，内含本轮 deep-plan scratch：浏览器探测记录、插桩日志、变异体、各轮审查报告。
- 最后完整校验：typecheck 0、13 文件 / 71 单测、`check:dev`、`build`（194.49 kB / gzip 44.51 kB）、`check:artifact`、`check:scroll` 12 项、`check:browser` 44 项全绿。

## 未决问题

- **代码不符合文档规定**：本轮文档复位逐项核对后未发现此类项（核对范围为全部 file:line 引用内容、被引符号、取值类论断、能力范围与非目标、工具与命令清单、索引同步），无需记入。
- **是否发布 3.2.0 未定**：push `main` 即发布；`npm version` 已在本地完成。
- **未经实测，不得当作已验证**：真实站点安装 3.2.0 后的行为；用户脚本管理器隔离世界（`window` / `document` 可达性）；窄视口与移动端（写入 inline 变量会覆盖核心 `@media (width<64rem)` 的收窄，面板未适配抽屉式侧边栏）；真实站点上容器被替换（触发动画取代路径）的实际频率；meta.discourse.org 上按钮与宽度的真机观感。
- **审查接受的残余风险**（已记入 `docs/discourse/01-页面结构与侧边栏宽度.md` §七）：正确性依赖「`deactivateFeed` 先 dispose viewScope、再 `host.unmount()`」的顺序不变量；无宿主分支不清理动画定时器（仅约 260 ms 后一次幂等清理）；面板运行期间被第三方改写的变量仍会被覆盖且 dispose 时不还原；变量不自愈；`.home-logo-wrapper-outlet` 在 Chat 使用时会被占用（候选链与自愈是缓解手段）；同一宿主节点 detach→reattach 会把面板自己写的值当原值还原。
- **`perf/` 产物不可复算**（已记入 `docs/discourse/04-消息总线与主线程成本.md` §八）：原始 trace 与四个分析工具从未入库，`perf/_cpu.txt` 的产出工具在仓库内没有文件记载，故 64 430 / 64 436 / 64 440 无法在本地重算，§八 的命令无法验证可用性。
- **`docs/` 的链接与索引无自动化校验**（详见 `docs/development/01-开发与校验.md` 的校验覆盖说明）：`devDependencies` 不含 markdown lint 类工具，`check:artifact` 只校验 README 的 Release 链接。新增或改名主题文件后，须人工核对 `docs/INDEX.md` 与各级 `README.md` 的相对链接层级（子目录互链为 `../<部分>/<文件>.md`，不使用 `../../`）。
- **`CONTEXT.md` 未纳入本轮新术语**：`Sidebar Track`、`Header Anchor`、`Toggle Button`、`Upcoming-change class` 的定义目前只在 `docs/discourse/01-页面结构与侧边栏宽度.md` 的术语小节；`Native Sidebar Host` 与 `CONTEXT.md` 的 Feed Panel Host 关系已在该文件内交叉说明。

## 后续任务

用户本次会话未指定后续任务。

Updated: 2026-10-19 19:08 中国标准时间 +0800
