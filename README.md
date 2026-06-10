# Discourse Sidebar Feed Panel

把 Discourse 原生侧边栏改造成信息流面板的用户脚本。第一期内置支持 [LINUX DO](https://linux.do/) 和 [NodeLoc](https://www.nodeloc.com/)，其他 Discourse 论坛可由用户在脚本管理器中手动添加匹配规则。

## 功能

- 在侧边栏中显示话题信息流
- 支持从站点导航分类生成分类标签；站点没有提供导航分类时仅显示“全部”
- 支持已读、未读、全部过滤
- 支持隐藏置顶话题
- 支持拖拽调整侧边栏宽度
- 支持新活动提醒
- 支持自动刷新和静默刷新
- 支持保存宽度、排序、标签页、筛选等偏好设置

## 安装

先安装任一用户脚本管理器：

- [Tampermonkey](https://www.tampermonkey.net/)
- [Violentmonkey](https://violentmonkey.github.io/)
- [ScriptCat / 脚本猫](https://scriptcat.org/)

然后打开下面的直装链接：

[从 github 安装](https://raw.githubusercontent.com/YsLtr/discourse-sidebar-feed-panel/main/discourse-sidebar-feed-panel.user.js)
[从 Greasy Fork 安装](https://update.greasyfork.org/scripts/579280/Discourse%20Sidebar%20Feed%20Panel.user.js)
[从 脚本猫 安装](https://scriptcat.org/scripts/code/6360/Discourse%20Sidebar%20Feed%20Panel.user.js)

脚本管理器会自动弹出安装页面，确认安装即可。

## 使用

安装后访问内置支持的网站，脚本会在页面加载完成后自动运行：

- `https://linux.do/*`
- `https://www.nodeloc.com/*`

要在其他 Discourse 论坛上使用，请在 Tampermonkey、Violentmonkey 或脚本猫的脚本设置中手动添加该论坛的 match/include，例如：

```text
https://example.com/*
```

第一期不会全网宽匹配，也不会自动检测任意网站是否为 Discourse。手动添加到非 Discourse 网站或不兼容论坛时，出错由用户自行处理。

侧边栏中的信息流面板提供：

- 排序切换
- 分类标签
- 已读/未读过滤
- 刷新设置
- 面板宽度调整

设置会按网站 origin 保存在浏览器的用户脚本存储中，刷新页面或重新打开网站后会自动恢复。旧版 LinuxDO 全局设置会在升级后迁移到 LinuxDO 站点设置，并删除旧 key。

## 限制

- 只替换 Discourse 原生侧边栏；没有可用原生侧边栏的站点不会挂载独立信息流面板。
- 分类标签依赖站点数据中的导航分类，不会默认展示所有顶级分类。
- 脚本不提供站内启用/禁用菜单；是否运行由脚本管理器的 match/include 控制。

## 权限说明

脚本使用以下权限：

- `GM_addStyle`：注入面板样式
- `GM_setValue`：保存用户设置
- `GM_getValue`：读取用户设置
- `GM_deleteValue`：迁移旧版 LinuxDO 全局设置后删除旧 key
- `unsafeWindow`：访问 Discourse 页面运行环境中的必要对象

脚本匹配范围为：

```text
https://linux.do/*
https://www.nodeloc.com/*
```

## 更新

如果通过 GitHub Raw 链接安装，脚本管理器通常会自动检查更新。也可以在脚本管理器中手动检查更新。

## 许可证

MIT

## 致谢

[linux-do-timeline](https://linux.do/t/topic/1548156)
[发个脚本的优化](https://linux.do/t/topic/1548771)
[LINUX DO](https://linux.do/)
