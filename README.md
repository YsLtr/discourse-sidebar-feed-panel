# Discourse Sidebar Feed Panel

把 Discourse 侧边栏改造成信息流面板的用户脚本，目前主要适配 [LINUX DO](https://linux.do/)。

## 功能

- 在侧边栏中显示话题信息流
- 支持按板块/分类筛选
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

[安装 Discourse Sidebar Feed Panel](https://raw.githubusercontent.com/YsLtr/discourse-sidebar-feed-panel/main/discourse-sidebar-feed-panel.user.js)

脚本管理器会自动弹出安装页面，确认安装即可。

## 使用

安装后访问 [linux.do](https://linux.do/)，脚本会在页面加载完成后自动运行。

侧边栏中的信息流面板提供：

- 排序切换
- 分类标签
- 已读/未读过滤
- 刷新设置
- 面板宽度调整

设置会保存在浏览器的用户脚本存储中，刷新页面或重新打开网站后会自动恢复。

## 权限说明

脚本使用以下权限：

- `GM_addStyle`：注入面板样式
- `GM_setValue`：保存用户设置
- `GM_getValue`：读取用户设置
- `unsafeWindow`：访问 Discourse 页面运行环境中的必要对象

脚本匹配范围为：

```text
https://linux.do/*
```

## 更新

如果通过 GitHub Raw 链接安装，脚本管理器通常会自动检查更新。也可以在脚本管理器中手动检查更新。

## 许可证

MIT

## 致谢

[linux-do-timeline](https://linux.do/t/topic/1548156)
[发个脚本的优化](https://linux.do/t/topic/1548771)
[LINUX DO](https://linux.do/)