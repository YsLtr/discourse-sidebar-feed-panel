// ==UserScript==
// @name         Discourse Sidebar Feed Panel
// @namespace    https://linux.do/
// @version      0.6.43
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
  const TAB_ORDER_KEY = "sfp_tab_order";
  const FILTER_KEY = "sfp_current_filter";
  const HIDE_PINNED_KEY = "sfp_hide_pinned";
  const AUTO_SILENT_REFRESH_KEY = "sfp_auto_silent_refresh";
  const AUTO_SILENT_REFRESH_INTERVAL_KEY = "sfp_auto_silent_refresh_interval";
  const AUTO_REFRESH_ENABLED_KEY = "sfp_auto_refresh_enabled";
  const AUTO_REFRESH_INTERVAL_KEY = "sfp_auto_refresh_interval";
  const TAG_STYLE_CACHE_KEY = "sfp_tag_style_cache_v1";

  // ========== 常量 ==========
  const DEFAULT_WIDTH = 272;
  const MIN_WIDTH = DEFAULT_WIDTH;
  const MAX_WIDTH = 500;
  const DEFAULT_AUTO_SILENT_REFRESH_INTERVAL = 0;
  const DEFAULT_AUTO_REFRESH_INTERVAL = 10;
  const AUTO_LOAD_RATE_WINDOW_MS = 5000;
  const AUTO_LOAD_MAX_REQUESTS_PER_WINDOW = 3;
  const AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS = 3;
  const MAX_INCOMING_TOPIC_IDS_DIRECT_APPLY = 100;
  const TAG_STYLE_CACHE_VERSION = 1;

  // ========== 全局状态 ==========
  let feedModeEnabled = GM_getValue(STATE_KEY, false);
  let currentOrder = GM_getValue(ORDER_KEY, "activity");
  if (currentOrder === "default") {
    currentOrder = "activity";
    GM_setValue(ORDER_KEY, currentOrder);
  }
  let currentPeriod = GM_getValue(PERIOD_KEY, "all");
  let sfpSidebarWidth = GM_getValue(WIDTH_KEY, DEFAULT_WIDTH);
  let currentTab = GM_getValue(TAB_KEY, "all");
  let currentFilter = GM_getValue(FILTER_KEY, "all");
  let hidePinned = GM_getValue(HIDE_PINNED_KEY, false);
  let autoSilentRefreshEnabled = GM_getValue(AUTO_SILENT_REFRESH_KEY, false);
  let autoSilentRefreshInterval = Math.max(0, Number(GM_getValue(AUTO_SILENT_REFRESH_INTERVAL_KEY, DEFAULT_AUTO_SILENT_REFRESH_INTERVAL)) || DEFAULT_AUTO_SILENT_REFRESH_INTERVAL);
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
  let autoSilentRefreshTimer = null;
  let autoSilentRefreshSeconds = 0;
  let autoRefreshTimer = null;
  let autoRefreshSeconds = 0;
  let autoLoadTimestamps = [];
  let autoLoadEmptyFilterCount = 0;
  let autoLoadStoppedForSession = false;
  let autoLoadSessionKey = "";
  let sidebarIncomingTopicIds = [];
  let sidebarIncomingTopicIdSet = new Set();
  let sidebarIncomingOverflowed = false;
  let sidebarMessageBus = null;
  let sidebarLatestMessageBusCallback = null;
  let sidebarNewMessageBusCallback = null;
  let sidebarIncomingApplyQueued = false;
  let activeLoadToken = 0;
  let activeLoadMoreToken = 0;
  let activeRefreshToken = 0;
  let categoryMetaPromise = null;
  let categoryMetaLoaded = false;
  let tagStylePromise = null;
  let tagStyleLoaded = false;
  let pendingTabBarScrollTab = null;
  let toggleBtn = null;
  let feedContainer = null;
  let feedScrollEl = null;
  let feedListEl = null;
  let feedHeaderEl = null;
  let resizerEl = null;
  let isResizing = false;
  let originalSidebarWidthBeforeFeed = null;
  let widthAnimationTimer = null;

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

  function getDiscourse() {
    try {
      return (typeof unsafeWindow !== "undefined" && unsafeWindow.Discourse) ||
        (typeof window !== "undefined" && window.Discourse) ||
        (typeof Discourse !== "undefined" && Discourse) ||
        null;
    } catch (e) {
      return null;
    }
  }

  function getMessageBus() {
    try {
      return getDiscourse()?.__container__?.lookup("service:message-bus") || null;
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

  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
          getDiscourse()?.__container__
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

  const categoryMetaById = new Map();
  const tagStyleByKey = new Map();
  const SAFE_ICON_RE = /^[A-Za-z0-9_-]+$/;
  const SAFE_COLOR_RE = /^#?[A-Fa-f0-9]{3,8}$/;

  function _normalizeHexColor(color, fallback = "888") {
    if (!color) return fallback;
    const raw = String(color).trim();
    if (!SAFE_COLOR_RE.test(raw)) return fallback;
    return raw.startsWith("#") ? raw.slice(1) : raw;
  }

  function _isSafeIconName(icon) {
    return typeof icon === "string" && SAFE_ICON_RE.test(icon);
  }

  function _safeIconName(icon) {
    return _isSafeIconName(icon) ? icon : "";
  }

  function _safeCategoryStyleType(styleType, hasIcon) {
    return ["icon", "emoji", "square"].includes(styleType)
      ? styleType
      : (hasIcon ? "icon" : "square");
  }

  function _svgIcon(icon, extraClass = "") {
    const safeIcon = _safeIconName(icon);
    if (!safeIcon) return "";
    const className = `fa d-icon d-icon-${safeIcon} svg-icon fa-width-auto svg-string${extraClass ? ` ${extraClass}` : ""}`;
    return `<svg class="${className}" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#${safeIcon}"></use></svg>`;
  }

  function _categoryFallbackMeta(id) {
    const config = CATEGORY_CONFIG[id];
    if (!config) return null;
    const parent = config.parent_category_id ? _getCategoryMeta(config.parent_category_id) : null;
    const icon = _safeIconName(config.icon || "folder");
    return {
      id: Number(id),
      name: config.name || "",
      color: _normalizeHexColor(config.color, "888"),
      text_color: _normalizeHexColor(config.text_color, "FFFFFF"),
      icon,
      style_type: _safeCategoryStyleType(config.style_type, !!icon),
      slug: config.tabId || "",
      parent_category_id: config.parent_category_id || null,
      parent_color: parent?.color || null,
      parent_text_color: parent?.text_color || null,
      read_restricted: !!config.read_restricted,
      description_text: "",
      description_excerpt: "",
    };
  }

  function _getCategoryMeta(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    return categoryMetaById.get(numericId) || _categoryFallbackMeta(numericId);
  }

  function getCategoryTabMeta(cat) {
    const meta = _getCategoryMeta(cat.id);
    return {
      ...cat,
      name: meta?.name || cat.name,
      icon: meta?.icon || cat.icon,
      color: meta?.color ? `#${meta.color}` : cat.color,
    };
  }

  function _getSavedTabOrder() {
    const savedOrder = GM_getValue(TAB_ORDER_KEY, []);
    if (!Array.isArray(savedOrder)) return [];
    return savedOrder.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  }

  function _getOrderedTabCategories() {
    const savedOrder = _getSavedTabOrder();
    if (!savedOrder.length) return [...TAB_CATEGORIES];

    const orderedIds = new Set(savedOrder);
    return [...TAB_CATEGORIES].sort((a, b) => {
      const idxA = savedOrder.indexOf(a.id);
      const idxB = savedOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    }).filter((cat) => orderedIds.has(cat.id) || CATEGORY_CONFIG[cat.id]?.tabId);
  }

  function _saveTabOrderFromGrid(grid) {
    const order = Array.from(grid.querySelectorAll(".sfp-tab-grid-item[data-category-id]"))
      .map((item) => Number(item.dataset.categoryId))
      .filter((id) => Number.isFinite(id));
    GM_setValue(TAB_ORDER_KEY, order);
  }

  function _buildCategoryTabContent(cat) {
    const tabMeta = getCategoryTabMeta(cat);
    return `${_svgIcon(tabMeta.icon)}<span>${escapeHtml(tabMeta.name)}</span>`;
  }

  function _cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
  }

  function _closeFloatingPanels(exceptEl = null) {
    document.querySelectorAll(".sfp-custom-select.open, .sfp-settings-wrap.open, .sfp-tab-shell.open").forEach((el) => {
      if (el !== exceptEl) el.classList.remove("open");
    });
  }

  function _scrollTabIntoView(shell, tabId = currentTab, behavior = "auto") {
    const bar = shell?.querySelector(".sfp-tab-bar");
    const activeTab = shell?.querySelector(`.sfp-tab-bar .sfp-tab-item[data-tab="${_cssEscape(tabId)}"]`);
    if (!bar || !activeTab) return;

    const maxScrollLeft = Math.max(0, bar.scrollWidth - bar.clientWidth);
    const targetLeft = activeTab.offsetLeft - ((bar.clientWidth - activeTab.offsetWidth) / 2);
    const left = Math.min(maxScrollLeft, Math.max(0, targetLeft));

    if (typeof bar.scrollTo === "function") {
      bar.scrollTo({ left, behavior });
    } else {
      bar.scrollLeft = left;
    }
  }

  async function loadCategoryMetadata() {
    if (categoryMetaLoaded) return;
    if (categoryMetaPromise) return categoryMetaPromise;

    categoryMetaPromise = (async () => {
      try {
        const resp = await fetch("/site.json", { headers: { "X-CSRF-Token": getCsrfToken() } });
        if (!resp.ok) throw new Error(`site.json ${resp.status}`);
        const site = await resp.json();
        const categories = Array.isArray(site?.categories) ? site.categories : [];
        const rawById = new Map(categories.map((cat) => [Number(cat.id), cat]));

        categories.forEach((cat) => {
          const id = Number(cat.id);
          if (!Number.isFinite(id)) return;
          const parent = cat.parent_category_id ? rawById.get(Number(cat.parent_category_id)) : null;
          const fallback = CATEGORY_CONFIG[id] || {};
          const icon = _safeIconName(cat.icon || fallback.icon || parent?.icon || "");
          categoryMetaById.set(id, {
            id,
            name: cat.name || fallback.name || "",
            color: _normalizeHexColor(cat.color || fallback.color, "888"),
            text_color: _normalizeHexColor(cat.text_color || fallback.text_color, "FFFFFF"),
            icon,
            style_type: _safeCategoryStyleType(cat.style_type || fallback.style_type, !!icon),
            slug: cat.slug || fallback.tabId || "",
            parent_category_id: cat.parent_category_id || null,
            parent_color: parent ? _normalizeHexColor(parent.color, "888") : null,
            parent_text_color: parent ? _normalizeHexColor(parent.text_color, "FFFFFF") : null,
            read_restricted: !!cat.read_restricted,
            description_text: cat.description_text || cat.description_excerpt || cat.description || "",
            description_excerpt: cat.description_excerpt || cat.description_text || cat.description || "",
          });
        });

        categoryMetaLoaded = true;
      } catch (e) {
        console.warn("[SFP] load category metadata failed:", e);
      } finally {
        categoryMetaPromise = null;
      }
    })();

    return categoryMetaPromise;
  }

  function _tagIndexKeys(tag) {
    const keys = [];
    const add = (value) => {
      if (value === null || value === undefined) return;
      const key = String(value).trim().toLowerCase();
      if (key && !keys.includes(key)) keys.push(key);
    };
    if (typeof tag === "string") {
      add(tag);
      return keys;
    }
    add(tag?.name);
    add(tag?.slug);
    add(tag?.text);
    add(tag?.id);
    return keys;
  }

  function _tagDisplayName(tag) {
    return typeof tag === "string" ? tag : (tag?.name || tag?.text || tag?.slug || "");
  }

  function _getTagStyle(tag) {
    for (const key of _tagIndexKeys(tag)) {
      const style = tagStyleByKey.get(key);
      if (style) return style;
    }
    return null;
  }

  function _sanitizeTagStyle(styleText) {
    const pairs = [];
    String(styleText || "").split(";").forEach((part) => {
      const [rawName, rawValue] = part.split(":");
      const name = rawName?.trim();
      const value = rawValue?.trim();
      if ((name === "--color1" || name === "--color2") && /^#[A-Fa-f0-9]{3,8}$/.test(value)) {
        pairs.push(`${name}: ${value}`);
      }
    });
    return pairs.join("; ");
  }

  function _cacheTagStyle(keys, style) {
    keys.forEach((key) => {
      const normalized = String(key || "").trim().toLowerCase();
      if (normalized) tagStyleByKey.set(normalized, style);
    });
  }

  function _loadTagStyleCache() {
    if (tagStyleByKey.size > 0) return true;

    try {
      const cache = GM_getValue(TAG_STYLE_CACHE_KEY, null);
      if (!cache || cache.version !== TAG_STYLE_CACHE_VERSION || !Array.isArray(cache.entries)) {
        return false;
      }

      cache.entries.forEach(([key, style]) => {
        if (!key || !style || typeof style !== "object") return;
        const icon = _safeIconName(style.icon || "");
        const cssText = _sanitizeTagStyle(style.cssText || "");
        if (!icon && !cssText) return;
        tagStyleByKey.set(String(key), {
          icon,
          cssText,
          hasIcon: !!icon,
        });
      });

      return tagStyleByKey.size > 0;
    } catch (e) {
      console.warn("[SFP] load tag style cache failed:", e);
      return false;
    }
  }

  function _saveTagStyleCache() {
    if (tagStyleByKey.size === 0) return;

    try {
      GM_setValue(TAG_STYLE_CACHE_KEY, {
        version: TAG_STYLE_CACHE_VERSION,
        savedAt: Date.now(),
        entries: Array.from(tagStyleByKey.entries()),
      });
    } catch (e) {
      console.warn("[SFP] save tag style cache failed:", e);
    }
  }

  function _extractTagStylesFromDocument(doc) {
    const anchors = Array.from(doc.querySelectorAll("a.discourse-tag[data-tag-name]"));
    anchors.forEach((anchor) => {
      const use = anchor.querySelector("svg use");
      const icon = _safeIconName((use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").replace(/^#/, ""));
      const style = {
        icon,
        cssText: _sanitizeTagStyle(anchor.getAttribute("style") || ""),
        hasIcon: !!icon,
      };
      if (!style.hasIcon && !style.cssText) return;

      const hrefParts = (anchor.getAttribute("href") || "").split("/").filter(Boolean);
      _cacheTagStyle([
        anchor.dataset.tagName,
        anchor.textContent,
        hrefParts[1],
        hrefParts[2],
      ], style);
    });
  }

  function _waitForIframeTags(iframe, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        let doc = null;
        try {
          doc = iframe.contentDocument;
          if (doc && doc.querySelector("a.discourse-tag[data-tag-name]")) {
            resolve(doc);
            return;
          }
        } catch (e) {
          resolve(null);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(doc);
          return;
        }
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  async function loadTagStyleIndex() {
    if (tagStyleLoaded) return;
    if (tagStylePromise) return tagStylePromise;

    tagStylePromise = (async () => {
      let iframe = null;
      try {
        if (_loadTagStyleCache()) {
          tagStyleLoaded = true;
          return;
        }

        _extractTagStylesFromDocument(document);
        iframe = document.createElement("iframe");
        iframe.src = "/tags";
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.cssText = "position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;border:0;visibility:hidden;pointer-events:none;";
        document.body.appendChild(iframe);
        const doc = await _waitForIframeTags(iframe);
        if (doc) _extractTagStylesFromDocument(doc);

        _saveTagStyleCache();
        tagStyleLoaded = true;
      } catch (e) {
        console.warn("[SFP] load tag style index failed:", e);
      } finally {
        if (iframe) iframe.remove();
        tagStylePromise = null;
      }
    })();

    return tagStylePromise;
  }

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
        background: var(--primary-very-low);
        color: var(--primary-medium);
        cursor: pointer;
        border-radius: 6px;
        padding: 0;
        margin-left: 6px;
        vertical-align: middle;
        transition: color 0.2s, background 0.2s;
        flex-shrink: 0;
      }
      .sfp-toggle-btn:hover {
        color: var(--primary);
        background: var(--primary-low);
      }
      .sfp-toggle-btn.active {
        color: var(--secondary);
        background: var(--tertiary);
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
      .sidebar-wrapper:has(> .sidebar-container.sfp-feed-mode) {
        overflow-x: hidden !important;
      }
      .sidebar-container.sfp-feed-mode {
        overflow-x: hidden !important;
      }
      .sidebar-container.sfp-feed-mode .sfp-feed-container,
      .sidebar-container.sfp-feed-mode .sfp-feed-container * {
        box-sizing: border-box;
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
        width: 100%;
        min-width: 0;
        height: 100%;
        overflow: hidden;
        max-width: 100%;
      }
      .sidebar-wrapper.sfp-width-animating,
      .sidebar-container.sfp-width-animating,
      #d-sidebar.sfp-width-animating {
        transition: width 220ms ease, max-width 220ms ease;
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
        background: var(--tertiary);
      }

      /* ===== Feed Header ===== */
      .sfp-feed-header {
        position: relative;
        flex-shrink: 0;
        padding: 8px 12px;
        border-bottom: 1px solid var(--primary-low);
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
        background: var(--primary-very-low);
        color: var(--primary-medium);
        cursor: pointer;
        border-radius: 6px;
        padding: 0;
        flex-shrink: 0;
        transition: color 0.2s, background 0.2s;
      }
      .sfp-feed-header .sfp-refresh-btn:hover,
      .sfp-feed-header .sfp-settings-btn:hover,
      .sfp-settings-wrap.open .sfp-settings-btn {
        color: var(--tertiary);
        background: var(--primary-low);
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
        gap: 0.5em;
        max-width: 100%;
        margin: 0;
        padding: var(--space-2, 0.5em) var(--space-4, 1em);
        border: none;
        border-radius: var(--d-border-radius-large, 20px);
        cursor: pointer;
        font-size: inherit;
        line-height: 1.35;
        text-decoration: none;
        white-space: nowrap;
        pointer-events: auto;
        transition: background-color 0.2s, color 0.2s;
      }
      .sfp-show-more-overlay .sfp-hint-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sfp-show-more-overlay .sfp-hint-spinner-custom {
        box-sizing: border-box;
        display: inline-block;
        width: 0.85em;
        height: 0.85em;
        border: 0.15em solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        flex: 0 0 auto;
        align-self: center;
        animation: sfp-spin 0.75s linear infinite;
      }
      .sfp-show-more-overlay .sfp-hint-text.loading {
        color: var(--primary-medium);
        cursor: default;
      }
      .sfp-show-more-overlay .sfp-hint-text:hover {
        color: var(--tertiary-hover, var(--tertiary));
      }
      .sfp-show-more-overlay .sfp-hint-text.loading:hover {
        color: var(--primary-medium);
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
        background: var(--primary-very-low);
        border: 1px solid var(--primary-low);
        border-radius: 8px;
        box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 14%, transparent);
      }
      .sfp-settings-wrap.sfp-settings-compact.open .sfp-settings-shell {
        height: 118px;
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
        color: var(--primary);
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
        color: var(--primary-medium);
      }
      .sfp-setting-interval.visible {
        display: flex;
      }
      .sfp-setting-interval input {
        width: 58px;
        height: 26px;
        padding: 2px 6px;
        border: 1px solid var(--primary-low);
        border-radius: 4px;
        background: var(--secondary);
        color: var(--primary);
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
        background: var(--primary-very-low);
        color: var(--primary);
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        transition: background 0.2s, color 0.2s;
      }
      .sfp-custom-select-btn:hover {
        background: var(--primary-low);
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
        background: var(--secondary);
        border: 1px solid var(--primary-low);
        border-radius: 6px;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 10%, transparent);
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
        color: var(--primary);
        cursor: pointer;
        text-align: left;
        white-space: nowrap;
        transition: background 0.15s;
      }
      .sfp-custom-select-option:hover {
        background: var(--primary-very-low);
      }
      .sfp-custom-select-option.selected {
        color: var(--tertiary);
        font-weight: 600;
      }

      /* ===== 分类标签栏 ===== */
      .sfp-tab-shell {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 36px;
        align-items: stretch;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        border-bottom: 1px solid var(--primary-low);
        flex-shrink: 0;
        background: var(--d-content-background, var(--secondary));
      }
      .sfp-tab-bar {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        padding: 8px 12px;
        margin: 0;
        flex-shrink: 0;
        background: transparent;
      }
      .sfp-tab-bar::-webkit-scrollbar { display: none; }
      .sfp-tab-item {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 4px 12px;
        font-size: 13px;
        color: var(--primary-medium);
        cursor: pointer;
        white-space: nowrap;
        border-radius: 16px;
        background: var(--primary-very-low);
        transition: all 0.2s;
        border: 1px solid transparent;
        flex-shrink: 0;
        user-select: none;
      }
      .sfp-tab-item:hover {
        color: var(--primary);
        background: var(--primary-low);
      }
      .sfp-tab-item.active {
        color: var(--secondary);
        background: var(--tertiary);
        border-color: var(--tertiary);
      }
      .sfp-tab-item svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
        flex-shrink: 0;
      }
      .sfp-tab-more-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        min-width: 36px;
        padding: 0;
        border: none;
        border-left: 1px solid var(--primary-low);
        background: var(--d-content-background, var(--secondary));
        color: var(--primary-medium);
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
      }
      .sfp-tab-more-btn:hover,
      .sfp-tab-shell.open .sfp-tab-more-btn {
        background: var(--primary-very-low);
        color: var(--primary);
      }
      .sfp-tab-more-btn svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .sfp-tab-panel {
        position: absolute;
        top: 100%;
        right: 8px;
        left: 8px;
        display: none;
        padding: 10px;
        max-height: min(58vh, 420px);
        overflow-y: auto;
        background: var(--secondary);
        border: 1px solid var(--primary-low);
        border-radius: 8px;
        box-shadow: 0 10px 28px color-mix(in srgb, var(--primary) 16%, transparent);
        z-index: 10002;
      }
      .sfp-tab-shell.open .sfp-tab-panel {
        display: block;
      }
      .sfp-tab-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--primary-medium);
        line-height: 1.3;
      }
      .sfp-tab-panel-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .sfp-tab-panel-title svg {
        width: 13px;
        height: 13px;
        fill: currentColor;
        flex-shrink: 0;
      }
      .sfp-tab-panel-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--primary-medium);
        cursor: pointer;
      }
      .sfp-tab-panel-close:hover {
        background: var(--primary-very-low);
        color: var(--primary);
      }
      .sfp-tab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
        gap: 6px;
      }
      .sfp-tab-grid-item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-width: 0;
        min-height: 32px;
        padding: 6px 8px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--primary-very-low);
        color: var(--primary-medium);
        cursor: pointer;
        font-size: 12px;
        line-height: 1.2;
        text-align: center;
        user-select: none;
        transition: background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s;
      }
      .sfp-tab-grid-item svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
        flex: 0 0 auto;
      }
      .sfp-tab-grid-item span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sfp-tab-grid-item:hover {
        background: var(--primary-low);
        color: var(--primary);
      }
      .sfp-tab-grid-item.active {
        background: var(--tertiary);
        border-color: var(--tertiary);
        color: var(--secondary);
      }
      .sfp-tab-grid-item.dragging {
        opacity: 0.45;
      }
      .sfp-tab-grid-item.drop-target {
        border-color: var(--tertiary);
        box-shadow: inset 0 0 0 1px var(--tertiary);
      }

      /* ===== 筛选栏 ===== */
      .sfp-filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        padding: 8px 16px;
        margin: 0;
        background: var(--primary-very-low);
        border-bottom: 1px solid var(--primary-low);
        font-size: 12px;
        color: var(--primary-medium);
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
        color: var(--tertiary);
        background: var(--primary-low);
      }
      .sfp-filter-item.active {
        color: var(--secondary);
        background: var(--tertiary);
      }

      /* ===== Feed 滚动区 ===== */
      .sfp-feed-scroll {
        position: relative;
        flex: 1;
        min-width: 0;
        max-width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        --scrollbarBg: transparent;
        --scrollbarThumbBg: var(--d-selected, var(--token-color-surface-hovered));
        --scrollbarWidth: var(--space-2, 0.5em);
        scrollbar-color: transparent var(--scrollbarBg);
        transition: scrollbar-color 0.25s ease-in-out;
        transition-delay: 0.5s;
      }
      .sfp-feed-scroll::-webkit-scrollbar {
        width: var(--scrollbarWidth);
      }
      .sfp-feed-scroll::-webkit-scrollbar-thumb {
        background-color: transparent;
        border-radius: calc(var(--scrollbarWidth) / 2);
      }
      .sfp-feed-scroll::-webkit-scrollbar-track {
        background-color: transparent;
      }
      .sfp-feed-scroll:hover {
        scrollbar-color: var(--scrollbarThumbBg) var(--scrollbarBg);
        transition-delay: 0s;
      }
      .sfp-feed-scroll:hover::-webkit-scrollbar-thumb {
        background-color: var(--scrollbarThumbBg);
      }
      .sfp-content-wrapper {
        position: relative;
        min-width: 0;
        max-width: 100%;
        min-height: 100%;
      }

      /* ===== 帖子列表项 ===== */
      .sfp-topic-item {
        padding: 12px 20px;
        border-bottom: 1px solid var(--primary-very-low);
        cursor: pointer;
        transition: background 0.2s;
        position: relative;
        min-width: 0;
        max-width: 100%;
        overflow-wrap: break-word;
        word-break: break-word;
      }
      .sfp-topic-item:hover {
        background: var(--primary-very-low);
      }
      .sfp-topic-item.sfp-pinned {
        /* 只保留置顶 badge 标记，不加背景色 */
      }
      .sfp-topic-item.sfp-new-highlight {
        --sfp-new-highlight-color: var(
          --tertiary-med-or-tertiary,
          var(--tertiary)
        );
        animation: sfp-new-pulse 10s ease-out forwards;
        position: relative;
      }
      @keyframes sfp-new-pulse {
        0% {
          box-shadow: inset 0 0 0 2px var(--sfp-new-highlight-color);
          background: color-mix(
            in srgb,
            var(--sfp-new-highlight-color) 15%,
            transparent
          );
        }
        100% {
          box-shadow: inset 0 0 0 0px transparent;
          background: transparent;
        }
      }

      /* 未读圆点 — 紧跟在时间后 */
      .sfp-topic-item .sfp-topic-time {
        font-size: 12px;
        color: var(--primary-medium);
        white-space: nowrap;
        margin-left: auto;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        line-height: 1;
      }
      .sfp-topic-item .sfp-unread-dot {
        width: 8px;
        height: 8px;
        flex: 0 0 8px;
        display: inline-block;
        border-radius: 50%;
        color: var(--tertiary-med-or-tertiary, var(--tertiary));
        background: currentColor;
        opacity: 0.75;
        vertical-align: middle;
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
        color: var(--primary);
        font-weight: 500;
        cursor: pointer;
        transition: color 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sfp-topic-item .sfp-topic-username:hover {
        color: var(--tertiary);
      }
      .sfp-topic-item .sfp-topic-name {
        font-size: 12px;
        color: var(--primary-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* 标题 */
      .sfp-topic-item .sfp-topic-title {
        font-size: 14px;
        font-weight: bold;
        color: var(--primary);
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
        color: var(--tertiary);
      }
      .sfp-topic-item.sfp-read .sfp-topic-title {
        color: var(--title-color--read, var(--primary-medium));
      }
      .sfp-topic-item .sfp-topic-title-line {
        display: inline;
      }
      .sfp-topic-item .sfp-topic-status-badges {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 2px;
        flex-shrink: 0;
      }
      .sfp-topic-item .topic-status-card {
        --badge-accent: var(--primary-medium);
        --badge-bg: var(--primary-very-low);
        --badge-border: var(--primary-low);
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 6px;
        border: 1px solid var(--badge-border);
        border-radius: var(--d-border-radius, 8px);
        background: var(--badge-bg);
        color: var(--badge-accent);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.45;
        margin-right: 5px;
        vertical-align: middle;
        white-space: nowrap;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--badge-accent) 8%, transparent);
      }
      .sfp-topic-item .topic-status-card.--hot {
        --badge-accent: var(--danger);
        --badge-bg: var(--danger-low, var(--d-hover, var(--tertiary-low)));
        --badge-border: color-mix(in srgb, var(--danger) 28%, transparent);
      }
      .sfp-topic-item .topic-status-card.--pinned {
        --badge-accent: var(--primary-medium);
        --badge-bg: var(--primary-very-low);
        --badge-border: var(--primary-low);
      }
      .sfp-topic-item .topic-status-card__name {
        color: var(--badge-accent);
        font-size: inherit;
        font-weight: inherit;
        line-height: inherit;
        margin: 0;
      }
      .sfp-topic-item .topic-status-card .d-icon {
        color: var(--badge-accent);
        width: 0.92em;
        height: 0.92em;
        flex-shrink: 0;
      }
      .sfp-topic-item .topic-statuses {
        float: left;
      }
      .sfp-topic-item .topic-statuses .topic-status {
        display: inline-flex;
        align-items: center;
        color: var(--primary-medium);
        margin: 0 0.18em 0 0;
        --icon-size: 0.86em;
      }
      .sfp-topic-item .topic-statuses .topic-status .d-icon {
        width: var(--icon-size);
        height: var(--icon-size);
        color: currentColor;
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
        --badge-category-bg: light-dark(
          oklch(from var(--category-badge-color) 97% calc(c * 0.3) h),
          oklch(from var(--category-badge-color) 45% calc(c * 0.5) h)
        );
        --badge-category-text: light-dark(
          oklch(from var(--category-badge-color) 35% calc(c * 0.6) h),
          oklch(from var(--category-badge-color) 95% calc(c * 0.2) h)
        );
        display: inline-flex;
        align-items: center;
        gap: 0.33em;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: var(--d-border-radius, 4px);
        background-color: var(--badge-category-bg, var(--primary-very-low));
        color: var(--badge-category-text, var(--primary-medium));
        flex-shrink: 0;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sfp-topic-item .sfp-category-badge .badge-category {
        min-width: 0;
        align-items: center;
      }
      .sfp-topic-item .sfp-category-badge .badge-category__name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--badge-category-text, var(--primary-medium));
      }
      .sfp-topic-item .sfp-category-badge .d-icon {
        width: 0.9em;
        height: 0.9em;
        flex-shrink: 0;
      }
      @supports not (color: light-dark(tan, tan)) {
        .sfp-topic-item .sfp-category-badge {
          --badge-category-bg: color-mix(in srgb, var(--category-badge-color) 16%, transparent);
          --badge-category-text: var(--primary-high);
        }
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
        border-radius: var(--d-border-radius, 4px);
        line-height: 1.4;
        max-width: 96px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-shrink: 1;
      }
      .sfp-topic-item .sfp-tag .tag-icon .d-icon {
        width: 0.9em;
        height: 0.9em;
      }

      /* 统计行 */
      .sfp-topic-item .sfp-topic-stats {
        display: flex;
        gap: 12px;
        margin-top: 8px;
        font-size: 12px;
        color: var(--primary-medium);
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
        color: var(--primary-medium);
        font-size: 13px;
        gap: 12px;
      }
      .sfp-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid var(--primary-low);
        border-top-color: var(--tertiary);
        border-radius: 50%;
        animation: sfp-spin 0.8s linear infinite;
      }
      .sfp-empty {
        text-align: center;
        padding: 40px 10px;
        color: var(--primary-medium);
        font-size: 13px;
      }
      .sfp-load-more {
        padding: 14px 10px;
        text-align: center;
        font-size: 12px;
        color: var(--primary-medium);
        cursor: pointer;
        transition: color 0.2s;
      }
      .sfp-load-more-error {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        cursor: default;
      }
      .sfp-load-more-error .sfp-load-more-retry {
        padding: 4px 10px;
        border: none;
        border-radius: 4px;
        background: var(--tertiary);
        color: var(--secondary);
        cursor: pointer;
        font-size: 12px;
      }
      .sfp-load-more:hover {
        color: var(--tertiary);
      }
      .sfp-load-more .sfp-load-more-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid var(--primary-low);
        border-top-color: var(--tertiary);
        border-radius: 50%;
        animation: sfp-spin 0.8s linear infinite;
        vertical-align: middle;
        margin-right: 6px;
      }
      .sfp-no-more {
        padding: 14px 10px;
        text-align: center;
        font-size: 11px;
        color: var(--primary-low-mid);
      }
      .sfp-load-more-note {
        padding: 10px 10px 0;
        text-align: center;
        font-size: 12px;
        color: var(--primary-medium);
      }
      .sfp-error {
        padding: 40px 20px;
        text-align: center;
        color: var(--danger);
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
        color: var(--primary-medium);
        word-break: break-word;
      }
      .sfp-error .sfp-retry-btn {
        margin-top: 6px;
        padding: 6px 16px;
        background: var(--tertiary);
        color: var(--secondary);
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

  function getSidebarWidthTransitionElements(sidebar) {
    const wrapper = sidebar?.classList?.contains("sidebar-wrapper")
      ? sidebar
      : sidebar?.closest?.(".sidebar-wrapper");
    return [sidebar, wrapper].filter(Boolean);
  }

  function setSidebarWidthForAnimation(sidebar, width, { enforceMin = true } = {}) {
    const minWidth = enforceMin ? getMinSidebarWidth() : 0;
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(minWidth, width));
    sidebar.style.setProperty("width", clampedWidth + "px", "important");
    document.documentElement.style.setProperty("--d-sidebar-width", clampedWidth + "px");
  }

  function animateSidebarWidth(targetWidth, { cleanupAfter = false, enforceMin = true } = {}) {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (!sidebar) return;

    if (widthAnimationTimer) {
      window.clearTimeout(widthAnimationTimer);
      widthAnimationTimer = null;
    }

    const startWidth = sidebar.getBoundingClientRect().width || DEFAULT_WIDTH;
    const minWidth = enforceMin ? getMinSidebarWidth() : 0;
    const clampedTarget = Math.min(MAX_WIDTH, Math.max(minWidth, targetWidth));
    const transitionEls = getSidebarWidthTransitionElements(sidebar);

    setSidebarWidthForAnimation(sidebar, startWidth, { enforceMin: false });
    transitionEls.forEach((el) => el.classList.add("sfp-width-animating"));

    window.requestAnimationFrame(() => {
      setSidebarWidthForAnimation(sidebar, clampedTarget, { enforceMin });

      widthAnimationTimer = window.setTimeout(() => {
        widthAnimationTimer = null;
        transitionEls.forEach((el) => el.classList.remove("sfp-width-animating"));
        if (cleanupAfter) {
          restoreSidebarWidth();
        }
      }, 260);
    });
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
    if (!sidebar) return;

    if (resizerEl && !sidebar.contains(resizerEl)) {
      resizerEl.remove();
      resizerEl = null;
    }

    if (resizerEl) return;

    resizerEl = sidebar.querySelector(":scope > .sfp-resizer") || document.createElement("div");
    resizerEl.className = "sfp-resizer";
    if (!resizerEl.parentElement) {
      sidebar.appendChild(resizerEl);
    }

    resizerEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      const startX = e.clientX;
      const startWidth = sidebar.offsetWidth;
      resizerEl.classList.add("sfp-resizing");
      getSidebarWidthTransitionElements(sidebar).forEach((el) => el.classList.remove("sfp-width-animating"));
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

    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    sidebar?.querySelectorAll(":scope > .sfp-resizer").forEach((el) => el.remove());
  }

  // ========== 激活 / 停用 ==========
  function activateFeed() {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (!sidebar) return;

    if (!sidebar.classList.contains("sfp-feed-mode") || originalSidebarWidthBeforeFeed === null) {
      originalSidebarWidthBeforeFeed = sidebar.getBoundingClientRect().width || DEFAULT_WIDTH;
    }

    if (feedContainer && sidebar.contains(feedContainer)) {
      sidebar.classList.add("sfp-feed-mode");
      animateSidebarWidth(sfpSidebarWidth);
      setupResizer();
      _syncDefaultViewControls();
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
    animateSidebarWidth(sfpSidebarWidth);
    setupResizer();

    // 恢复当前 tab 筛选的分类
    _restoreTabState();
    _startSidebarIncomingTracking();
    _syncDefaultViewControls();

    // 始终全量加载，数据已在 deactivateFeed 中清除
    loadTopics();

    // 无限滚动
    _setupScrollLoadMore();
  }

  function deactivateFeed() {
    const sidebar = document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
    if (!sidebar) return;

    activeLoadToken++;
    activeLoadMoreToken++;
    activeRefreshToken++;
    isLoading = false;
    isLoadingMore = false;
    isRefreshing = false;
    _pendingReload = false;
    sidebarIncomingApplyQueued = false;

    _stopAutoRefresh();
    _stopAutoSilentRefresh();
    _stopSidebarIncomingTracking();

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
    removeResizer();
    animateSidebarWidth(originalSidebarWidthBeforeFeed || DEFAULT_WIDTH, { cleanupAfter: true, enforceMin: false });
    originalSidebarWidthBeforeFeed = null;
  }

  // ========== Header 控件 ==========
  function _buildHeaderControls(header) {
    // Order 自定义下拉
    const orderOptions = [
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
      _syncDefaultViewControls();
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
    const isDefaultView = _isDefaultFeedView();
    if (isDefaultView) {
      wrapper.classList.add("sfp-settings-compact");
    }

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
    if (isDefaultView) {
      panel.innerHTML = `
        <label class="sfp-setting-row">
          <span>自动静默刷新</span>
          <input type="checkbox" class="sfp-auto-silent-input"${autoSilentRefreshEnabled ? " checked" : ""}>
        </label>
        <label class="sfp-setting-interval${autoSilentRefreshEnabled ? " visible" : ""}">
          <span>静默刷新间隔</span>
          <input type="number" class="sfp-auto-silent-refresh-interval-input" min="0" step="1" value="${autoSilentRefreshInterval}">
          <span>s</span>
        </label>
      `;
    } else {
      panel.innerHTML = `
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
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shouldOpen = !wrapper.classList.contains("open");
      _closeFloatingPanels(wrapper);
      wrapper.classList.toggle("open", shouldOpen);
    });

    panel.addEventListener("click", (e) => e.stopPropagation());

    const autoSilentInput = panel.querySelector(".sfp-auto-silent-input");
    const silentIntervalRow = panel.querySelector(".sfp-setting-interval");
    const silentIntervalInput = panel.querySelector(".sfp-auto-silent-refresh-interval-input");
    if (autoSilentInput) {
      autoSilentInput.addEventListener("change", () => {
        autoSilentRefreshEnabled = autoSilentInput.checked;
        GM_setValue(AUTO_SILENT_REFRESH_KEY, autoSilentRefreshEnabled);
        silentIntervalRow?.classList.toggle("visible", autoSilentRefreshEnabled);
        _startAutoSilentRefresh();
        _updateShowMoreHint();
        if (autoSilentRefreshEnabled && autoSilentRefreshInterval === 0) {
          _queueSidebarIncomingApply();
        }
      });
    }

    if (silentIntervalInput) {
      silentIntervalInput.addEventListener("change", () => {
        const seconds = Math.max(0, Number(silentIntervalInput.value) || DEFAULT_AUTO_SILENT_REFRESH_INTERVAL);
        autoSilentRefreshInterval = seconds;
        silentIntervalInput.value = seconds;
        GM_setValue(AUTO_SILENT_REFRESH_INTERVAL_KEY, autoSilentRefreshInterval);
        _startAutoSilentRefresh();
        if (autoSilentRefreshEnabled && autoSilentRefreshInterval === 0) {
          _queueSidebarIncomingApply();
        }
      });
    }

    const autoRefreshInput = panel.querySelector(".sfp-auto-refresh-input");
    const intervalRow = panel.querySelector(".sfp-setting-interval");
    const intervalInput = panel.querySelector(".sfp-auto-refresh-interval-input");
    if (autoRefreshInput) {
      autoRefreshInput.addEventListener("change", () => {
        autoRefreshEnabled = autoRefreshInput.checked;
        GM_setValue(AUTO_REFRESH_ENABLED_KEY, autoRefreshEnabled);
        intervalRow.classList.toggle("visible", autoRefreshEnabled);
        _startAutoRefresh();
      });
    }

    if (intervalInput) {
      intervalInput.addEventListener("change", () => {
        const seconds = Math.max(1, Number(intervalInput.value) || DEFAULT_AUTO_REFRESH_INTERVAL);
        autoRefreshInterval = seconds;
        intervalInput.value = seconds;
        GM_setValue(AUTO_REFRESH_INTERVAL_KEY, autoRefreshInterval);
        _startAutoRefresh();
      });
    }

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
      const shouldOpen = !wrapper.classList.contains("open");
      _closeFloatingPanels(wrapper);
      wrapper.classList.toggle("open", shouldOpen);
      const isOpen = shouldOpen;
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
    _closeFloatingPanels();
  });

  // ========== 分类标签栏 ==========
  function _buildTabBar() {
    const shell = document.createElement("div");
    shell.className = "sfp-tab-shell";

    const bar = document.createElement("div");
    bar.className = "sfp-tab-bar";

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "sfp-tab-more-btn";
    moreBtn.title = "展开板块 / 排序";
    moreBtn.setAttribute("aria-label", "展开板块 / 排序");
    moreBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M7 10a2 2 0 1 1 .01 0H7zm5 0a2 2 0 1 1 .01 0H12zm5 0a2 2 0 1 1 .01 0H17zM7 16a2 2 0 1 1 .01 0H7zm5 0a2 2 0 1 1 .01 0H12zm5 0a2 2 0 1 1 .01 0H17z"/></svg>`;

    const panel = document.createElement("div");
    panel.className = "sfp-tab-panel";
    panel.innerHTML = `
      <div class="sfp-tab-panel-header">
        <span class="sfp-tab-panel-title">
          <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M10 4h10v2H10V4zM4 3.5h4v3H4v-3zM10 11h10v2H10v-2zM4 10.5h4v3H4v-3zM10 18h10v2H10v-2zM4 17.5h4v3H4v-3z"/></svg>
          <span>拖动板块调整顺序</span>
        </span>
        <button type="button" class="sfp-tab-panel-close" title="关闭" aria-label="关闭">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5z"/></svg>
        </button>
      </div>
      <div class="sfp-tab-grid"></div>
    `;
    const grid = panel.querySelector(".sfp-tab-grid");

    // "全部" 标签
    const allTab = document.createElement("span");
    allTab.className = "sfp-tab-item" + (currentTab === "all" ? " active" : "");
    allTab.dataset.tab = "all";
    allTab.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg><span>全部</span>`;
    bar.appendChild(allTab);

    const allGridItem = document.createElement("span");
    allGridItem.className = "sfp-tab-grid-item" + (currentTab === "all" ? " active" : "");
    allGridItem.dataset.tab = "all";
    allGridItem.innerHTML = allTab.innerHTML;
    grid.appendChild(allGridItem);

    // 各板块标签
    _getOrderedTabCategories().forEach((cat) => {
      const tab = document.createElement("span");
      tab.className = "sfp-tab-item" + (currentTab === cat.tabId ? " active" : "");
      tab.dataset.tab = cat.tabId;
      tab.dataset.categoryId = cat.id;
      tab.innerHTML = _buildCategoryTabContent(cat);
      bar.appendChild(tab);

      const gridItem = document.createElement("span");
      gridItem.className = "sfp-tab-grid-item" + (currentTab === cat.tabId ? " active" : "");
      gridItem.draggable = true;
      gridItem.dataset.tab = cat.tabId;
      gridItem.dataset.categoryId = cat.id;
      gridItem.title = getCategoryTabMeta(cat).name;
      gridItem.innerHTML = _buildCategoryTabContent(cat);
      grid.appendChild(gridItem);
    });

    // 事件代理 — 点击切换
    shell.addEventListener("click", (e) => {
      e.stopPropagation();
      _closeFloatingPanels(shell);
      const closeBtn = e.target.closest(".sfp-tab-panel-close");
      if (closeBtn) {
        e.stopPropagation();
        shell.classList.remove("open");
        return;
      }

      if (e.target.closest(".sfp-tab-more-btn")) {
        e.stopPropagation();
        shell.classList.toggle("open", !shell.classList.contains("open"));
        return;
      }

      const tab = e.target.closest(".sfp-tab-item, .sfp-tab-grid-item");
      if (!tab) return;

      const tabId = tab.dataset.tab;
      const catId = tab.dataset.categoryId ? Number(tab.dataset.categoryId) : null;
      const fromGrid = tab.classList.contains("sfp-tab-grid-item");
      if (tabId === currentTab && catId === currentCategoryId) {
        if (fromGrid) {
          shell.classList.remove("open");
          _scrollTabIntoView(shell, tabId, "smooth");
        }
        return;
      }

      currentTab = tabId;
      currentCategoryId = catId;
      GM_setValue(TAB_KEY, currentTab);
      _syncDefaultViewControls();
      _resetAutoLoadState();

      shell.querySelectorAll(".sfp-tab-item, .sfp-tab-grid-item").forEach((t) => {
        t.classList.remove("active");
      });
      shell.querySelectorAll(`[data-tab="${_cssEscape(tabId)}"]`).forEach((t) => t.classList.add("active"));
      if (fromGrid) {
        pendingTabBarScrollTab = tabId;
        shell.classList.remove("open");
        _scrollTabIntoView(shell, tabId, "smooth");
      }

      loadTopics();
    });

    moreBtn.addEventListener("mousedown", (e) => e.preventDefault());

    let dragItem = null;
    let tabOrderChanged = false;
    grid.addEventListener("dragstart", (e) => {
      const item = e.target.closest(".sfp-tab-grid-item[data-category-id]");
      if (!item) return;
      dragItem = item;
      tabOrderChanged = false;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.dataset.categoryId);
    });

    grid.addEventListener("dragover", (e) => {
      if (!dragItem) return;
      const target = e.target.closest(".sfp-tab-grid-item[data-category-id]");
      if (!target || target === dragItem) return;
      e.preventDefault();
      grid.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
      target.classList.add("drop-target");

      const rect = target.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      const nextNode = before ? target : target.nextSibling;
      if (dragItem !== nextNode) {
        grid.insertBefore(dragItem, nextNode);
        tabOrderChanged = true;
      }
    });

    grid.addEventListener("drop", (e) => {
      if (!dragItem) return;
      e.preventDefault();
    });

    grid.addEventListener("dragend", () => {
      if (dragItem) dragItem.classList.remove("dragging");
      grid.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
      if (tabOrderChanged) {
        _saveTabOrderFromGrid(grid);
        _rerenderTabBar(shell, { keepOpen: true });
      }
      dragItem = null;
      tabOrderChanged = false;
    });

    // 滚轮横向滚动
    bar.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        bar.scrollLeft += e.deltaY;
      }
    });

    shell.appendChild(bar);
    shell.appendChild(moreBtn);
    shell.appendChild(panel);
    return shell;
  }

  function _rerenderTabBar(oldShell, options = {}) {
    if (!oldShell?.parentNode) return null;
    const oldBar = oldShell.querySelector(".sfp-tab-bar");
    const scrollLeft = oldBar?.scrollLeft || 0;
    const keepOpen = options.keepOpen ?? oldShell.classList.contains("open");
    const newShell = _buildTabBar();
    if (keepOpen) newShell.classList.add("open");
    oldShell.replaceWith(newShell);
    const newBar = newShell.querySelector(".sfp-tab-bar");
    if (options.scrollTabId) {
      if (newBar) newBar.scrollLeft = scrollLeft;
      requestAnimationFrame(() => {
        _scrollTabIntoView(newShell, options.scrollTabId, options.scrollBehavior || "auto");
      });
    } else if (newBar) {
      newBar.scrollLeft = scrollLeft;
    }
    return newShell;
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
        _syncDefaultViewControls();
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

  function _refreshCategoryTabs() {
    const shell = feedContainer?.querySelector(".sfp-tab-shell");
    if (!shell) return;

    const scrollTabId = pendingTabBarScrollTab;
    pendingTabBarScrollTab = null;
    _rerenderTabBar(shell, { scrollTabId, scrollBehavior: scrollTabId ? "smooth" : "auto" });
  }

  function _updateShowMoreHint() {
    if (!feedScrollEl) return;

    const contentWrapper = feedScrollEl.querySelector(".sfp-content-wrapper");
    if (!contentWrapper) return;

    // 只在最新活动模式（全部板块 + 最新活动 + 全部筛选）时刷新提示。
    // 0 秒静默刷新会立即应用新话题，不需要显示手动提醒；有效间隔会批量应用，
    // 间隔期间保留数量提示。
    if (!_isDefaultFeedView() || (autoSilentRefreshEnabled && autoSilentRefreshInterval === 0)) {
      const existing = contentWrapper.querySelector(".sfp-show-more-overlay");
      if (existing) existing.remove();
      contentWrapper.classList.remove("sfp-has-show-more");
      return;
    }

    const existing = contentWrapper.querySelector(".sfp-show-more-overlay");
    const newCount = sidebarIncomingTopicIds.length;
    if (newCount <= 0 && !sidebarIncomingOverflowed) {
      if (existing) existing.remove();
      contentWrapper.classList.remove("sfp-has-show-more");
      return;
    }

    const overlay = existing || document.createElement("div");
    overlay.className = "show-more has-topics sfp-show-more-overlay";

    let hint = overlay.querySelector(".sfp-hint-text");
    if (!hint) {
      hint = document.createElement("a");
      hint.className = "sfp-hint-text alert alert-info clickable";
      hint.href = "#";
      hint.addEventListener("click", async (e) => {
        e.preventDefault();
        if (hint.classList.contains("loading")) return;

        _setShowMoreHintLoading(hint, true);
        try {
          await _applySidebarIncomingTopics({ requireDefaultView: true, logPrefix: "show more" });
        } finally {
          _setShowMoreHintLoading(hint, false);
        }
      });
      overlay.appendChild(hint);
    }

    let label = hint.querySelector(".sfp-hint-label");
    if (!label) {
      label = document.createElement("span");
      label.className = "sfp-hint-label";
      hint.appendChild(label);
    }

    label.textContent = sidebarIncomingOverflowed
      ? "有大量新的或更新的话题，点击刷新"
      : `查看 ${newCount} 个新的或更新的话题`;
    contentWrapper.classList.add("sfp-has-show-more");
    if (!existing) {
      contentWrapper.insertBefore(overlay, contentWrapper.firstChild);
    }
  }

  function _setShowMoreHintLoading(hint, loading) {
    hint.classList.toggle("loading", loading);
    hint.setAttribute("aria-busy", loading ? "true" : "false");
    hint.setAttribute("aria-disabled", loading ? "true" : "false");

    const existingSpinner = hint.querySelector(".sfp-hint-spinner-custom");
    if (loading) {
      if (!existingSpinner) {
        const spinner = document.createElement("div");
        spinner.className = "sfp-hint-spinner-custom";
        hint.appendChild(spinner);
      }
    } else if (existingSpinner) {
      existingSpinner.remove();
    }
  }

  function _isDefaultFeedView() {
    return FeedQuery.isDefault();
  }

  function _syncDefaultViewControls() {
    _updateSettingsControl();
    _updateShowMoreHint();
    _startAutoSilentRefresh();
    _startAutoRefresh();
    if (sidebarIncomingOverflowed && _isDefaultFeedView()) {
      _queueSidebarIncomingApply();
      return;
    }
    if (autoSilentRefreshEnabled && autoSilentRefreshInterval === 0 && _isDefaultFeedView() && sidebarIncomingTopicIds.length > 0) {
      _queueSidebarIncomingApply();
    }
  }

  function _updateSettingsControl() {
    if (!feedHeaderEl) return;

    const oldSettings = feedHeaderEl.querySelector(".sfp-settings-wrap");
    if (!oldSettings) return;

    const isOpen = oldSettings.classList.contains("open");
    const nextSettings = _buildSettingsControl();
    if (isOpen) nextSettings.classList.add("open");
    oldSettings.replaceWith(nextSettings);
  }

  function _startSidebarIncomingTracking() {
    if (sidebarLatestMessageBusCallback || sidebarNewMessageBusCallback) return;

    const messageBus = getMessageBus();
    if (!messageBus?.subscribe) {
      console.warn("[SFP] message-bus service unavailable; incoming topics will not auto-update");
      return;
    }

    sidebarMessageBus = messageBus;
    sidebarLatestMessageBusCallback = (data) => _handleSidebarIncomingMessage(data);
    sidebarNewMessageBusCallback = (data) => _handleSidebarIncomingMessage(data);
    messageBus.subscribe("/latest", sidebarLatestMessageBusCallback, _getMessageBusLastId("/latest"));
    messageBus.subscribe("/new", sidebarNewMessageBusCallback, _getMessageBusLastId("/new"));
  }

  function _getMessageBusLastId(channel) {
    const lastId = sidebarMessageBus?.callbacks?.find((callback) => callback.channel === channel)?.last_id;
    return Number.isFinite(lastId) ? lastId : -1;
  }

  function _stopSidebarIncomingTracking() {
    if (sidebarMessageBus?.unsubscribe) {
      if (sidebarLatestMessageBusCallback) {
        sidebarMessageBus.unsubscribe("/latest", sidebarLatestMessageBusCallback);
      }
      if (sidebarNewMessageBusCallback) {
        sidebarMessageBus.unsubscribe("/new", sidebarNewMessageBusCallback);
      }
    }

    sidebarMessageBus = null;
    sidebarLatestMessageBusCallback = null;
    sidebarNewMessageBusCallback = null;
    sidebarIncomingApplyQueued = false;
  }

  function _handleSidebarIncomingMessage(data) {
    if (!data || !["latest", "new_topic"].includes(data.message_type)) return;
    if (!data.topic_id) return;
    if (data.payload?.archetype && data.payload.archetype !== "regular") return;

    _addSidebarIncomingTopicId(data.topic_id);

    if (_isDefaultFeedView() && (sidebarIncomingOverflowed || (autoSilentRefreshEnabled && autoSilentRefreshInterval === 0))) {
      _queueSidebarIncomingApply();
    } else {
      _updateShowMoreHint();
    }
  }

  function _addSidebarIncomingTopicId(topicId) {
    const numericId = Number(topicId);
    if (!Number.isFinite(numericId) || sidebarIncomingTopicIdSet.has(numericId)) return;

    if (sidebarIncomingTopicIds.length >= MAX_INCOMING_TOPIC_IDS_DIRECT_APPLY) {
      sidebarIncomingOverflowed = true;
      return;
    }

    sidebarIncomingTopicIdSet.add(numericId);
    sidebarIncomingTopicIds.push(numericId);
  }

  function _removeSidebarIncomingTopicIds(topicIds) {
    if (!topicIds?.length) return;

    const toRemove = new Set(topicIds.map((id) => Number(id)).filter(Number.isFinite));
    if (toRemove.size === 0) return;

    sidebarIncomingTopicIds = sidebarIncomingTopicIds.filter((id) => !toRemove.has(Number(id)));
    sidebarIncomingTopicIdSet = new Set(sidebarIncomingTopicIds);
    if (sidebarIncomingTopicIds.length === 0) {
      sidebarIncomingOverflowed = false;
    }
  }

  function _clearSidebarIncomingTopicIds() {
    sidebarIncomingTopicIds = [];
    sidebarIncomingTopicIdSet = new Set();
    sidebarIncomingOverflowed = false;
  }

  function _queueSidebarIncomingApply() {
    if (!_isDefaultFeedView()) return;
    if (!sidebarIncomingOverflowed && (!autoSilentRefreshEnabled || autoSilentRefreshInterval > 0)) return;
    if (sidebarIncomingApplyQueued) return;

    sidebarIncomingApplyQueued = true;
    Promise.resolve().then(async () => {
      sidebarIncomingApplyQueued = false;
      await _applySidebarIncomingTopics({ requireDefaultView: true, logPrefix: "auto silent refresh" });
    });
  }

  function _flushQueuedSidebarIncomingApply() {
    if (!sidebarIncomingApplyQueued) return;

    if (!_isDefaultFeedView() || (!sidebarIncomingOverflowed && (!autoSilentRefreshEnabled || autoSilentRefreshInterval > 0))) {
      sidebarIncomingApplyQueued = false;
      return;
    }

    sidebarIncomingApplyQueued = false;
    _queueSidebarIncomingApply();
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

  const FeedQuery = {
    snapshot() {
      return {
        tab: currentTab,
        categoryId: currentCategoryId,
        order: currentOrder,
        period: currentPeriod,
        filter: currentFilter,
        hidePinned,
      };
    },

    key(query) {
      return [
        query.tab,
        query.categoryId || "",
        query.order,
        query.period,
        query.filter,
        query.hidePinned ? "hide-pinned" : "show-pinned",
      ].join("|");
    },

    isCurrent(query) {
      return this.key(query) === this.key(this.snapshot());
    },

    isDefault(query = this.snapshot()) {
      return query.tab === "all" && query.order === "activity" && query.filter === "all";
    },

    buildUrl(query, page) {
      const useTopList = _usesPeriodScopedTopList(query.order, query.period);

      if (query.tab !== "all" && query.categoryId) {
        const cat = CATEGORY_CONFIG[query.categoryId];
        const tabId = cat?.tabId || query.tab;
        const params = [`page=${page}`];
        if (useTopList) {
          params.push(`period=${encodeURIComponent(query.period)}`);
          params.push(`order=${encodeURIComponent(query.order)}`);
          return `/c/${tabId}/${query.categoryId}/l/top.json?${params.join("&")}`;
        }

        params.push(`order=${encodeURIComponent(query.order)}`);
        return `/c/${tabId}/${query.categoryId}/l/latest.json?${params.join("&")}`;
      }

      if (useTopList) {
        const params = [
          `period=${encodeURIComponent(query.period)}`,
          `order=${encodeURIComponent(query.order)}`,
          `page=${page}`,
        ];
        return `/top.json?${params.join("&")}`;
      }

      const params = [
        `order=${encodeURIComponent(query.order)}`,
        `page=${page}`,
      ];
      if (query.period !== "all" && _needsPeriodForUrl(query.order)) {
        params.push(`period=${encodeURIComponent(query.period)}`);
      }
      return `/latest.json?${params.join("&")}`;
    },
  };

  // ========== 数据加载 ==========
  async function fetchFeedTopics(query, page) {
    const url = FeedQuery.buildUrl(query, page);
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

  function _usesPeriodScopedTopList(order, period) {
    return period !== "all" && _needsPeriodForUrl(order);
  }

  function _startTagStyleIndexLoad() {
    if (tagStyleLoaded || tagStylePromise) return;
    loadTagStyleIndex().then(() => {
      if (feedModeEnabled && feedListEl && allTopics.length > 0) {
        renderTopics();
      }
    });
  }

  async function loadTopics() {
    if (isLoading) {
      _pendingReload = true;
      return;
    }

    const requestQuery = FeedQuery.snapshot();
    const requestToken = ++activeLoadToken;
    activeLoadMoreToken++;
    activeRefreshToken++;
    isLoading = true;
    isLoadingMore = false;
    isRefreshing = false;
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
      _startTagStyleIndexLoad();
      await loadCategoryMetadata();
      if (requestToken !== activeLoadToken || !FeedQuery.isCurrent(requestQuery)) return;
      _refreshCategoryTabs();

      const data = await fetchFeedTopics(requestQuery, 0);
      if (requestToken !== activeLoadToken || !FeedQuery.isCurrent(requestQuery)) return;
      _processUsers(data);

      if (data?.topic_list?.topics) {
        const topics = data.topic_list.topics;
        topics.forEach((t) => loadedTopicIds.add(t.id));
        allTopics = topics;
        hasMorePages = !!data.topic_list.more_topics_url;
        renderTopics();
        _removeSidebarIncomingTopicIds(topics.map((topic) => topic.id));
        sidebarIncomingOverflowed = false;
        _updateShowMoreHint();
      } else {
        if (feedListEl) feedListEl.innerHTML = `<div class="sfp-empty">暂无话题</div>`;
        hasMorePages = false;
        sidebarIncomingOverflowed = false;
      }

      _startAutoRefresh();
    } catch (e) {
      if (requestToken !== activeLoadToken || !FeedQuery.isCurrent(requestQuery)) return;
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
      if (requestToken === activeLoadToken) {
        isLoading = false;
        _flushQueuedSidebarIncomingApply();
        if (_pendingReload) {
          _pendingReload = false;
          loadTopics();
        }
      }
    }
  }

  async function loadMoreTopics({ source = "manual" } = {}) {
    if (isLoading || isLoadingMore || !hasMorePages) return;
    const isAutoLoad = source === "auto";
    if (isAutoLoad && !_canRunAutoLoad()) return;

    const requestQuery = FeedQuery.snapshot();
    const requestToken = ++activeLoadMoreToken;
    const nextPage = currentPage + 1;
    isLoadingMore = true;
    if (isAutoLoad) _recordAutoLoadRequest();

    _showLoadMoreSpinner();

    try {
      await loadCategoryMetadata();
      if (requestToken !== activeLoadMoreToken || !FeedQuery.isCurrent(requestQuery)) return;
      const data = await fetchFeedTopics(requestQuery, nextPage);
      if (requestToken !== activeLoadMoreToken || !FeedQuery.isCurrent(requestQuery)) return;
      _processUsers(data);

      if (data?.topic_list?.topics) {
        const topics = data.topic_list.topics;
        currentPage = nextPage;
        const newTopics = topics.filter((t) => {
          if (loadedTopicIds.has(t.id)) return false;
          loadedTopicIds.add(t.id);
          return true;
        });

        hasMorePages = !!data.topic_list.more_topics_url;
        if (newTopics.length === 0) {
          if (hasMorePages) {
            _renderPaginationFooter({
              note: !isAutoLoad ? "下一页无符合条件的话题" : "",
            });
          } else {
            _showNoMore();
          }
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
      if (requestToken !== activeLoadMoreToken || !FeedQuery.isCurrent(requestQuery)) return;
      console.error("[SFP] loadMoreTopics error:", e);
      _showLoadMoreError(e);
    } finally {
      if (requestToken === activeLoadMoreToken) {
        isLoadingMore = false;
        _flushQueuedSidebarIncomingApply();
      }
    }
  }

  function _processUsers(data) {
    if (data?.users) {
      data.users.forEach((u) => { usersMap[u.id] = u; });
    }
  }

  async function refreshCurrentView() {
    return _refreshCurrentView({
      logPrefix: "manual refresh",
      clearIncomingOnSuccess: sidebarIncomingOverflowed && _isDefaultFeedView(),
    });
  }

  async function _refreshCurrentView({ requireDefaultView = false, logPrefix = "refresh", clearIncomingOnSuccess = false } = {}) {
    if (isLoading || isLoadingMore || isRefreshing) return false;
    if (requireDefaultView && !_isDefaultFeedView()) return false;
    if (!feedListEl) return false;

    const requestQuery = FeedQuery.snapshot();
    const requestToken = ++activeRefreshToken;
    isRefreshing = true;
    try {
      await loadCategoryMetadata();
      if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return false;
      const data = await fetchFeedTopics(requestQuery, 0);
      if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return false;
      _processUsers(data);

      if (!data?.topic_list?.topics) return false;

      const freshTopics = data.topic_list.topics;
      const freshMap = new Map(freshTopics.map((t) => [t.id, t]));
      const newTopicIds = freshTopics
        .filter((topic) => !loadedTopicIds.has(topic.id))
        .map((topic) => topic.id);

      freshTopics.forEach((topic) => loadedTopicIds.add(topic.id));

      const existingTail = allTopics.filter((topic) => !freshMap.has(topic.id));
      allTopics = freshTopics.concat(existingTail);
      hasMorePages = !!data.topic_list.more_topics_url;

      renderTopics(newTopicIds);
      if (clearIncomingOnSuccess) {
        _clearSidebarIncomingTopicIds();
      } else {
        _removeSidebarIncomingTopicIds(freshTopics.map((topic) => topic.id));
      }

      _updateShowMoreHint();
      return true;
    } catch (e) {
      console.warn(`[SFP] ${logPrefix} error:`, e);
      return false;
    } finally {
      if (requestToken === activeRefreshToken) {
        isRefreshing = false;
        _resetAutoRefreshCountdown();
        _flushQueuedSidebarIncomingApply();
      }
    }
  }

  // ========== 静默刷新 ==========
  // 仅在最新活动视图（全部板块 + 最新活动 + 全部筛选）时按 incoming 事件启用
  async function _applySidebarIncomingTopics({ requireDefaultView = false, logPrefix = "incoming", queueIfBusy = true } = {}) {
    if (isLoading || isLoadingMore || isRefreshing) {
      if (queueIfBusy) sidebarIncomingApplyQueued = true;
      return;
    }
    if (requireDefaultView && !_isDefaultFeedView()) return;
    if (!feedListEl) return;

    const incomingTopicIds = sidebarIncomingTopicIds.slice();
    if (incomingTopicIds.length === 0) {
      _updateShowMoreHint();
      return;
    }

    if (sidebarIncomingOverflowed || incomingTopicIds.length > MAX_INCOMING_TOPIC_IDS_DIRECT_APPLY) {
      await _refreshCurrentView({
        requireDefaultView,
        logPrefix: `${logPrefix} overflow refresh`,
        clearIncomingOnSuccess: true,
      });
      return;
    }

    const requestQuery = FeedQuery.snapshot();
    const requestToken = ++activeRefreshToken;
    isRefreshing = true;
    try {
      await loadCategoryMetadata();
      if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return;
      const data = await fetchFeedTopicsByIds(incomingTopicIds);
      if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return;
      if (!data?.topic_list?.topics) return;
      _processUsers(data);

      const incomingTopics = data.topic_list.topics;
      const incomingMap = new Map(incomingTopics.map((topic) => [topic.id, topic]));
      const incomingIdSet = new Set(incomingTopics.map((topic) => topic.id));

      incomingTopics.forEach((topic) => loadedTopicIds.add(topic.id));
      allTopics = incomingTopics.concat(allTopics.filter((topic) => !incomingMap.has(topic.id)));
      hasMorePages = hasMorePages || incomingTopics.length > 0;

      renderTopics(Array.from(incomingIdSet));
      _removeSidebarIncomingTopicIds(incomingTopicIds);
      _updateShowMoreHint();
    } catch (e) {
      console.warn(`[SFP] ${logPrefix} error:`, e);
    } finally {
      if (requestToken === activeRefreshToken) {
        isRefreshing = false;
        _flushQueuedSidebarIncomingApply();
      }
    }
  }

  function _startAutoSilentRefresh() {
    _stopAutoSilentRefresh();
    if (!autoSilentRefreshEnabled) return;
    if (autoSilentRefreshInterval <= 0) return;
    if (!_isDefaultFeedView()) return;

    _resetAutoSilentRefreshCountdown();
    autoSilentRefreshTimer = setInterval(() => {
      autoSilentRefreshSeconds--;
      if (autoSilentRefreshSeconds <= 0) {
        _resetAutoSilentRefreshCountdown();
        if (feedModeEnabled && !isLoading && !isLoadingMore && !isRefreshing) {
          _applySidebarIncomingTopics({
            requireDefaultView: true,
            logPrefix: "auto silent refresh interval",
            queueIfBusy: false,
          });
        }
      }
    }, 1000);
  }

  function _resetAutoSilentRefreshCountdown() {
    if (autoSilentRefreshEnabled && autoSilentRefreshInterval > 0) {
      autoSilentRefreshSeconds = autoSilentRefreshInterval;
    }
  }

  function _stopAutoSilentRefresh() {
    if (autoSilentRefreshTimer) {
      clearInterval(autoSilentRefreshTimer);
      autoSilentRefreshTimer = null;
    }
  }

  // ========== 自动刷新 ==========
  function _startAutoRefresh() {
    _stopAutoRefresh();
    if (_isDefaultFeedView()) return;
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

  function _buildCategoryBadge(categoryId) {
    const meta = _getCategoryMeta(categoryId);
    if (!meta?.name) return "";

    const styleParts = [
      `--category-badge-color: #${_normalizeHexColor(meta.color, "888")}`,
      `--category-badge-text-color: #${_normalizeHexColor(meta.text_color, "FFFFFF")}`,
    ];
    if (meta.parent_category_id && meta.parent_color) {
      styleParts.push(`--parent-category-badge-color: #${_normalizeHexColor(meta.parent_color, "888")}`);
      styleParts.push(`--parent-category-badge-text-color: #${_normalizeHexColor(meta.parent_text_color, "FFFFFF")}`);
    }

    const styleType = _safeCategoryStyleType(meta.style_type, !!meta.icon);
    const categoryClasses = ["badge-category"];
    if (meta.read_restricted) categoryClasses.push("restricted");
    if (meta.parent_category_id) categoryClasses.push("--has-parent");
    categoryClasses.push(`--style-${styleType}`);

    const dataParent = meta.parent_category_id
      ? ` data-parent-category-id="${Number(meta.parent_category_id)}"`
      : "";
    const title = meta.description_text || meta.description_excerpt || "";
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    const iconHtml = styleType === "icon" && meta.icon ? _svgIcon(meta.icon) : "";
    const lockHtml = meta.read_restricted ? _svgIcon("lock") : "";

    return `<span class="badge-category__wrapper sfp-category-badge" style="${styleParts.join("; ")}"><span data-category-id="${Number(meta.id)}"${dataParent} data-drop-close="true" class="${categoryClasses.join(" ")}"${titleAttr}>${iconHtml}${lockHtml}<span class="badge-category__name" dir="auto">${escapeHtml(meta.name)}</span></span></span>`;
  }

  function _buildTagBadge(tag) {
    const tagName = _tagDisplayName(tag);
    if (!tagName) return "";

    const tagStyle = _getTagStyle(tag);
    const classes = ["discourse-tag", "box", "sfp-tag"];
    if (tagStyle?.hasIcon) classes.push("discourse-tag--tag-icons-style");
    const styleAttr = tagStyle?.cssText ? ` style="${tagStyle.cssText}"` : "";
    const iconHtml = tagStyle?.hasIcon
      ? `<span class="tag-icon">${_svgIcon(tagStyle.icon)}</span>`
      : "";

    return `<span class="${classes.join(" ")}"${styleAttr}>${iconHtml}${escapeHtml(tagName)}</span>`;
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
    const unreadDotHtml = _hasUnreadMarker(topic)
      ? '<span class="sfp-unread-dot" aria-hidden="true"></span>'
      : "";

    // 状态标记
    const statusBadges = [];
    if (topic.is_hot) {
      statusBadges.push('<span class="topic-status-card --hot"><svg class="fa d-icon d-icon-fire svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire"></use></svg><p class="topic-status-card__name">热门</p></span>');
    }
    if (topic.pinned || topic.pinned_globally) {
      statusBadges.push('<span class="topic-status-card --pinned"><svg class="fa d-icon d-icon-thumbtack svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#thumbtack"></use></svg><p class="topic-status-card__name">已置顶</p></span>');
    }
    const statusBadgesHtml = statusBadges.length
      ? `<span class="sfp-topic-status-badges">${statusBadges.join("")}</span>`
      : "";

    // 标题
    const closedHtml = topic.closed
      ? '<span class="topic-statuses"><span title="此话题已被关闭；不再接受新回复" class="topic-status --closed"><svg class="fa d-icon d-icon-lock svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#lock"></use></svg></span></span>'
      : "";

    // 分类
    const categoryHtml = _buildCategoryBadge(topic.category_id);

    // 标签
    let tagsHtml = "";
    if (topic.tags && topic.tags.length > 0) {
      const tagItems = topic.tags.slice(0, 3).map((tag) => {
        return _buildTagBadge(tag);
      }).join("");
      tagsHtml = `<span class="sfp-topic-tags">${tagItems}</span>`;
    }

    // 统计
    const replies = Math.max(0, (topic.posts_count || 1) - 1);
    const views = topic.views >= 1000 ? (topic.views / 1000).toFixed(1) + "k" : (topic.views || 0);
    const likes = topic.like_count || 0;

    item.innerHTML = `
      <div class="sfp-topic-header">
        ${avatarHtml}
        <div class="sfp-topic-meta-col">
          <div class="sfp-topic-user-info">
            ${displayName}
            <span class="sfp-topic-username">${escapeHtml(username)}</span>
          </div>
        </div>
        ${statusBadgesHtml}
        <span class="sfp-topic-time">${timeStr}${unreadDotHtml}</span>
      </div>
      <div class="sfp-topic-title"><span class="sfp-topic-title-line">${closedHtml}${escapeHtml(topic.unicode_title || topic.title)}</span></div>
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
    const dot = itemElement.querySelector(".sfp-unread-dot");
    if (dot) dot.remove();
  }

  // ========== 无限滚动加载 ==========
  function _setupScrollLoadMore() {
    if (!feedScrollEl) return;
    feedScrollEl.addEventListener("wheel", (e) => {
      if (!feedScrollEl || e.deltaY === 0) return;

      const { scrollTop, scrollHeight, clientHeight } = feedScrollEl;
      const canScroll = scrollHeight > clientHeight;
      const atTop = scrollTop <= 0;
      const atBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;
      const scrollingUp = e.deltaY < 0;
      const scrollingDown = e.deltaY > 0;

      if (!canScroll || (scrollingUp && atTop) || (scrollingDown && atBottom)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

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

  function _showLoadMoreError(error) {
    _removePaginationFooter();
    const el = document.createElement("div");
    el.className = "sfp-load-more sfp-load-more-error";
    el.innerHTML = `
      <span>请求失败</span>
      <button type="button" class="sfp-load-more-retry">重试</button>
    `;
    el.querySelector(".sfp-load-more-retry")?.addEventListener("click", () => {
      loadMoreTopics({ source: "manual" });
    });
    if (feedListEl) feedListEl.appendChild(el);
    console.warn("[SFP] load more failed:", error);
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
          const resizerMissing = !resizerEl || !sidebar?.contains(resizerEl);
          if (sidebar && (!feedContainer || !sidebar.contains(feedContainer) || !sidebar.classList.contains("sfp-feed-mode") || resizerMissing)) {
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
      createToggle();

      RouteWatcher.start();

      if (feedModeEnabled) {
        setTimeout(() => activateFeed(), 300);
      } else {
        removeResizer();
        restoreSidebarWidth();
      }
    });
  }

  init();
})();
