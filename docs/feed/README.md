# 信息流行为

本部分收录面板自身的实现级契约:滚动与输入路径、动画中断、面板可继续工作的输入前提。领域概念(Feed Panel、Resident Topic Window、Head-Screen Reading State、Incoming Candidate 等)以仓库根 `CONTEXT.md` 为准;本部分只承载实现侧必须遵守的规则与对应证据,不重复领域定义。

与 Discourse 页面结构、站点数据、语言及消息总线相关的契约属于[Discourse 适配](../discourse/README.md)。

## 下辖文件

- [01-滚动与输入路径](01-滚动与输入路径.md):原生滚动与 CSS 承担的边界职责、禁止在话题滚动区安装可取消的输入处理、隔离夹具的验收项与未解限制。
- [02-稍后再读](02-稍后再读.md):侧边栏底部的持久化阅读列表:拖入本站链接、话题快照与编辑器链接预览、LocalStorage、跨标签页同步、随主列表刷新校正、可拖拽分隔与两侧最小可见条目。
