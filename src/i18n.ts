import type { DiscourseInstance } from "./platform/types";
const I18N: Record<string, Record<string, string>> = {
  "zh-CN": {
    all: "全部",
    orderActivity: "最新活动",
    orderCreated: "最新发布",
    orderViews: "最多浏览",
    orderPosts: "最多回复",
    orderLikes: "最多点赞",
    orderOpLikes: "楼主点赞",
    periodAll: "全部",
    periodDaily: "每日",
    periodWeekly: "每周",
    periodMonthly: "每月",
    periodQuarterly: "每季",
    periodYearly: "每年",
    filterAll: "全部",
    filterUnseen: "未读",
    filterRead: "已读",
    hidePinned: "隐藏置顶",
    toggleTitle: "切换侧边栏信息流",
    refresh: "刷新",
    settings: "设置",
    incomingHintLabel: "新活动数量",
    incomingHintTip:
      "在刷新按钮中显示当前板块范围内的新活动候选数量。离开首屏时点击数量会先回到顶部，再应用这些候选。",
    autoSilentLabel: "自动静默刷新",
    autoSilentTip:
      "在最新活动视图且停留首屏时按间隔自动应用新话题；离开首屏后暂停，只累计候选。",
    hidePinnedTip:
      "只在最新活动视图加载首页时，排除列表顶部已读的置顶话题。新活动队列和加载更多不会应用这个设置。",
    silentIntervalLabel: "静默刷新间隔",
    silentIntervalTip:
      "单位为秒，最小为 0。设为 0 时，有新活动会立即静默应用；大于 0 时按倒计时批量应用。",
    autoRefreshLabel: "自动刷新",
    autoRefreshTip:
      "用于非最新活动的排序视图，停留首屏时按间隔重新拉取当前列表。不要设置太快，频繁请求可能触发站点速率限制。",
    autoRefreshIntervalLabel: "自动刷新间隔",
    autoRefreshIntervalTip:
      "单位为秒，最小为 1。到达间隔后刷新当前筛选和排序下的列表。",
    secondsSuffix: "s",
    helpSuffix: "说明",
    tabMore: "展开板块 / 排序",
    tabPanelTitle: "拖动板块调整顺序",
    close: "关闭",
    loading: "加载中...",
    emptyTopics: "暂无话题",
    loadFailed: "加载失败",
    retry: "重试",
    noMatchingTopics: "无匹配话题",
    noUnreadInCategory: "该板块暂无未读话题",
    noUnread: "暂无未读话题",
    noRead: "暂无已读话题",
    currentPagePrefix: "当前页",
    nextPageNoMatch: "下一页无符合条件的话题",
    applyIncoming: "应用 {count} 个新的或更新的话题",
    backToTop: "回到顶部",
    hot: "热门",
    pinned: "已置顶",
    topicUnavailable: "话题异常",
    topicUnavailableTip:
      "此话题已从服务器列表中消失，可能被取消公开、隐藏或删除。点击可自行确认实际情况。",
    closedTitle: "此话题已被关闭；不再接受新回复",
    loadMore: "加载更多",
    noMore: "— 已经到底了 —",
    requestFailed: "请求失败",
  },
  en: {
    all: "All",
    orderActivity: "Latest activity",
    orderCreated: "Newest",
    orderViews: "Most viewed",
    orderPosts: "Most replies",
    orderLikes: "Most liked",
    orderOpLikes: "OP likes",
    periodAll: "All",
    periodDaily: "Daily",
    periodWeekly: "Weekly",
    periodMonthly: "Monthly",
    periodQuarterly: "Quarterly",
    periodYearly: "Yearly",
    filterAll: "All",
    filterUnseen: "Unread",
    filterRead: "Read",
    hidePinned: "Hide pinned",
    toggleTitle: "Toggle sidebar feed",
    refresh: "Refresh",
    settings: "Settings",
    incomingHintLabel: "New activity count",
    incomingHintTip:
      "Show incoming candidates for the current category scope in the refresh button. Away from the head, clicking the count returns to the top before applying them.",
    autoSilentLabel: "Auto silent refresh",
    autoSilentTip:
      "In the latest activity view, automatically apply incoming topics while the feed is at the head. Away from the head, pause applying and keep accumulating candidates.",
    hidePinnedTip:
      "Only in the latest activity view, exclude read pinned topics at the top when loading the first page. Incoming topics and load more are not affected.",
    silentIntervalLabel: "Silent interval",
    silentIntervalTip:
      "Seconds. Minimum 0. With 0, incoming activity is applied immediately; otherwise candidates are batched by countdown.",
    autoRefreshLabel: "Auto refresh",
    autoRefreshTip:
      "For non-latest sorting views, re-fetch the current list while the feed is at the head. Avoid very short intervals to reduce rate-limit risk.",
    autoRefreshIntervalLabel: "Refresh interval",
    autoRefreshIntervalTip:
      "Seconds. Minimum 1. Refreshes the current filter and sorting view when the interval elapses.",
    secondsSuffix: "s",
    helpSuffix: " help",
    tabMore: "Expand categories / order",
    tabPanelTitle: "Drag categories to reorder",
    close: "Close",
    loading: "Loading...",
    emptyTopics: "No topics",
    loadFailed: "Load failed",
    retry: "Retry",
    noMatchingTopics: "No matching topics",
    noUnreadInCategory: "No unread topics in this category",
    noUnread: "No unread topics",
    noRead: "No read topics",
    currentPagePrefix: "Current page: ",
    nextPageNoMatch: "Next page has no matching topics",
    applyIncoming: "Apply {count} new or updated topics",
    backToTop: "Back to top",
    hot: "Hot",
    pinned: "Pinned",
    topicUnavailable: "Unavailable",
    topicUnavailableTip:
      "This topic disappeared from the server list; it may be unlisted, hidden, or deleted. Click to check what happened.",
    closedTitle: "This topic is closed; it no longer accepts replies",
    loadMore: "Load more",
    noMore: "No more topics",
    requestFailed: "Request failed",
  },
};

export function createI18n(getDiscourse: () => DiscourseInstance | null) {
  function getUiLocale() {
    const candidates = [
      document.documentElement?.getAttribute("lang"),
      document.documentElement?.getAttribute("xml:lang"),
      getDiscourse()?.SiteSettings?.default_locale,
      navigator.language,
    ];
    const language =
      candidates.find((value) => String(value || "").trim()) || "en";
    return /^zh/i.test(language) ? "zh-CN" : "en";
  }

  function t(key: string, params: Record<string, string | number> = {}) {
    const messages = I18N[getUiLocale()] || I18N.en;
    const template = messages[key] || I18N.en[key] || key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => {
      return params[name] === undefined ? `{${name}}` : String(params[name]);
    });
  }

  function formatRelativeTime(dateStr?: string) {
    const date = new Date(dateStr || "");
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const diff = Math.max(0, now.getTime() - date.getTime());
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (getUiLocale() !== "zh-CN") {
      const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
      if (seconds < 60) return rtf.format(-Math.max(1, seconds), "second");
      if (minutes < 60) return rtf.format(-minutes, "minute");
      if (hours < 24) return rtf.format(-hours, "hour");
      if (days < 30) return rtf.format(-days, "day");
      const months = Math.floor(days / 30);
      if (months < 12) return rtf.format(-months, "month");
      return rtf.format(-Math.floor(months / 12), "year");
    }
    if (seconds < 60) return `${Math.max(1, seconds)}秒前`;
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月前`;
    return `${Math.floor(months / 12)}年前`;
  }
  return { getUiLocale, t, formatRelativeTime };
}
