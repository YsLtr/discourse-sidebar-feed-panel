// ==UserScript==
// @name         Discourse Sidebar Feed Panel
// @namespace    https://linux.do/
// @version      0.5.0
// @description  将侧边栏改造为信息流面板，支持板块分类筛选、已读/未读过滤、拖拽调整宽度
// @author       GLM
// @match        https://linux.do/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=linux.do
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  if (window.top !== window.self) return;

  // ========== 持久化键 ==========
  const STATE_KEY = "sfp_feed_mode_enabled";
  const ORDER_KEY = "sfp_current_order";
  const PERIOD_KEY = "sfp_current_period";
  const WIDTH_KEY = "sfp_sidebar_width";
  const TAB_KEY = "sfp_current_tab";
  const FILTER_KEY = "sfp_current_filter";

  // ========== 常量 ==========
  const DEFAULT_WIDTH = 272;
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 500;

  // ========== 全局状态 ==========
  let feedModeEnabled = GM_getValue(STATE_KEY, false);
  let currentOrder = GM_getValue(ORDER_KEY, "default");
  let currentPeriod = GM_getValue(PERIOD_KEY, "all");
  let sfpSidebarWidth = GM_getValue(WIDTH_KEY, DEFAULT_WIDTH);
  let currentTab = GM_getValue(TAB_KEY, "all");
  let currentFilter = GM_getValue(FILTER_KEY, "all");
  let currentCategoryId = null;

  let allTopics = [];
  let usersMap = {};
  let loadedTopicIds = new Set();
  let currentPage = 0;
  let hasMorePages = true;
  let isLoading = false;
  let isLoadingMore = false;
  let autoRefreshTimer = null;
  let autoRefreshSeconds = 0;
  let routeDebounceTimer = null;
  let toggleBtn = null;
  let feedContainer = null;
  let feedScrollEl = null;
  let feedListEl = null;
  let feedHeaderEl = null;
  let resizerEl = null;
  let isResizing = false;

  const isSmallScreen = () => window.innerWidth <= 768;

  // ========== 工具函数 ==========
  function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  }

  function navigateTo(path) {
    const script = document.createElement("script");
    script.textContent = `window.require("discourse/lib/url").default.routeTo("${path}");`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return `${Math.max(1, seconds)}秒前`;
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月前`;
    return `${Math.floor(months / 12)}年前`;
  }

  function getAvatarUrl(template, size) {
    if (!template) return "";
    let url = template.replace("{size}", String(size));
    if (!url.startsWith("http")) url = "https://linux.do" + url;
    return url;
  }

  function waitForEmber(callback, maxWait = 15000) {
    const start = Date.now();
    function check() {
      try {
        if (
          typeof Discourse !== "undefined" &&
          Discourse.__container__
        ) {
          callback();
          return;
        }
      } catch (e) { /* not ready */ }
      if (Date.now() - start < maxWait) {
        setTimeout(check, 500);
      } else {
        console.warn("[SFP] Timed out waiting for Ember");
      }
    }
    check();
  }

  // ========== 分类配置 ==========
  const CATEGORY_CONFIG = {
    4: { name: "开发调优", icon: "code", color: "#32c3c3", tabId: "develop" },
    20: { name: "开发调优, Lv1", icon: "code", color: "#32c3c3" },
    31: { name: "开发调优, Lv2", icon: "code", color: "#32c3c3" },
    88: { name: "开发调优, Lv3", icon: "code", color: "#32c3c3" },
    98: { name: "国产替代", icon: "seedling", color: "#D12C25", tabId: "domestic" },
    99: { name: "国产替代, Lv1", icon: "seedling", color: "#D12C25" },
    100: { name: "国产替代, Lv2", icon: "seedling", color: "#D12C25" },
    101: { name: "国产替代, Lv3", icon: "seedling", color: "#D12C25" },
    14: { name: "资源荟萃", icon: "square-share-nodes", color: "#12A89D", tabId: "resource" },
    83: { name: "资源荟萃, Lv1", icon: "square-share-nodes", color: "#12A89D" },
    84: { name: "资源荟萃, Lv2", icon: "square-share-nodes", color: "#12A89D" },
    85: { name: "资源荟萃, Lv3", icon: "square-share-nodes", color: "#12A89D" },
    94: { name: "网盘资源", icon: "hard-drive", color: "#16b176" },
    95: { name: "网盘资源, Lv1", icon: "hard-drive", color: "#16b176" },
    96: { name: "网盘资源, Lv2", icon: "hard-drive", color: "#16b176" },
    97: { name: "网盘资源, Lv3", icon: "hard-drive", color: "#16b176" },
    42: { name: "文档共建", icon: "book", color: "#9cb6c4", tabId: "wiki" },
    75: { name: "文档共建, Lv1", icon: "book", color: "#9cb6c4" },
    76: { name: "文档共建, Lv2", icon: "book", color: "#9cb6c4" },
    77: { name: "文档共建, Lv3", icon: "book", color: "#9cb6c4" },
    10: { name: "跳蚤市场", icon: "coins", color: "#ED207B", tabId: "trade" },
    106: { name: "积分乐园", icon: "credit-card", color: "#fcca44", tabId: "credit" },
    107: { name: "积分乐园, Lv1", icon: "credit-card", color: "#fcca44" },
    108: { name: "积分乐园, Lv2", icon: "credit-card", color: "#fcca44" },
    109: { name: "积分乐园, Lv3", icon: "credit-card", color: "#fcca44" },
    27: { name: "非我莫属", icon: "briefcase", color: "#a8c6fe", tabId: "job" },
    72: { name: "非我莫属, Lv1", icon: "briefcase", color: "#a8c6fe" },
    73: { name: "非我莫属, Lv2", icon: "briefcase", color: "#a8c6fe" },
    74: { name: "非我莫属, Lv3", icon: "briefcase", color: "#a8c6fe" },
    32: { name: "读书成诗", icon: "book-open-reader", color: "#e0d900", tabId: "reading" },
    69: { name: "读书成诗, Lv1", icon: "book-open-reader", color: "#e0d900" },
    70: { name: "读书成诗, Lv2", icon: "book-open-reader", color: "#e0d900" },
    71: { name: "读书成诗, Lv3", icon: "book-open-reader", color: "#e0d900" },
    46: { name: "扬帆起航", icon: "rocket", color: "#ff9838", tabId: "startup" },
    66: { name: "扬帆起航, Lv1", icon: "rocket", color: "#ff9838" },
    67: { name: "扬帆起航, Lv2", icon: "rocket", color: "#ff9838" },
    68: { name: "扬帆起航, Lv3", icon: "rocket", color: "#ff9838" },
    34: { name: "前沿快讯", icon: "newspaper", color: "#BB8FCE", tabId: "news" },
    78: { name: "前沿快讯, Lv1", icon: "newspaper", color: "#BB8FCE" },
    79: { name: "前沿快讯, Lv2", icon: "newspaper", color: "#BB8FCE" },
    80: { name: "前沿快讯, Lv3", icon: "newspaper", color: "#BB8FCE" },
    36: { name: "福利羊毛", icon: "piggy-bank", color: "#E45735", tabId: "welfare" },
    60: { name: "福利羊毛, Lv1", icon: "piggy-bank", color: "#E45735" },
    61: { name: "福利羊毛, Lv2", icon: "piggy-bank", color: "#E45735" },
    62: { name: "福利羊毛, Lv3", icon: "piggy-bank", color: "#E45735" },
    11: { name: "搞七捻三", icon: "droplet", color: "#3AB54A", tabId: "gossip" },
    35: { name: "搞七捻三, Lv1", icon: "droplet", color: "#3AB54A" },
    89: { name: "搞七捻三, Lv2", icon: "droplet", color: "#3AB54A" },
    21: { name: "搞七捻三, Lv3", icon: "droplet", color: "#3AB54A" },
    102: { name: "社区孵化", icon: "lightbulb", color: "#ffbb00", tabId: "incubation" },
    103: { name: "社区孵化, Lv1", icon: "lightbulb", color: "#ffbb00" },
    104: { name: "社区孵化, Lv2", icon: "lightbulb", color: "#ffbb00" },
    105: { name: "社区孵化, Lv3", icon: "lightbulb", color: "#ffbb00" },
    110: { name: "虫洞广场", icon: "hurricane", color: "#ff00f7", tabId: "square" },
    2: { name: "运营反馈", icon: "comments", color: "#808281", tabId: "feedback" },
    30: { name: "运营反馈, 活动", icon: "comments", color: "#808281" },
    63: { name: "运营反馈, Lv1", icon: "comments", color: "#808281" },
    64: { name: "运营反馈, Lv2", icon: "comments", color: "#808281" },
    65: { name: "运营反馈, Lv3", icon: "comments", color: "#808281" },
    45: { name: "深海幽域", icon: "water", color: "#45B7D1", tabId: "muted" },
    57: { name: "深海幽域, Lv1", icon: "water", color: "#45B7D1" },
    58: { name: "深海幽域, Lv2", icon: "water", color: "#45B7D1" },
    59: { name: "深海幽域, Lv3", icon: "water", color: "#45B7D1" },
  };

  // 有 tabId 的主分类（用于标签页渲染）
  const TAB_CATEGORIES = Object.entries(CATEGORY_CONFIG)
    .filter(([, v]) => v.tabId)
    .map(([id, v]) => ({ id: Number(id), ...v }));

  function getCategoryName(id) { return CATEGORY_CONFIG[id]?.name || ""; }
  function getCategoryColor(id) { return CATEGORY_CONFIG[id]?.color || "#888"; }
  function getCategoryIcon(id) { return CATEGORY_CONFIG[id]?.icon || "folder"; }

  // ========== CSS 注入 ==========
  function injectStyles() {
    GM_addStyle(`
      /* ===== 切换按钮 ===== */
      .sfp-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: var(--primary-medium, #888);
        cursor: pointer;
        border-radius: 4px;
        padding: 0;
        margin-left: 6px;
        vertical-align: middle;
        transition: color 0.2s, background 0.2s;
        flex-shrink: 0;
      }
      .sfp-toggle-btn:hover {
        color: var(--primary, #333);
        background: var(--primary-low, #eee);
      }
      .sfp-toggle-btn.active {
        color: var(--tertiary, #0088cc);
        background: var(--tertiary-very-low, rgba(0,136,204,0.1));
      }
      .sfp-toggle-btn svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .home-logo-wrapper-outlet .title {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      /* ===== 侧边栏 Feed 模式 ===== */
      .sidebar-container.sfp-feed-mode .sidebar-sections {
        display: none !important;
      }
      .sidebar-container.sfp-feed-mode .sfp-feed-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      /* ===== 拖拽调整宽度 ===== */
      .sfp-resizer {
        position: absolute;
        top: 0;
        right: -2px;
        width: 5px;
        height: 100%;
        cursor: ew-resize;
        z-index: 10001;
        transition: background 0.2s;
      }
      .sfp-resizer:hover,
      .sfp-resizer.sfp-resizing {
        background: var(--tertiary, #08c);
      }

      /* ===== Feed Header ===== */
      .sfp-feed-header {
        flex-shrink: 0;
        padding: 8px 10px;
        border-bottom: 1px solid var(--primary-low, #e9e9e9);
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        align-items: center;
      }
      .sfp-feed-header select {
        font-size: 11px;
        padding: 3px 6px;
        border: 1px solid var(--primary-low, #ddd);
        border-radius: 4px;
        background: var(--secondary, #fff);
        color: var(--primary, #333);
        max-width: 90px;
        outline: none;
        cursor: pointer;
        height: 24px;
        line-height: 1;
        transition: border-color 0.2s;
      }
      .sfp-feed-header select:focus {
        border-color: var(--tertiary, #0088cc);
      }
      .sfp-feed-header .sfp-refresh-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: none;
        background: transparent;
        color: var(--primary-medium, #888);
        cursor: pointer;
        border-radius: 4px;
        padding: 0;
        flex-shrink: 0;
        transition: color 0.2s, background 0.2s;
      }
      .sfp-feed-header .sfp-refresh-btn:hover {
        color: var(--tertiary, #0088cc);
        background: var(--primary-very-low, #f5f5f5);
      }
      .sfp-feed-header .sfp-refresh-btn.spinning svg {
        animation: sfp-spin 0.6s linear infinite;
      }
      @keyframes sfp-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .sfp-feed-header .sfp-refresh-btn svg {
        width: 15px;
        height: 15px;
        fill: currentColor;
      }
      .sfp-feed-header .sfp-hint-text {
        font-size: 11px;
        color: var(--tertiary, #0088cc);
        cursor: pointer;
        width: 100%;
        padding: 2px 0;
        text-decoration: none;
        transition: color 0.2s;
      }
      .sfp-feed-header .sfp-hint-text:hover {
        color: var(--tertiary-high, #006699);
        text-decoration: underline;
      }

      /* ===== 分类标签栏 ===== */
      .sfp-tab-bar {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        width: 100%;
        padding: 8px 12px;
        margin: 0;
        border-bottom: 1px solid var(--primary-low, #e9e9e9);
        flex-shrink: 0;
        background: var(--secondary, #fff);
      }
      .sfp-tab-bar::-webkit-scrollbar { display: none; }
      .sfp-tab-item {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 4px 12px;
        font-size: 13px;
        color: var(--primary-medium, #888);
        cursor: pointer;
        white-space: nowrap;
        border-radius: 16px;
        background: var(--primary-very-low, #f0f0f0);
        transition: all 0.2s;
        border: 1px solid transparent;
        flex-shrink: 0;
        user-select: none;
      }
      .sfp-tab-item:hover {
        color: var(--primary, #222);
        background: var(--primary-low, #e9e9e9);
      }
      .sfp-tab-item.active {
        color: white;
        background: var(--tertiary, #08c);
        border-color: var(--tertiary, #08c);
      }
      .sfp-tab-item svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
        flex-shrink: 0;
      }

      /* ===== 筛选栏 ===== */
      .sfp-filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 8px 16px;
        margin: 0;
        background: var(--primary-very-low, #f8f8f8);
        border-bottom: 1px solid var(--primary-low, #e9e9e9);
        font-size: 12px;
        color: var(--primary-medium, #888);
        flex-shrink: 0;
      }
      .sfp-filter-item {
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: all 0.2s;
        user-select: none;
      }
      .sfp-filter-item:hover {
        color: var(--tertiary, #08c);
        background: var(--primary-low, #eee);
      }
      .sfp-filter-item.active {
        color: #fff;
        background: var(--tertiary, #08c);
      }

      /* ===== Feed 滚动区 ===== */
      .sfp-feed-scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
      }

      /* ===== 帖子列表项 ===== */
      .sfp-topic-item {
        padding: 12px 20px;
        border-bottom: 1px solid var(--primary-very-low, #f0f0f0);
        cursor: pointer;
        transition: background 0.2s;
        position: relative;
      }
      .sfp-topic-item:hover {
        background: var(--primary-very-low, #f8f8f8);
      }
      .sfp-topic-item.sfp-new-highlight {
        animation: sfp-new-pulse 10s ease-out forwards;
        position: relative;
      }
      @keyframes sfp-new-pulse {
        0% {
          box-shadow: inset 0 0 0 2px #fcca04;
          background: rgba(252, 202, 4, 0.15);
        }
        100% {
          box-shadow: inset 0 0 0 0px transparent;
          background: transparent;
        }
      }

      /* 未读圆点 — 绝对定位右上角 */
      .sfp-topic-item .sfp-unseen-dot {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--tertiary, #0088cc);
      }

      /* 头像 + 用户信息行 */
      .sfp-topic-item .sfp-topic-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 5px;
      }
      .sfp-topic-item .sfp-topic-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex-shrink: 0;
        object-fit: cover;
      }
      .sfp-topic-item .sfp-topic-meta-col {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }
      .sfp-topic-item .sfp-topic-user-info {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
        overflow: hidden;
      }
      .sfp-topic-item .sfp-topic-username {
        font-size: 13px;
        color: var(--primary, #222);
        font-weight: 500;
        cursor: pointer;
        transition: color 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sfp-topic-item .sfp-topic-username:hover {
        color: var(--tertiary, #08c);
      }
      .sfp-topic-item .sfp-topic-name {
        font-size: 12px;
        color: var(--primary-medium, #888);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sfp-topic-item .sfp-topic-time {
        font-size: 12px;
        color: var(--primary-medium, #888);
        white-space: nowrap;
        margin-left: auto;
        flex-shrink: 0;
      }

      /* 标题 */
      .sfp-topic-item .sfp-topic-title {
        font-size: 14px;
        color: var(--primary, #222);
        line-height: 1.4;
        margin: 0;
        word-break: break-word;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        transition: color 0.2s;
      }
      .sfp-topic-item .sfp-topic-title:hover {
        color: var(--tertiary, #08c);
      }
      .sfp-topic-item .sfp-topic-closed {
        color: var(--danger, #e45735);
        font-size: 11px;
        font-weight: bold;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-left: 4px;
      }

      /* 分类 + 标签行 */
      .sfp-topic-item .sfp-topic-category-tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        margin-top: 5px;
      }
      .sfp-topic-item .sfp-category-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 3px;
        background: var(--primary-very-low, #f0f0f0);
        color: var(--primary-medium, #666);
        flex-shrink: 0;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sfp-topic-item .sfp-category-icon {
        width: 12px;
        height: 12px;
        fill: var(--category-color, #888);
        flex-shrink: 0;
      }

      /* 标签 */
      .sfp-topic-item .sfp-topic-tags {
        display: flex;
        gap: 3px;
        flex-wrap: wrap;
      }
      .sfp-topic-item .sfp-tag {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 3px;
        background: var(--primary-very-low, #f0f0f0);
        color: var(--primary-medium, #666);
        line-height: 1.4;
      }

      /* 统计行 */
      .sfp-topic-item .sfp-topic-stats {
        display: flex;
        gap: 12px;
        margin-top: 8px;
        font-size: 12px;
        color: var(--primary-medium, #888);
      }
      .sfp-topic-item .sfp-topic-stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* ===== 加载状态 ===== */
      .sfp-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: var(--primary-medium, #999);
        font-size: 13px;
        gap: 12px;
      }
      .sfp-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid var(--primary-low, #e9e9e9);
        border-top-color: var(--tertiary, #0088cc);
        border-radius: 50%;
        animation: sfp-spin 0.8s linear infinite;
      }
      .sfp-empty {
        text-align: center;
        padding: 40px 10px;
        color: var(--primary-medium, #999);
        font-size: 13px;
      }
      .sfp-load-more {
        padding: 14px 10px;
        text-align: center;
        font-size: 12px;
        color: var(--primary-medium, #888);
        cursor: pointer;
        transition: color 0.2s;
      }
      .sfp-load-more:hover {
        color: var(--tertiary, #08c);
      }
      .sfp-load-more .sfp-load-more-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid var(--primary-low, #e9e9e9);
        border-top-color: var(--tertiary, #0088cc);
        border-radius: 50%;
        animation: sfp-spin 0.8s linear infinite;
        vertical-align: middle;
        margin-right: 6px;
      }
      .sfp-no-more {
        padding: 14px 10px;
        text-align: center;
        font-size: 11px;
        color: var(--primary-low-mid, #aaa);
      }
      .sfp-error {
        padding: 40px 20px;
        text-align: center;
        color: var(--danger, #e45735);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .sfp-error-icon {
        font-size: 32px;
      }
      .sfp-error-msg {
        font-size: 14px;
        font-weight: 600;
      }
      .sfp-error-detail {
        font-size: 12px;
        color: var(--primary-medium, #888);
        word-break: break-word;
      }
      .sfp-error .sfp-retry-btn {
        margin-top: 6px;
        padding: 6px 16px;
        background: var(--tertiary, #08c);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: opacity 0.2s;
      }
      .sfp-error .sfp-retry-btn:hover {
        opacity: 0.85;
      }
    `);
  }

  // ========== 切换开关 ==========
  function createToggle() {
    if (toggleBtn) return toggleBtn;

    const homeLogo = document.querySelector(".home-logo-wrapper-outlet");
    if (!homeLogo) return null;

    toggleBtn = document.createElement("button");
    toggleBtn.className = "sfp-toggle-btn" + (feedModeEnabled ? " active" : "");
    toggleBtn.title = "切换侧边栏信息流";
    toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>`;

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      feedModeEnabled = !feedModeEnabled;
      GM_setValue(STATE_KEY, feedModeEnabled);
      toggleBtn.classList.toggle("active", feedModeEnabled);
      if (feedModeEnabled) {
        activateFeed();
      } else {
        deactivateFeed();
      }
    });

    // 放入 .title 内部，logo 右边
    const titleEl = homeLogo.querySelector(".title");
    if (titleEl) {
      titleEl.appendChild(toggleBtn);
    } else {
      homeLogo.appendChild(toggleBtn);
    }
    return toggleBtn;
  }

  // ========== 侧边栏宽度控制 ==========
  function applySidebarWidth(width) {
    sfpSidebarWidth = width;
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (sidebar) {
      sidebar.style.setProperty("width", width + "px", "important");
    }
    document.documentElement.style.setProperty("--d-sidebar-width", width + "px");
  }

  function restoreSidebarWidth() {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (sidebar) {
      sidebar.style.removeProperty("width");
    }
    document.documentElement.style.removeProperty("--d-sidebar-width");
  }

  function setupResizer() {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (!sidebar || resizerEl) return;

    resizerEl = document.createElement("div");
    resizerEl.className = "sfp-resizer";
    sidebar.appendChild(resizerEl);

    resizerEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      const startX = e.clientX;
      const startWidth = sidebar.offsetWidth;
      resizerEl.classList.add("sfp-resizing");
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (e) => {
        if (!isResizing) return;
        const delta = e.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        applySidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        isResizing = false;
        resizerEl.classList.remove("sfp-resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        GM_setValue(WIDTH_KEY, sfpSidebarWidth);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  function removeResizer() {
    if (resizerEl) {
      resizerEl.remove();
      resizerEl = null;
    }
  }

  // ========== 激活 / 停用 ==========
  function activateFeed() {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (!sidebar) return;

    // 创建 feed 容器
    feedContainer = document.createElement("div");
    feedContainer.className = "sfp-feed-container";

    feedHeaderEl = document.createElement("div");
    feedHeaderEl.className = "sfp-feed-header";
    _buildHeaderControls(feedHeaderEl);

    // 分类标签栏
    const tabBar = _buildTabBar();
    feedContainer.appendChild(feedHeaderEl);
    feedContainer.appendChild(tabBar);

    // 筛选栏
    const filterBar = _buildFilterBar();
    feedContainer.appendChild(filterBar);

    feedScrollEl = document.createElement("div");
    feedScrollEl.className = "sfp-feed-scroll";

    feedListEl = document.createElement("div");
    feedListEl.className = "sfp-topic-list";

    feedScrollEl.appendChild(feedListEl);
    feedContainer.appendChild(feedScrollEl);
    sidebar.appendChild(feedContainer);

    sidebar.classList.add("sfp-feed-mode");

    // 恢复当前 tab 筛选的分类
    _restoreTabState();

    // 应用保存的宽度
    applySidebarWidth(sfpSidebarWidth);

    // 添加拖拽调整宽度
    setupResizer();

    // 如果已有缓存数据，直接渲染
    if (allTopics.length > 0) {
      renderTopics();
      _startAutoRefresh();
      _silentRefresh();
    } else {
      loadTopics();
    }

    // 无限滚动
    _setupScrollLoadMore();
  }

  function deactivateFeed() {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (!sidebar) return;

    _stopAutoRefresh();

    removeResizer();
    restoreSidebarWidth();

    if (feedContainer) {
      feedContainer.remove();
      feedContainer = null;
      feedHeaderEl = null;
      feedScrollEl = null;
      feedListEl = null;
    }

    sidebar.classList.remove("sfp-feed-mode");
  }

  // ========== Header 控件 ==========
  function _buildHeaderControls(header) {
    // 刷新按钮
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "sfp-refresh-btn";
    refreshBtn.title = "刷新";
    refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
    refreshBtn.addEventListener("click", () => {
      refreshBtn.classList.add("spinning");
      loadTopics().finally(() => refreshBtn.classList.remove("spinning"));
    });
    header.appendChild(refreshBtn);

    // Order 选择
    const orderSelect = document.createElement("select");
    orderSelect.className = "sfp-order-select";
    const orders = [
      { label: "默认", value: "default" },
      { label: "最新活动", value: "activity" },
      { label: "最新发布", value: "created" },
      { label: "最多浏览", value: "views" },
      { label: "最多回复", value: "posts" },
      { label: "最多点赞", value: "likes" },
      { label: "楼主点赞", value: "op_likes" },
    ];
    orders.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === currentOrder) opt.selected = true;
      orderSelect.appendChild(opt);
    });

    // Period 选择
    const periodSelect = document.createElement("select");
    periodSelect.className = "sfp-period-select";
    const periods = [
      { label: "全部", value: "all" },
      { label: "每日", value: "daily" },
      { label: "每周", value: "weekly" },
      { label: "每月", value: "monthly" },
      { label: "每季", value: "quarterly" },
      { label: "每年", value: "yearly" },
    ];
    periods.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.textContent = p.label;
      if (p.value === currentPeriod) opt.selected = true;
      periodSelect.appendChild(opt);
    });

    function _updatePeriodVisibility() {
      periodSelect.style.display = _needsPeriodForUrl(orderSelect.value) ? "" : "none";
    }
    _updatePeriodVisibility();

    orderSelect.addEventListener("change", () => {
      currentOrder = orderSelect.value;
      GM_setValue(ORDER_KEY, currentOrder);
      _updatePeriodVisibility();
      loadTopics();
    });

    periodSelect.addEventListener("change", () => {
      currentPeriod = periodSelect.value;
      GM_setValue(PERIOD_KEY, currentPeriod);
      loadTopics();
    });

    header.appendChild(orderSelect);
    header.appendChild(periodSelect);

    // 新话题提示（动态更新）
    _updateShowMoreHint(header);
  }

  // ========== 分类标签栏 ==========
  function _buildTabBar() {
    const bar = document.createElement("div");
    bar.className = "sfp-tab-bar";

    // "全部" 标签
    const allTab = document.createElement("span");
    allTab.className = "sfp-tab-item" + (currentTab === "all" ? " active" : "");
    allTab.dataset.tab = "all";
    allTab.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>全部`;
    bar.appendChild(allTab);

    // 各板块标签
    TAB_CATEGORIES.forEach((cat) => {
      const tab = document.createElement("span");
      tab.className = "sfp-tab-item" + (currentTab === cat.tabId ? " active" : "");
      tab.dataset.tab = cat.tabId;
      tab.dataset.categoryId = cat.id;
      tab.innerHTML = `<svg><use href="#${cat.icon}"></use></svg>${escapeHtml(cat.name)}`;
      bar.appendChild(tab);
    });

    // 事件代理
    bar.addEventListener("click", (e) => {
      const tab = e.target.closest(".sfp-tab-item");
      if (!tab) return;

      const tabId = tab.dataset.tab;
      const catId = tab.dataset.categoryId ? Number(tab.dataset.categoryId) : null;

      currentTab = tabId;
      currentCategoryId = catId;
      GM_setValue(TAB_KEY, currentTab);

      // 更新标签高亮
      bar.querySelectorAll(".sfp-tab-item").forEach((t) => {
        t.classList.remove("active");
      });
      tab.classList.add("active");

      // 切换板块时重新加载
      loadTopics();
    });

    return bar;
  }

  // ========== 筛选栏 ==========
  function _buildFilterBar() {
    const bar = document.createElement("div");
    bar.className = "sfp-filter-bar";

    const filters = [
      { label: "全部", value: "all" },
      { label: "未读", value: "unseen" },
      { label: "已读", value: "read" },
    ];

    filters.forEach((f) => {
      const item = document.createElement("span");
      item.className = "sfp-filter-item" + (currentFilter === f.value ? " active" : "");
      item.dataset.filter = f.value;
      item.textContent = f.label;
      bar.appendChild(item);
    });

    bar.addEventListener("click", (e) => {
      const item = e.target.closest(".sfp-filter-item");
      if (!item) return;

      currentFilter = item.dataset.filter;
      GM_setValue(FILTER_KEY, currentFilter);

      bar.querySelectorAll(".sfp-filter-item").forEach((i) => i.classList.remove("active"));
      item.classList.add("active");

      renderTopics();
      _checkAutoLoadOnSparseFilter();
    });

    return bar;
  }

  // ========== 恢复标签栏状态 ==========
  function _restoreTabState() {
    if (currentTab === "all") {
      currentCategoryId = null;
      return;
    }
    const cat = TAB_CATEGORIES.find((c) => c.tabId === currentTab);
    if (cat) {
      currentCategoryId = cat.id;
    } else {
      currentTab = "all";
      currentCategoryId = null;
    }
  }

  async function _updateShowMoreHint(header) {
    // 只在默认模式（全部板块 + 默认排序 + 全部筛选）时刷新提示
    if (currentTab !== "all" || currentOrder !== "default" || currentFilter !== "all") {
      // 非默认模式移除已有提示
      const existing = header.querySelector(".sfp-hint-text");
      if (existing) existing.remove();
      return;
    }
    try {
      const container = Discourse.__container__;
      if (!container) return;
      const trackingState = container.lookup("service:topic-tracking-state");
      if (!trackingState) return;
      const newCount = trackingState.incomingCount || 0;
      if (newCount > 0) {
        const existing = header.querySelector(".sfp-hint-text");
        if (existing) existing.remove();
        const hint = document.createElement("a");
        hint.className = "sfp-hint-text";
        hint.textContent = `${newCount} 个新话题`;
        hint.addEventListener("click", (e) => {
          e.preventDefault();
          navigateTo("/new");
        });
        header.appendChild(hint);
      }
    } catch (e) { /* tracking state not available */ }
  }

  // ========== 数据加载 ==========
  async function fetchFeedTopics(order, period, page) {
    let url;
    if (currentTab !== "all" && currentCategoryId) {
      const cat = CATEGORY_CONFIG[currentCategoryId];
      const tabId = cat?.tabId || currentTab;
      url = `/c/${tabId}/${currentCategoryId}/l/latest.json?page=${page}`;
    } else {
      url = "/latest.json?";
      const params = [];
      const effectiveOrder = order === "default" ? "activity" : order;
      params.push(`order=${encodeURIComponent(effectiveOrder)}`);
      params.push(`page=${page}`);
      if (period !== "all" && _needsPeriodForUrl(order)) {
        params.push(`period=${encodeURIComponent(period)}`);
      }
      url += params.join("&");
    }

    const csrfToken = getCsrfToken();
    const headers = { "X-CSRF-Token": csrfToken };
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }

  function _needsPeriodForUrl(order) {
    return ["views", "posts", "likes", "op_likes"].includes(order);
  }

  async function loadTopics() {
    if (isLoading) return;
    isLoading = true;

    currentPage = 0;
    hasMorePages = true;
    allTopics = [];
    loadedTopicIds.clear();

    if (feedListEl) {
      feedListEl.innerHTML = `<div class="sfp-loading"><div class="sfp-spinner"></div>加载中...</div>`;
    }

    try {
      const data = await fetchFeedTopics(currentOrder, currentPeriod, 0);
      _processUsers(data);

      if (data?.topic_list?.topics) {
        const topics = data.topic_list.topics;
        topics.forEach((t) => loadedTopicIds.add(t.id));
        allTopics = topics;
        hasMorePages = topics.length > 0;
        renderTopics();
      } else {
        if (feedListEl) feedListEl.innerHTML = `<div class="sfp-empty">暂无话题</div>`;
        hasMorePages = false;
      }

      _startAutoRefresh();
    } catch (e) {
      console.error("[SFP] loadTopics error:", e);
      if (feedListEl) {
        feedListEl.innerHTML = `
          <div class="sfp-error">
            <div class="sfp-error-icon">⚠️</div>
            <div class="sfp-error-msg">加载失败</div>
            <div class="sfp-error-detail">${escapeHtml(e.message)}</div>
            <button class="sfp-retry-btn">重试</button>
          </div>`;
        feedListEl.querySelector(".sfp-retry-btn")?.addEventListener("click", () => loadTopics());
      }
    } finally {
      isLoading = false;
    }
  }

  async function loadMoreTopics() {
    if (isLoadingMore || !hasMorePages) return;
    isLoadingMore = true;
    currentPage++;

    _showLoadMoreSpinner();

    try {
      const data = await fetchFeedTopics(currentOrder, currentPeriod, currentPage);
      _processUsers(data);

      if (data?.topic_list?.topics) {
        const topics = data.topic_list.topics;
        const newTopics = topics.filter((t) => {
          if (loadedTopicIds.has(t.id)) return false;
          loadedTopicIds.add(t.id);
          return true;
        });

        if (newTopics.length === 0) {
          hasMorePages = false;
          _showNoMore();
        } else {
          allTopics = allTopics.concat(newTopics);
          newTopics.forEach((topic) => {
            const item = createTopicItem(topic);
            feedListEl.appendChild(item);
          });
          _removeLoadMore();

          if (newTopics.length < 5 && hasMorePages) {
            isLoadingMore = false;
            loadMoreTopics();
            return;
          }
        }
      } else {
        hasMorePages = false;
        _showNoMore();
      }
    } catch (e) {
      console.error("[SFP] loadMoreTopics error:", e);
      _removeLoadMore();
    } finally {
      isLoadingMore = false;
    }
  }

  function _processUsers(data) {
    if (data?.users) {
      data.users.forEach((u) => { usersMap[u.id] = u; });
    }
  }

  // ========== 静默刷新 ==========
  async function _silentRefresh() {
    if (isLoading) return;

    try {
      const data = await fetchFeedTopics(currentOrder, currentPeriod, 0);
      _processUsers(data);

      if (!data?.topic_list?.topics) return;

      const freshTopics = data.topic_list.topics;
      let hasNew = false;
      let hasStatusChange = false;
      const newTopicIds = [];

      const freshMap = new Map(freshTopics.map((t) => [t.id, t]));

      allTopics.forEach((existing) => {
        if (freshMap.has(existing.id)) {
          const latest = freshMap.get(existing.id);
          if (existing.unseen !== latest.unseen || existing.posts_count !== latest.posts_count) {
            hasStatusChange = true;
          }
          Object.assign(existing, latest);
        }
      });

      freshTopics.forEach((t) => {
        if (!loadedTopicIds.has(t.id)) {
          loadedTopicIds.add(t.id);
          allTopics.unshift(t);
          newTopicIds.push(t.id);
          hasNew = true;
        }
      });

      if (hasNew || hasStatusChange) {
        allTopics.sort((a, b) => {
          const aTime = a.bumped_at || a.last_posted_at || a.created_at;
          const bTime = b.bumped_at || b.last_posted_at || b.created_at;
          return new Date(bTime) - new Date(aTime);
        });
        renderTopics(newTopicIds);
      }

      if (feedHeaderEl) _updateShowMoreHint(feedHeaderEl);
    } catch (e) {
      console.warn("[SFP] silent refresh error:", e);
    }
  }

  // ========== 自动刷新 ==========
  const AUTO_REFRESH_INTERVAL = 60;

  function _startAutoRefresh() {
    _stopAutoRefresh();
    autoRefreshSeconds = AUTO_REFRESH_INTERVAL;
    autoRefreshTimer = setInterval(() => {
      autoRefreshSeconds--;
      if (autoRefreshSeconds <= 0) {
        autoRefreshSeconds = AUTO_REFRESH_INTERVAL;
        if (feedModeEnabled && !isLoading && !isLoadingMore) {
          _silentRefresh();
        }
      }
    }, 1000);
  }

  function _stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  // ========== 渲染 ==========
  function renderTopics(newTopicIds = []) {
    if (!feedListEl) return;
    feedListEl.innerHTML = "";

    if (allTopics.length === 0) {
      feedListEl.innerHTML = `<div class="sfp-empty">暂无话题</div>`;
      return;
    }

    // 客户端筛选
    const filtered = _applyFilter(allTopics);

    if (filtered.length === 0) {
      feedListEl.innerHTML = `<div class="sfp-empty">无匹配话题</div>`;
    } else {
      filtered.forEach((topic) => {
        const item = createTopicItem(topic, newTopicIds.includes(topic.id));
        feedListEl.appendChild(item);
      });
    }

    if (hasMorePages) {
      const loadMoreEl = document.createElement("div");
      loadMoreEl.className = "sfp-load-more";
      loadMoreEl.textContent = "加载更多";
      loadMoreEl.addEventListener("click", () => {
        loadMoreEl.remove();
        loadMoreTopics();
      });
      feedListEl.appendChild(loadMoreEl);
    } else {
      const noMoreEl = document.createElement("div");
      noMoreEl.className = "sfp-no-more";
      noMoreEl.textContent = "— 已经到底了 —";
      feedListEl.appendChild(noMoreEl);
    }
  }

  // ========== 客户端筛选 ==========
  function _applyFilter(topics) {
    if (currentFilter === "unseen") {
      return topics.filter((t) => t.unseen);
    }
    if (currentFilter === "read") {
      return topics.filter((t) => !t.unseen);
    }
    return topics;
  }

  // ========== 筛选结果稀疏时自动加载 ==========
  function _checkAutoLoadOnSparseFilter() {
    const filtered = _applyFilter(allTopics);
    if (filtered.length < 10 && hasMorePages && !isLoadingMore && !isLoading) {
      loadMoreTopics();
    }
  }

  // ========== 创建帖子项 ==========
  function createTopicItem(topic, isNew = false) {
    const item = document.createElement("div");
    item.className = "sfp-topic-item";
    if (isNew) {
      item.classList.add("sfp-new-highlight");
      setTimeout(() => item.classList.remove("sfp-new-highlight"), 10000);
    }

    // 获取用户信息
    let avatarUrl = "";
    let name = "";
    let username = "";
    if (topic.posters && topic.posters.length > 0) {
      const userId = topic.posters[0].user_id;
      const user = usersMap[userId];
      if (user) {
        name = user.name || "";
        username = user.username || "";
        if (user.avatar_template) {
          avatarUrl = getAvatarUrl(user.avatar_template, 45);
        }
      }
    }

    // 未读标记
    const unseenDot = topic.unseen ? '<span class="sfp-unseen-dot"></span>' : "";

    // 头像 HTML
    const avatarHtml = avatarUrl
      ? `<img class="sfp-topic-avatar" src="${avatarUrl}" alt="${escapeHtml(username)}" loading="lazy">`
      : "";

    // 显示名称
    const displayName = name && name !== username
      ? `<span class="sfp-topic-name">${escapeHtml(name)}</span>`
      : "";

    // 时间
    const timeStr = formatRelativeTime(topic.bumped_at || topic.last_posted_at || topic.created_at);

    // 标题
    const closedHtml = topic.closed
      ? `<span class="sfp-topic-closed" title="已关闭">🔒已关闭</span>`
      : "";

    // 分类
    const catName = getCategoryName(topic.category_id);
    const catColor = getCategoryColor(topic.category_id);
    const catIcon = getCategoryIcon(topic.category_id);
    const categoryHtml = catName
      ? `<span class="sfp-category-badge" style="--category-color:${catColor}"><svg class="sfp-category-icon"><use href="#${catIcon}"></use></svg>${escapeHtml(catName)}</span>`
      : "";

    // 标签
    let tagsHtml = "";
    if (topic.tags && topic.tags.length > 0) {
      const tagItems = topic.tags.slice(0, 3).map((tag) => {
        const tagName = typeof tag === "string" ? tag : tag.name;
        return `<span class="sfp-tag">${escapeHtml(tagName)}</span>`;
      }).join("");
      tagsHtml = `<span class="sfp-topic-tags">${tagItems}</span>`;
    }

    // 统计
    const replies = Math.max(0, (topic.posts_count || 1) - 1);
    const views = topic.views >= 1000 ? (topic.views / 1000).toFixed(1) + "k" : (topic.views || 0);
    const likes = topic.like_count || 0;

    item.innerHTML = `
      ${unseenDot}
      <div class="sfp-topic-header">
        ${avatarHtml}
        <div class="sfp-topic-meta-col">
          <div class="sfp-topic-user-info">
            ${displayName}
            <span class="sfp-topic-username">${escapeHtml(username)}</span>
          </div>
        </div>
        <span class="sfp-topic-time">${timeStr}</span>
      </div>
      <div class="sfp-topic-title">${escapeHtml(topic.unicode_title || topic.title)}${closedHtml}</div>
      <div class="sfp-topic-category-tags">
        ${categoryHtml}
        ${tagsHtml}
      </div>
      <div class="sfp-topic-stats">
        <span class="sfp-topic-stat">💬 ${replies}</span>
        <span class="sfp-topic-stat">👁 ${views}</span>
        <span class="sfp-topic-stat">❤️ ${likes}</span>
      </div>
    `;

    // 点击跳转
    item.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      markTopicAsRead(topic, item);
      const slug = topic.slug || "topic";
      navigateTo(`/t/${slug}/${topic.id}`);
    });

    // 中键新标签页
    item.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
    item.addEventListener("mouseup", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        markTopicAsRead(topic, item);
        const slug = topic.slug || "topic";
        window.open(`https://linux.do/t/${slug}/${topic.id}`, "_blank");
      }
    });

    return item;
  }

  // ========== 标记帖子为已读 ==========
  function markTopicAsRead(topic, itemElement) {
    if (!topic.unseen) return;
    topic.unseen = false;
    const existing = allTopics.find((t) => t.id === topic.id);
    if (existing) existing.unseen = false;
    const dot = itemElement.querySelector(".sfp-unseen-dot");
    if (dot) dot.remove();
  }

  // ========== 无限滚动加载 ==========
  function _setupScrollLoadMore() {
    if (!feedScrollEl) return;
    feedScrollEl.addEventListener("scroll", debounce(() => {
      if (!feedScrollEl || !hasMorePages || isLoadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = feedScrollEl;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMoreTopics();
      }
    }, 300));
  }

  // ========== 加载更多辅助 ==========
  function _showLoadMoreSpinner() {
    _removeLoadMore();
    const el = document.createElement("div");
    el.className = "sfp-load-more";
    el.innerHTML = `<span class="sfp-load-more-spinner"></span>加载中...`;
    if (feedListEl) feedListEl.appendChild(el);
  }

  function _removeLoadMore() {
    const el = feedListEl?.querySelector(".sfp-load-more");
    if (el) el.remove();
  }

  function _showNoMore() {
    _removeLoadMore();
    const existing = feedListEl?.querySelector(".sfp-no-more");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.className = "sfp-no-more";
    el.textContent = "— 已经到底了 —";
    if (feedListEl) feedListEl.appendChild(el);
  }

  // ========== RouteWatcher（轻量，仅感知路由，不重建 feed） ==========
  const RouteWatcher = (() => {
    let lastUrl = location.href;
    let observer = null;

    function start() {
      const origPush = history.pushState;
      history.pushState = function () {
        origPush.apply(this, arguments);
        _checkUrlChange();
      };

      const origReplace = history.replaceState;
      history.replaceState = function () {
        origReplace.apply(this, arguments);
        _checkUrlChange();
      };

      window.addEventListener("popstate", () => _checkUrlChange());

      observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
          _checkUrlChange();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    function _checkUrlChange() {
      const newUrl = location.href;
      if (newUrl !== lastUrl) {
        lastUrl = newUrl;
        if (feedModeEnabled && feedHeaderEl) {
          _updateShowMoreHint(feedHeaderEl);
        }
      }
    }

    function stop() {
      if (observer) observer.disconnect();
    }

    return { start, stop };
  })();

  // ========== 初始化 ==========
  function init() {
    injectStyles();

    waitForEmber(() => {
      createToggle();

      RouteWatcher.start();

      if (feedModeEnabled) {
        setTimeout(() => activateFeed(), 300);
      }
    });
  }

  init();
})();
