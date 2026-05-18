// ==UserScript==
// @name         Discourse Sidebar Feed Panel
// @namespace    https://linux.do/
// @version      0.6.18
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
  const HIDE_PINNED_KEY = "sfp_hide_pinned";
  const AUTO_SILENT_REFRESH_KEY = "sfp_auto_silent_refresh";
  const AUTO_REFRESH_ENABLED_KEY = "sfp_auto_refresh_enabled";
  const AUTO_REFRESH_INTERVAL_KEY = "sfp_auto_refresh_interval";

  // ========== 常量 ==========
  const DEFAULT_WIDTH = 272;
  const MIN_WIDTH = DEFAULT_WIDTH;
  const MAX_WIDTH = 500;
  const DEFAULT_AUTO_REFRESH_INTERVAL = 10;
  const AUTO_LOAD_RATE_WINDOW_MS = 5000;
  const AUTO_LOAD_MAX_REQUESTS_PER_WINDOW = 3;
  const AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS = 3;

  // ========== 全局状态 ==========
  let feedModeEnabled = GM_getValue(STATE_KEY, false);
  let currentOrder = GM_getValue(ORDER_KEY, "default");
  let currentPeriod = GM_getValue(PERIOD_KEY, "all");
  let sfpSidebarWidth = GM_getValue(WIDTH_KEY, DEFAULT_WIDTH);
  let currentTab = GM_getValue(TAB_KEY, "all");
  let currentFilter = GM_getValue(FILTER_KEY, "all");
  let hidePinned = GM_getValue(HIDE_PINNED_KEY, false);
  let autoSilentRefreshEnabled = GM_getValue(AUTO_SILENT_REFRESH_KEY, false);
  let autoRefreshEnabled = GM_getValue(AUTO_REFRESH_ENABLED_KEY, false);
  let autoRefreshInterval = Math.max(1, Number(GM_getValue(AUTO_REFRESH_INTERVAL_KEY, DEFAULT_AUTO_REFRESH_INTERVAL)) || DEFAULT_AUTO_REFRESH_INTERVAL);
  let currentCategoryId = null;

  let allTopics = [];
  let usersMap = {};
  let loadedTopicIds = new Set();
  let currentPage = 0;
  let hasMorePages = true;
  let isLoading = false;
  let isLoadingMore = false;
  let isRefreshing = false;
  let _pendingReload = false;
  let autoRefreshTimer = null;
  let autoRefreshSeconds = 0;
  let autoLoadTimestamps = [];
  let autoLoadEmptyFilterCount = 0;
  let autoLoadStoppedForSession = false;
  let autoLoadSessionKey = "";
  let trackingStateCallbackId = null;
  let incomingCountPollTimer = null;
  let lastKnownIncomingCount = 0;
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

  function getTopicTrackingState() {
    try {
      return Discourse.__container__?.lookup("service:topic-tracking-state") || null;
    } catch (e) {
      return null;
    }
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
        width: 28px;
        height: 28px;
        border: none;
        background: var(--primary-very-low, #f0f0f0);
        color: var(--primary-medium, #888);
        cursor: pointer;
        border-radius: 6px;
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
        color: #fff;
        background: var(--tertiary, #0088cc);
      }
      .sfp-toggle-btn svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }
      .home-logo-wrapper-outlet .title {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      /* ===== 侧边栏 Feed 模式 ===== */
      .sidebar-container.sfp-feed-mode {
        overflow-x: hidden !important;
      }
      /* 隐藏所有非 feed 的直接子元素 */
      .sidebar-container.sfp-feed-mode > :not(.sfp-feed-container):not(.sfp-resizer) {
        display: none !important;
      }
      /* 显式隐藏常见 sidebar 组件（嵌套情况兜底） */
      .sidebar-container.sfp-feed-mode .sidebar-sections,
      .sidebar-container.sfp-feed-mode .sidebar-footer-container,
      .sidebar-container.sfp-feed-mode .sidebar-footer-wrapper,
      .sidebar-container.sfp-feed-mode .sidebar-footer,
      .sidebar-container.sfp-feed-mode .sidebar-custom-sections,
      .sidebar-container.sfp-feed-mode .sidebar-section-wrapper,
      .sidebar-container.sfp-feed-mode .sidebar-section-header,
      .sidebar-container.sfp-feed-mode .sidebar-section-link-wrapper {
        display: none !important;
      }
      .sidebar-container.sfp-feed-mode .sfp-feed-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: visible;
        max-width: 100%;
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
        position: relative;
        flex-shrink: 0;
        padding: 8px 12px;
        border-bottom: 1px solid var(--primary-low, #e9e9e9);
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        overflow: visible;
      }
      .sfp-feed-header .sfp-header-spacer {
        flex: 1 1 auto;
        min-width: 8px;
      }
      .sfp-feed-header .sfp-refresh-btn,
      .sfp-feed-header .sfp-settings-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        background: var(--primary-very-low, #f0f0f0);
        color: var(--primary-medium, #888);
        cursor: pointer;
        border-radius: 6px;
        padding: 0;
        flex-shrink: 0;
        transition: color 0.2s, background 0.2s;
      }
      .sfp-feed-header .sfp-refresh-btn:hover,
      .sfp-feed-header .sfp-settings-btn:hover,
      .sfp-settings-wrap.open .sfp-settings-btn {
        color: var(--tertiary, #0088cc);
        background: var(--primary-low, #eee);
      }
      .sfp-feed-header .sfp-refresh-btn.spinning svg {
        animation: sfp-spin 0.6s linear infinite;
      }
      @keyframes sfp-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .sfp-feed-header .sfp-refresh-btn svg,
      .sfp-feed-header .sfp-settings-btn svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .sfp-settings-btn {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 2;
        gap: 3px;
        flex-direction: column;
      }
      .sfp-settings-line {
        width: 14px;
        height: 2px;
        border-radius: 2px;
        background: currentColor;
        transition: transform 0.28s ease, opacity 0.2s ease;
        transform-origin: center;
      }
      .sfp-settings-wrap.open .sfp-settings-line-1 {
        transform: translateY(5px) rotate(45deg);
      }
      .sfp-settings-wrap.open .sfp-settings-line-2 {
        opacity: 0;
        transform: scaleX(0);
      }
      .sfp-settings-wrap.open .sfp-settings-line-3 {
        transform: translateY(-5px) rotate(-45deg);
      }
      .sfp-show-more-overlay {
        position: absolute;
        top: 4px;
        left: 0;
        right: 0;
        z-index: 2;
        width: fit-content;
        max-width: calc(100% - 24px);
        margin: auto;
        padding: 0;
        font-size: 12px;
        pointer-events: none;
        animation: sfp-float-down 250ms ease-in-out;
      }
      .sfp-content-wrapper.sfp-has-show-more .sfp-topic-list {
        padding-top: 15px;
      }
      .sfp-show-more-overlay .sfp-hint-text {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        margin: 0;
        padding: 5px 11px;
        border: none;
        background-color: rgb(53, 34, 8);
        border-radius: 16px;
        color: var(--tertiary, #d3881f);
        cursor: pointer;
        font-size: inherit;
        line-height: 1.35;
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: auto;
        transition: background-color 0.2s, color 0.2s;
      }
      .sfp-show-more-overlay .sfp-hint-text:hover {
        background-color: rgb(63, 44, 18);
        color: var(--tertiary-hover, var(--tertiary-dark, #b8691a));
      }
      @keyframes sfp-float-down {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .sfp-settings-wrap {
        position: relative;
        width: 28px;
        height: 28px;
        flex-shrink: 0;
        overflow: visible;
      }
      .sfp-settings-shell {
        position: absolute;
        top: 0;
        right: 0;
        width: 28px;
        height: 28px;
        background: transparent;
        border: none;
        border-radius: 6px;
        box-shadow: none;
        z-index: 10003;
        overflow: hidden;
        transition: width 0.36s cubic-bezier(0.25, 1, 0.5, 1),
                    height 0.36s cubic-bezier(0.25, 1, 0.5, 1),
                    border-radius 0.24s ease,
                    background 0.2s ease;
      }
      .sfp-settings-wrap.open .sfp-settings-shell {
        width: 204px;
        height: 128px;
        background: var(--primary-very-low, #f0f0f0);
        border: 1px solid var(--primary-low, #e9e9e9);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.14);
      }
      .sfp-settings-panel {
        box-sizing: border-box;
        width: 204px;
        padding: 36px 10px 10px 10px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-8px);
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
      }
      .sfp-settings-wrap.open .sfp-settings-panel {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        pointer-events: auto;
        transition: opacity 0.26s ease 0.12s, transform 0.26s ease 0.12s, visibility 0.26s 0.12s;
      }
      .sfp-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
        color: var(--primary, #333);
        line-height: 1.3;
        padding: 4px 0;
      }
      .sfp-setting-row input[type="checkbox"] {
        flex-shrink: 0;
        margin: 0;
      }
      .sfp-setting-interval {
        display: none;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        font-size: 12px;
        color: var(--primary-medium, #777);
      }
      .sfp-setting-interval.visible {
        display: flex;
      }
      .sfp-setting-interval input {
        width: 58px;
        height: 26px;
        padding: 2px 6px;
        border: 1px solid var(--primary-low, #e9e9e9);
        border-radius: 4px;
        background: var(--secondary, #fff);
        color: var(--primary, #333);
        font-size: 12px;
      }

      /* ===== 自定义下拉 ===== */
      .sfp-custom-select {
        position: relative;
        flex-shrink: 0;
      }
      .sfp-custom-select-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        font-size: 12px;
        height: 28px;
        border: none;
        background: var(--primary-very-low, #f0f0f0);
        color: var(--primary, #333);
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        transition: background 0.2s, color 0.2s;
      }
      .sfp-custom-select-btn:hover {
        background: var(--primary-low, #eee);
      }
      .sfp-custom-select-btn::after {
        content: "";
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 5px solid currentColor;
      }
      .sfp-custom-select-dropdown {
        position: fixed;
        min-width: 100%;
        background: var(--secondary, #fff);
        border: 1px solid var(--primary-low, #e9e9e9);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 10002;
        display: none;
        overflow: hidden;
      }
      .sfp-custom-select.open .sfp-custom-select-dropdown {
        display: block;
      }
      .sfp-custom-select-option {
        display: block;
        width: 100%;
        padding: 6px 14px;
        font-size: 12px;
        border: none;
        background: none;
        color: var(--primary, #333);
        cursor: pointer;
        text-align: left;
        white-space: nowrap;
        transition: background 0.15s;
      }
      .sfp-custom-select-option:hover {
        background: var(--primary-very-low, #f5f5f5);
      }
      .sfp-custom-select-option.selected {
        color: var(--tertiary, #08c);
        font-weight: 600;
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
        position: relative;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
      }
      .sfp-content-wrapper {
        position: relative;
        min-height: 100%;
      }

      /* ===== 帖子列表项 ===== */
      .sfp-topic-item {
        padding: 12px 20px;
        border-bottom: 1px solid var(--primary-very-low, #f0f0f0);
        cursor: pointer;
        transition: background 0.2s;
        position: relative;
        overflow-wrap: break-word;
        word-break: break-word;
      }
      .sfp-topic-item:hover {
        background: var(--primary-very-low, #f8f8f8);
      }
      .sfp-topic-item.sfp-pinned {
        /* 只保留置顶 badge 标记，不加背景色 */
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
        font-weight: bold;
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
      .sfp-topic-item.sfp-read .sfp-topic-title {
        color: var(--title-color--read, var(--primary-medium, #8d8d8d));
      }
      .sfp-pinned-badge {
        font-size: 10px;
        color: var(--tertiary, #08c);
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 1px;
        margin-right: 4px;
        background: var(--tertiary-very-low, rgba(0,136,204,0.1));
        padding: 1px 5px;
        border-radius: 3px;
        vertical-align: middle;
        white-space: nowrap;
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
      .sfp-load-more-note {
        padding: 10px 10px 0;
        text-align: center;
        font-size: 12px;
        color: var(--primary-medium, #888);
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
    toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="18" rx="1" fill="currentColor" opacity="0.6"/><rect x="13" y="3" width="8" height="18" rx="1" fill="currentColor"/></svg>`;

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
  function getMinSidebarWidth() {
    return MIN_WIDTH;
  }

  function applySidebarWidth(width) {
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(getMinSidebarWidth(), width));
    sfpSidebarWidth = clampedWidth;
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (sidebar) {
      sidebar.style.setProperty("width", clampedWidth + "px", "important");
    }
    document.documentElement.style.setProperty("--d-sidebar-width", clampedWidth + "px");
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
        const newWidth = Math.min(MAX_WIDTH, Math.max(getMinSidebarWidth(), startWidth + delta));
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

    if (feedContainer && sidebar.contains(feedContainer)) {
      sidebar.classList.add("sfp-feed-mode");
      applySidebarWidth(sfpSidebarWidth);
      setupResizer();
      _syncIncomingCountPollForView();
      _updateShowMoreHint();
      return;
    }

    if (feedContainer) {
      feedContainer.remove();
      feedContainer = null;
      feedHeaderEl = null;
      feedScrollEl = null;
      feedListEl = null;
    }

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

    // 创建内容包装器，用于相对定位
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "sfp-content-wrapper";

    feedListEl = document.createElement("div");
    feedListEl.className = "sfp-topic-list";

    contentWrapper.appendChild(feedListEl);
    feedScrollEl.appendChild(contentWrapper);
    feedContainer.appendChild(feedScrollEl);
    sidebar.appendChild(feedContainer);

    sidebar.classList.add("sfp-feed-mode");

    // 恢复当前 tab 筛选的分类
    _restoreTabState();
    _startNativeIncomingTracking();

    // 始终全量加载，数据已在 deactivateFeed 中清除
    loadTopics();

    // 无限滚动
    _setupScrollLoadMore();
  }

  function deactivateFeed() {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (!sidebar) return;

    _stopAutoRefresh();
    _stopNativeIncomingTracking();

    if (feedContainer) {
      feedContainer.remove();
      feedContainer = null;
      feedHeaderEl = null;
      feedScrollEl = null;
      feedListEl = null;
    }

    // 清除数据缓存，避免下次激活时显示旧数据
    allTopics = [];
    usersMap = {};
    loadedTopicIds.clear();
    currentPage = 0;
    hasMorePages = true;
    _resetAutoLoadState();

    sidebar.classList.remove("sfp-feed-mode");
  }

  // ========== Header 控件 ==========
  function _buildHeaderControls(header) {
    // Order 自定义下拉
    const orderOptions = [
      { label: "默认", value: "default" },
      { label: "最新活动", value: "activity" },
      { label: "最新发布", value: "created" },
      { label: "最多浏览", value: "views" },
      { label: "最多回复", value: "posts" },
      { label: "最多点赞", value: "likes" },
      { label: "楼主点赞", value: "op_likes" },
    ];

    const periodOptions = [
      { label: "全部", value: "all" },
      { label: "每日", value: "daily" },
      { label: "每周", value: "weekly" },
      { label: "每月", value: "monthly" },
      { label: "每季", value: "quarterly" },
      { label: "每年", value: "yearly" },
    ];

    // Period 下拉（先创建，因为 order 切换时需要引用）
    const periodSelect = _buildCustomSelect(periodOptions, currentPeriod, (value) => {
      currentPeriod = value;
      GM_setValue(PERIOD_KEY, currentPeriod);
      _resetAutoLoadState();
      loadTopics();
    });
    periodSelect.classList.add("sfp-period-select");
    _updatePeriodVisibility(periodSelect);

    // Order 下拉
    const orderSelect = _buildCustomSelect(orderOptions, currentOrder, (value) => {
      currentOrder = value;
      GM_setValue(ORDER_KEY, currentOrder);
      _updatePeriodVisibility(periodSelect);
      _syncIncomingCountPollForView();
      _resetAutoLoadState();
      loadTopics();
    });
    orderSelect.classList.add("sfp-order-select");

    function _updatePeriodVisibility(ps) {
      ps.style.display = _needsPeriodForUrl(currentOrder) ? "" : "none";
    }

    header.appendChild(orderSelect);
    header.appendChild(periodSelect);

    const spacer = document.createElement("span");
    spacer.className = "sfp-header-spacer";
    header.appendChild(spacer);

    header.appendChild(_buildSettingsControl());

    // 刷新按钮
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "sfp-refresh-btn";
    refreshBtn.title = "刷新";
    refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
    refreshBtn.addEventListener("click", () => {
      refreshBtn.classList.add("spinning");
      refreshCurrentView().finally(() => refreshBtn.classList.remove("spinning"));
    });
    header.appendChild(refreshBtn);
  }

  function _buildSettingsControl() {
    const wrapper = document.createElement("span");
    wrapper.className = "sfp-settings-wrap";

    const shell = document.createElement("span");
    shell.className = "sfp-settings-shell";

    const btn = document.createElement("button");
    btn.className = "sfp-settings-btn";
    btn.type = "button";
    btn.title = "设置";
    btn.innerHTML = `
      <span class="sfp-settings-line sfp-settings-line-1"></span>
      <span class="sfp-settings-line sfp-settings-line-2"></span>
      <span class="sfp-settings-line sfp-settings-line-3"></span>
    `;

    const panel = document.createElement("div");
    panel.className = "sfp-settings-panel";
    panel.innerHTML = `
      <label class="sfp-setting-row">
        <span>自动静默刷新</span>
        <input type="checkbox" class="sfp-auto-silent-input"${autoSilentRefreshEnabled ? " checked" : ""}>
      </label>
      <label class="sfp-setting-row">
        <span>自动刷新</span>
        <input type="checkbox" class="sfp-auto-refresh-input"${autoRefreshEnabled ? " checked" : ""}>
      </label>
      <label class="sfp-setting-interval${autoRefreshEnabled ? " visible" : ""}">
        <span>自动刷新间隔</span>
        <input type="number" class="sfp-auto-refresh-interval-input" min="1" step="1" value="${autoRefreshInterval}">
        <span>s</span>
      </label>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll(".sfp-settings-wrap.open").forEach((el) => {
        if (el !== wrapper) el.classList.remove("open");
      });
      wrapper.classList.toggle("open");
    });

    panel.addEventListener("click", (e) => e.stopPropagation());

    const autoSilentInput = panel.querySelector(".sfp-auto-silent-input");
    autoSilentInput.addEventListener("change", () => {
      autoSilentRefreshEnabled = autoSilentInput.checked;
      GM_setValue(AUTO_SILENT_REFRESH_KEY, autoSilentRefreshEnabled);
      const trackingState = getTopicTrackingState();
      if (autoSilentRefreshEnabled && (trackingState?.incomingCount || 0) > 0) {
        _applyNativeIncomingTopics({ requireDefaultView: true, logPrefix: "enable auto silent refresh" });
      }
    });

    const autoRefreshInput = panel.querySelector(".sfp-auto-refresh-input");
    const intervalRow = panel.querySelector(".sfp-setting-interval");
    const intervalInput = panel.querySelector(".sfp-auto-refresh-interval-input");
    autoRefreshInput.addEventListener("change", () => {
      autoRefreshEnabled = autoRefreshInput.checked;
      GM_setValue(AUTO_REFRESH_ENABLED_KEY, autoRefreshEnabled);
      intervalRow.classList.toggle("visible", autoRefreshEnabled);
      _startAutoRefresh();
    });

    intervalInput.addEventListener("change", () => {
      const seconds = Math.max(1, Number(intervalInput.value) || DEFAULT_AUTO_REFRESH_INTERVAL);
      autoRefreshInterval = seconds;
      intervalInput.value = seconds;
      GM_setValue(AUTO_REFRESH_INTERVAL_KEY, autoRefreshInterval);
      _startAutoRefresh();
    });

    shell.appendChild(btn);
    shell.appendChild(panel);
    wrapper.appendChild(shell);
    return wrapper;
  }

  // ========== 自定义下拉组件 ==========
  function _buildCustomSelect(options, selectedValue, onChange) {
    const wrapper = document.createElement("span");
    wrapper.className = "sfp-custom-select";

    const btn = document.createElement("button");
    btn.className = "sfp-custom-select-btn";
    btn.type = "button";
    const selected = options.find((o) => o.value === selectedValue) || options[0];
    btn.textContent = selected.label;

    const dropdown = document.createElement("div");
    dropdown.className = "sfp-custom-select-dropdown";

    let _currentSelected = selectedValue;

    options.forEach((opt) => {
      const item = document.createElement("button");
      item.className = "sfp-custom-select-option" + (opt.value === selectedValue ? " selected" : "");
      item.type = "button";
      item.textContent = opt.label;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (opt.value === _currentSelected) {
          wrapper.classList.remove("open");
          return;
        }
        btn.textContent = opt.label;
        dropdown.querySelectorAll(".sfp-custom-select-option").forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
        wrapper.classList.remove("open");
        _currentSelected = opt.value;
        onChange(opt.value);
      });
      dropdown.appendChild(item);
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // 关闭其他打开的下拉
      document.querySelectorAll(".sfp-custom-select.open").forEach((el) => {
        if (el !== wrapper) el.classList.remove("open");
      });
      const isOpen = wrapper.classList.toggle("open");
      if (isOpen) {
        const btnRect = btn.getBoundingClientRect();
        dropdown.style.top = (btnRect.bottom + 4) + "px";
        dropdown.style.left = btnRect.left + "px";
        dropdown.style.minWidth = btnRect.width + "px";
      }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    return wrapper;
  }

  // 点击页面其他地方关闭下拉
  document.addEventListener("click", () => {
    document.querySelectorAll(".sfp-custom-select.open").forEach((el) => el.classList.remove("open"));
    document.querySelectorAll(".sfp-settings-wrap.open").forEach((el) => el.classList.remove("open"));
  });

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

    // 事件代理 — 点击切换
    bar.addEventListener("click", (e) => {
      const tab = e.target.closest(".sfp-tab-item");
      if (!tab) return;

      const tabId = tab.dataset.tab;
      const catId = tab.dataset.categoryId ? Number(tab.dataset.categoryId) : null;
      if (tabId === currentTab && catId === currentCategoryId) return;

      currentTab = tabId;
      currentCategoryId = catId;
      GM_setValue(TAB_KEY, currentTab);
      _syncIncomingCountPollForView();
      _resetAutoLoadState();

      bar.querySelectorAll(".sfp-tab-item").forEach((t) => {
        t.classList.remove("active");
      });
      tab.classList.add("active");

      loadTopics();
    });

    // 滚轮横向滚动
    bar.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        bar.scrollLeft += e.deltaY;
      }
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

    // 分隔
    const sep = document.createElement("span");
    sep.style.cssText = "color:var(--primary-low,#ddd);margin:0 2px;";
    sep.textContent = "|";
    bar.appendChild(sep);

    // 隐藏置顶开关
    const pinnedToggle = document.createElement("span");
    pinnedToggle.className = "sfp-filter-item" + (hidePinned ? " active" : "");
    pinnedToggle.dataset.filter = "hide-pinned";
    pinnedToggle.textContent = "隐藏置顶";
    bar.appendChild(pinnedToggle);

    bar.addEventListener("click", (e) => {
      const item = e.target.closest(".sfp-filter-item");
      if (!item) return;

      const filterVal = item.dataset.filter;
      if (filterVal === "hide-pinned") {
        hidePinned = !hidePinned;
        GM_setValue(HIDE_PINNED_KEY, hidePinned);
        item.classList.toggle("active", hidePinned);
        _resetAutoLoadState();
        renderTopics();
        return;
      } else {
        if (filterVal === currentFilter) return;
        currentFilter = filterVal;
        GM_setValue(FILTER_KEY, currentFilter);
        _syncIncomingCountPollForView();
        _resetAutoLoadState();
        bar.querySelectorAll(".sfp-filter-item[data-filter]:not([data-filter=\"hide-pinned\"])").forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        renderTopics();
      }
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

  function _updateShowMoreHint() {
    if (!feedScrollEl) return;

    const contentWrapper = feedScrollEl.querySelector(".sfp-content-wrapper");
    if (!contentWrapper) return;

    // 只在默认模式（全部板块 + 默认排序 + 全部筛选）时刷新提示
    if (currentTab !== "all" || currentOrder !== "default" || currentFilter !== "all") {
      // 非默认模式移除已有提示
      const existing = contentWrapper.querySelector(".sfp-show-more-overlay");
      if (existing) existing.remove();
      contentWrapper.classList.remove("sfp-has-show-more");
      return;
    }

    const existing = contentWrapper.querySelector(".sfp-show-more-overlay");
    const trackingState = getTopicTrackingState();
    const newCount = trackingState?.incomingCount || 0;
    if (newCount <= 0) {
      if (existing) existing.remove();
      contentWrapper.classList.remove("sfp-has-show-more");
      return;
    }

    const overlay = existing || document.createElement("div");
    overlay.className = "sfp-show-more-overlay";

    let hint = overlay.querySelector(".sfp-hint-text");
    if (!hint) {
      hint = document.createElement("a");
      hint.className = "sfp-hint-text";
      hint.href = "#";
      hint.addEventListener("click", (e) => {
        e.preventDefault();
        _applyNativeIncomingTopics({ logPrefix: "show more" });
      });
      overlay.appendChild(hint);
    }

    hint.textContent = `查看 ${newCount} 个新的或更新的话题`;
    contentWrapper.classList.add("sfp-has-show-more");
    if (!existing) {
      contentWrapper.insertBefore(overlay, contentWrapper.firstChild);
    }
  }

  function _startNativeIncomingTracking() {
    const trackingState = getTopicTrackingState();
    if (!trackingState) return;

    if (trackingStateCallbackId) {
      trackingState.offStateChange?.(trackingStateCallbackId);
      trackingStateCallbackId = null;
    }

    trackingState.trackIncoming?.("latest");
    trackingStateCallbackId = trackingState.onStateChange?.(() => {
      _updateShowMoreHint();
      if (autoSilentRefreshEnabled && _isDefaultFeedView() && (trackingState.incomingCount || 0) > 0) {
        _applyNativeIncomingTopics({ requireDefaultView: true, logPrefix: "native push" });
      }
    });

    // 初始化已知计数
    lastKnownIncomingCount = trackingState.incomingCount || 0;

    // 只在默认视图启动轮询，避免分类、排序、筛选视图空跑。
    _syncIncomingCountPollForView();

    // 延迟初始更新，让 trackIncoming 有时间处理
    setTimeout(() => _syncIncomingCountPollForView(), 100);
  }

  function _syncIncomingCountPollForView() {
    if (!feedModeEnabled || !_isDefaultFeedView()) {
      _stopIncomingCountPoll();
      _updateShowMoreHint();
      return;
    }

    if (!incomingCountPollTimer) {
      _startIncomingCountPoll();
    }
    _updateShowMoreHint();
  }

  function _startIncomingCountPoll() {
    _stopIncomingCountPoll();

    const trackingState = getTopicTrackingState();
    if (!trackingState) return;

    // 记录初始 messageCount，用于检测状态变化
    let lastMessageCount = trackingState.messageCount || 0;

    incomingCountPollTimer = setInterval(() => {
      if (!trackingState || !feedModeEnabled) return;
      if (!_isDefaultFeedView()) {
        _stopIncomingCountPoll();
        return;
      }

      const currentMessageCount = trackingState.messageCount || 0;
      const currentIncomingCount = trackingState.incomingCount || 0;

      // 检查 messageCount 或 incomingCount 是否变化
      if (currentMessageCount !== lastMessageCount || currentIncomingCount !== lastKnownIncomingCount) {
        lastMessageCount = currentMessageCount;
        lastKnownIncomingCount = currentIncomingCount;
        _updateShowMoreHint();
      }
    }, 1000);
  }

  function _stopIncomingCountPoll() {
    if (incomingCountPollTimer) {
      clearInterval(incomingCountPollTimer);
      incomingCountPollTimer = null;
    }
  }

  function _stopNativeIncomingTracking() {
    const trackingState = getTopicTrackingState();
    if (trackingStateCallbackId && trackingState?.offStateChange) {
      trackingState.offStateChange(trackingStateCallbackId);
    }
    trackingStateCallbackId = null;
    _stopIncomingCountPoll();
  }

  function _isDefaultFeedView() {
    return currentTab === "all" && currentOrder === "default" && currentFilter === "all";
  }

  function _getAutoLoadSessionKey() {
    return [
      currentTab,
      currentCategoryId || "",
      currentOrder,
      currentPeriod,
      currentFilter,
      hidePinned ? "hide-pinned" : "show-pinned",
    ].join("|");
  }

  function _resetAutoLoadState() {
    autoLoadTimestamps = [];
    autoLoadEmptyFilterCount = 0;
    autoLoadStoppedForSession = false;
    autoLoadSessionKey = _getAutoLoadSessionKey();
  }

  function _ensureAutoLoadSession() {
    const nextKey = _getAutoLoadSessionKey();
    if (nextKey !== autoLoadSessionKey) {
      _resetAutoLoadState();
    }
  }

  function _canRunAutoLoad() {
    _ensureAutoLoadSession();
    if (autoLoadStoppedForSession) return false;

    const now = Date.now();
    autoLoadTimestamps = autoLoadTimestamps.filter((ts) => now - ts < AUTO_LOAD_RATE_WINDOW_MS);
    return autoLoadTimestamps.length < AUTO_LOAD_MAX_REQUESTS_PER_WINDOW;
  }

  function _recordAutoLoadRequest() {
    _ensureAutoLoadSession();
    autoLoadTimestamps.push(Date.now());
  }

  function _recordAutoLoadFilterResult(filteredNewCount) {
    _ensureAutoLoadSession();
    if (filteredNewCount > 0) {
      autoLoadEmptyFilterCount = 0;
      return;
    }

    autoLoadEmptyFilterCount++;
    if (autoLoadEmptyFilterCount >= AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS) {
      autoLoadStoppedForSession = true;
    }
  }

  // ========== 数据加载 ==========
  async function fetchFeedTopics(order, period, page) {
    let url;
    const effectiveOrder = order === "default" ? "activity" : order;

    if (currentTab !== "all" && currentCategoryId) {
      const cat = CATEGORY_CONFIG[currentCategoryId];
      const tabId = cat?.tabId || currentTab;
      const params = [];
      params.push(`page=${page}`);
      params.push(`order=${encodeURIComponent(effectiveOrder)}`);
      if (period !== "all" && _needsPeriodForUrl(order)) {
        params.push(`period=${encodeURIComponent(period)}`);
      }
      url = `/c/${tabId}/${currentCategoryId}/l/latest.json?${params.join("&")}`;
    } else {
      url = "/latest.json?";
      const params = [];
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

  async function fetchFeedTopicsByIds(topicIds) {
    const ids = Array.from(new Set(topicIds.map((id) => Number(id)).filter(Number.isFinite)));
    if (ids.length === 0) return null;

    const csrfToken = getCsrfToken();
    const headers = { "X-CSRF-Token": csrfToken };
    const resp = await fetch(`/latest.json?topic_ids=${ids.join(",")}`, { headers });
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }

  function _needsPeriodForUrl(order) {
    return ["views", "posts", "likes", "op_likes"].includes(order);
  }

  async function loadTopics() {
    if (isLoading) {
      _pendingReload = true;
      return;
    }
    isLoading = true;
    _pendingReload = false;

    currentPage = 0;
    hasMorePages = true;
    allTopics = [];
    loadedTopicIds.clear();
    _updateShowMoreHint();
    _resetAutoLoadState();

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
        const topicIdSet = new Set(topics.map((topic) => topic.id));
        const nativeIncomingTopicIds = Array.from(getTopicTrackingState()?.newIncoming || []);
        _clearNativeIncoming(nativeIncomingTopicIds.filter((id) => topicIdSet.has(Number(id))));
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
      if (_pendingReload) {
        _pendingReload = false;
        loadTopics();
      }
    }
  }

  async function loadMoreTopics({ source = "manual" } = {}) {
    if (isLoadingMore || !hasMorePages) return;
    const isAutoLoad = source === "auto";
    if (isAutoLoad && !_canRunAutoLoad()) return;

    isLoadingMore = true;
    currentPage++;
    if (isAutoLoad) _recordAutoLoadRequest();

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
          // 增量追加，应用当前筛选，保留滚动位置
          const filteredNew = _applyFilter(newTopics);
          filteredNew.forEach((topic) => {
            const item = createTopicItem(topic);
            feedListEl.appendChild(item);
          });

          if (isAutoLoad) _recordAutoLoadFilterResult(filteredNew.length);
          _renderPaginationFooter({
            note: !isAutoLoad && filteredNew.length === 0 ? "下一页无符合条件的话题" : "",
          });
        }
      } else {
        hasMorePages = false;
        _showNoMore();
      }
    } catch (e) {
      console.error("[SFP] loadMoreTopics error:", e);
      _renderPaginationFooter();
    } finally {
      isLoadingMore = false;
    }
  }

  function _processUsers(data) {
    if (data?.users) {
      data.users.forEach((u) => { usersMap[u.id] = u; });
    }
  }

  async function refreshCurrentView() {
    return _refreshCurrentView({ logPrefix: "manual refresh" });
  }

  async function _refreshCurrentView({ requireDefaultView = false, logPrefix = "refresh" } = {}) {
    if (isLoading || isLoadingMore || isRefreshing) return;
    if (requireDefaultView && (currentOrder !== "default" || currentTab !== "all" || currentFilter !== "all")) return;
    if (!feedListEl) return;

    isRefreshing = true;
    try {
      const nativeIncomingTopicIds = Array.from(getTopicTrackingState()?.newIncoming || []);
      const data = await fetchFeedTopics(currentOrder, currentPeriod, 0);
      _processUsers(data);

      if (!data?.topic_list?.topics) return;

      const freshTopics = data.topic_list.topics;
      const freshMap = new Map(freshTopics.map((t) => [t.id, t]));
      const newTopicIds = freshTopics
        .filter((topic) => !loadedTopicIds.has(topic.id))
        .map((topic) => topic.id);

      freshTopics.forEach((topic) => loadedTopicIds.add(topic.id));

      const existingTail = allTopics.filter((topic) => !freshMap.has(topic.id));
      allTopics = freshTopics.concat(existingTail);
      hasMorePages = freshTopics.length > 0;

      renderTopics(newTopicIds);
      _clearNativeIncoming(nativeIncomingTopicIds.filter((id) => freshMap.has(Number(id))));

      _updateShowMoreHint();
    } catch (e) {
      console.warn(`[SFP] ${logPrefix} error:`, e);
    } finally {
      isRefreshing = false;
      _resetAutoRefreshCountdown();
    }
  }

  // ========== 静默刷新 ==========
  // 仅在纯默认视图（全部板块 + 默认排序 + 全部筛选）时启用
  async function _silentRefresh() {
    if (autoSilentRefreshEnabled) {
      return _applyNativeIncomingTopics({ requireDefaultView: true, logPrefix: "silent refresh" });
    }

    _updateShowMoreHint();
  }

  async function _applyNativeIncomingTopics({ requireDefaultView = false, logPrefix = "incoming" } = {}) {
    if (isLoading || isLoadingMore || isRefreshing) return;
    if (requireDefaultView && !_isDefaultFeedView()) return;
    if (!feedListEl) return;

    const trackingState = getTopicTrackingState();
    const incomingTopicIds = Array.from(trackingState?.newIncoming || []);
    if (incomingTopicIds.length === 0) {
      _updateShowMoreHint();
      return;
    }

    isRefreshing = true;
    try {
      const data = await fetchFeedTopicsByIds(incomingTopicIds);
      if (!data?.topic_list?.topics) return;
      _processUsers(data);

      const incomingTopics = data.topic_list.topics;
      const incomingMap = new Map(incomingTopics.map((topic) => [topic.id, topic]));
      const incomingIdSet = new Set(incomingTopics.map((topic) => topic.id));

      incomingTopics.forEach((topic) => loadedTopicIds.add(topic.id));
      allTopics = incomingTopics.concat(allTopics.filter((topic) => !incomingMap.has(topic.id)));
      hasMorePages = hasMorePages || incomingTopics.length > 0;

      renderTopics(Array.from(incomingIdSet));
      _clearNativeIncoming(incomingTopicIds);
      _updateShowMoreHint();
    } catch (e) {
      console.warn(`[SFP] ${logPrefix} error:`, e);
    } finally {
      isRefreshing = false;
    }
  }

  function _clearNativeIncoming(topicIds) {
    const trackingState = getTopicTrackingState();
    if (topicIds?.length > 0 && trackingState?.clearIncoming) {
      trackingState.clearIncoming(topicIds);
    }
  }

  // ========== 自动刷新 ==========
  function _startAutoRefresh() {
    _stopAutoRefresh();
    if (!autoRefreshEnabled) return;

    _resetAutoRefreshCountdown();
    autoRefreshTimer = setInterval(() => {
      autoRefreshSeconds--;
      if (autoRefreshSeconds <= 0) {
        _resetAutoRefreshCountdown();
        if (feedModeEnabled && !isLoading && !isLoadingMore) {
          _refreshCurrentView({ logPrefix: "auto refresh" });
        }
      }
    }, 1000);
  }

  function _resetAutoRefreshCountdown() {
    if (autoRefreshEnabled) {
      autoRefreshSeconds = autoRefreshInterval;
    }
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
    let filtered = _applyFilter(allTopics);

    _sortTopicsForCurrentView(filtered);

    if (filtered.length === 0) {
      // 构建更精确的空状态消息
      let emptyMsg = "无匹配话题";
      if (currentFilter === "unseen") {
        emptyMsg = currentTab !== "all" ? "该板块暂无未读话题" : "暂无未读话题";
      } else if (currentFilter === "read") {
        emptyMsg = "暂无已读话题";
      }

      // 有数据但筛选后为空 → 显示当前页提示，分页控件由底部统一渲染
      if (hasMorePages && !isLoadingMore) {
        feedListEl.innerHTML = `<div class="sfp-empty">当前页${emptyMsg}</div>`;
      } else {
        feedListEl.innerHTML = `<div class="sfp-empty">${emptyMsg}</div>`;
      }
    } else {
      filtered.forEach((topic) => {
        const item = createTopicItem(topic, newTopicIds.includes(topic.id));
        feedListEl.appendChild(item);
      });
    }

    _renderPaginationFooter();
  }

  function _sortTopicsForCurrentView(topics) {
    topics.sort((a, b) => {
      const aPinned = (a.pinned || a.pinned_globally) ? 1 : 0;
      const bPinned = (b.pinned || b.pinned_globally) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (currentOrder === "created") {
        return _topicTimeValue(b.created_at) - _topicTimeValue(a.created_at);
      }

      if (currentOrder === "default" || currentOrder === "activity") {
        const aTime = a.bumped_at || a.last_posted_at || a.created_at;
        const bTime = b.bumped_at || b.last_posted_at || b.created_at;
        return _topicTimeValue(bTime) - _topicTimeValue(aTime);
      }

      return 0;
    });
  }

  function _topicTimeValue(value) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
  }

  // ========== 客户端筛选 ==========
  function _topicBaseUrl(topic) {
    const slug = topic.slug || "topic";
    return `/t/${slug}/${topic.id}`;
  }

  function _hasLastReadPostNumber(topic) {
    return topic.last_read_post_number !== null &&
      topic.last_read_post_number !== undefined &&
      topic.last_read_post_number !== "";
  }

  function _topicListUrl(topic) {
    const baseUrl = _topicBaseUrl(topic);
    if (!_hasLastReadPostNumber(topic)) return baseUrl;

    const lastRead = Number(topic.last_read_post_number);
    const highest = Number(topic.highest_post_number);
    if (!Number.isFinite(lastRead)) return baseUrl;

    let postNumber = lastRead + 1;
    if (Number.isFinite(highest) && postNumber > highest) {
      postNumber = highest;
    }
    if (postNumber < 1) postNumber = 1;
    return `${baseUrl}/${postNumber}`;
  }

  function _topicListUrlHasPostNumber(topic) {
    return new RegExp(`/t/[^/]+/${topic.id}/\\d+(?:$|[/?#])`).test(_topicListUrl(topic));
  }

  // 已读 = 首页标题链接带楼层号；未读 = 首页标题链接不带楼层号。
  function _isTopicRead(topic) {
    return _topicListUrlHasPostNumber(topic);
  }

  function _hasUnreadMarker(topic) {
    return !_isTopicRead(topic);
  }

  // 未读 = 首页标题链接不带楼层号；已读 = 首页标题链接带楼层号
  function _applyFilter(topics) {
    let result = topics;
    if (hidePinned) {
      result = result.filter((t) => !t.pinned && !t.pinned_globally);
    }
    if (currentFilter === "unseen") {
      result = result.filter((t) => _hasUnreadMarker(t));
    }
    if (currentFilter === "read") {
      result = result.filter((t) => !_hasUnreadMarker(t));
    }
    return result;
  }

  // ========== 筛选结果稀疏时自动加载 ==========
  function _checkAutoLoadOnSparseFilter() {
    const filtered = _applyFilter(allTopics);
    if (filtered.length < 10 && hasMorePages && !isLoadingMore && !isLoading) {
      loadMoreTopics({ source: "auto" });
    }
  }

  // ========== 创建帖子项 ==========
  function createTopicItem(topic, isNew = false) {
    const item = document.createElement("div");
    item.className = "sfp-topic-item";
    item.dataset.topicId = topic.id;
    if (topic.pinned || topic.pinned_globally) {
      item.classList.add("sfp-pinned");
    }
    if (_isTopicRead(topic)) {
      item.classList.add("sfp-read");
    }
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

    // 未读圆点（首页标题链接不带楼层号的主题）
    const unseenDot = _hasUnreadMarker(topic) ? '<span class="sfp-unseen-dot"></span>' : "";

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

    // 置顶标记
    const pinnedHtml = (topic.pinned || topic.pinned_globally)
      ? `<span class="sfp-pinned-badge" title="${topic.pinned_globally ? '全局置顶' : '板块置顶'}">📌置顶</span>`
      : "";

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
      <div class="sfp-topic-title">${pinnedHtml}${escapeHtml(topic.unicode_title || topic.title)}${closedHtml}</div>
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
      const targetUrl = _topicListUrl(topic);
      markTopicAsRead(topic, item);
      navigateTo(targetUrl);
    });

    // 中键新标签页
    item.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
    item.addEventListener("mouseup", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        const targetUrl = _topicListUrl(topic);
        markTopicAsRead(topic, item);
        window.open(`https://linux.do${targetUrl}`, "_blank");
      }
    });

    return item;
  }

  // ========== 标记帖子为已读 ==========
  function markTopicAsRead(topic, itemElement) {
    if (!_hasUnreadMarker(topic)) return;
    topic.unread_posts = 0;
    topic.new_posts = 0;
    topic.unseen = false;
    topic.is_seen = true;
    if (topic.highest_post_number) {
      topic.last_read_post_number = topic.highest_post_number;
    }
    const existing = allTopics.find((t) => t.id === topic.id);
    if (existing) {
      existing.unread_posts = 0;
      existing.new_posts = 0;
      existing.unseen = false;
      existing.is_seen = true;
      if (existing.highest_post_number) {
        existing.last_read_post_number = existing.highest_post_number;
      }
    }
    itemElement.classList.add("sfp-read");
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
        loadMoreTopics({ source: "auto" });
      }
    }, 300));
  }

  // ========== 加载更多辅助 ==========
  function _renderPaginationFooter({ note = "" } = {}) {
    if (!feedListEl) return;
    _removePaginationFooter();

    if (note) {
      const noteEl = document.createElement("div");
      noteEl.className = "sfp-load-more-note";
      noteEl.textContent = note;
      feedListEl.appendChild(noteEl);
    }

    if (hasMorePages) {
      const loadMoreEl = document.createElement("div");
      loadMoreEl.className = "sfp-load-more";
      loadMoreEl.textContent = "加载更多";
      loadMoreEl.addEventListener("click", () => {
        loadMoreEl.remove();
        loadMoreTopics({ source: "manual" });
      });
      feedListEl.appendChild(loadMoreEl);
      return;
    }

    const noMoreEl = document.createElement("div");
    noMoreEl.className = "sfp-no-more";
    noMoreEl.textContent = "— 已经到底了 —";
    feedListEl.appendChild(noMoreEl);
  }

  function _showLoadMoreSpinner() {
    _removePaginationFooter();
    const el = document.createElement("div");
    el.className = "sfp-load-more";
    el.innerHTML = `<span class="sfp-load-more-spinner"></span>加载中...`;
    if (feedListEl) feedListEl.appendChild(el);
  }

  function _removePaginationFooter() {
    feedListEl?.querySelectorAll(".sfp-load-more, .sfp-no-more, .sfp-load-more-note").forEach((el) => el.remove());
  }

  function _showNoMore() {
    _removePaginationFooter();
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

        if (feedModeEnabled) {
          const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
          if (sidebar && (!feedContainer || !sidebar.contains(feedContainer) || !sidebar.classList.contains("sfp-feed-mode"))) {
            activateFeed();
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    function _checkUrlChange() {
      const newUrl = location.href;
      if (newUrl !== lastUrl) {
        lastUrl = newUrl;
        if (feedModeEnabled) {
          _updateShowMoreHint();
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
      // 始终应用保存的宽度，避免切换 feed 模式时宽度跳动
      applySidebarWidth(sfpSidebarWidth);
      setupResizer();

      createToggle();

      RouteWatcher.start();

      if (feedModeEnabled) {
        setTimeout(() => activateFeed(), 300);
      }
    });
  }

  init();
})();
