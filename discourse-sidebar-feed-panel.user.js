// ==UserScript==
// @name         Discourse Sidebar Feed Panel
// @namespace    https://linux.do/
// @version      3.0.0
// @author       YsLtr
// @description  将 Discourse 原生侧边栏改造为信息流面板，支持分类筛选、已读/未读过滤、拖拽调整宽度
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=linux.do
// @downloadURL  https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/latest/download/discourse-sidebar-feed-panel.user.js
// @updateURL    https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/latest/download/discourse-sidebar-feed-panel.user.js
// @match        https://linux.do/*
// @match        https://www.nodeloc.com/*
// @match        https://forum.chrultrabook.com/*
// @match        https://community.openai.com/*
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function() {
	"use strict";
	var __defProp = Object.defineProperty;
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	var I18N = {
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
			incomingHintTip: "在刷新按钮中显示当前板块范围内的新活动候选数量。离开首屏时点击数量会先回到顶部，再应用这些候选。",
			autoSilentLabel: "自动静默刷新",
			autoSilentTip: "在最新活动视图且停留首屏时按间隔自动应用新话题；离开首屏后暂停，只累计候选。",
			hidePinnedTip: "只在最新活动视图加载首页时，排除列表顶部已读的置顶话题。新活动队列和加载更多不会应用这个设置。",
			silentIntervalLabel: "静默刷新间隔",
			silentIntervalTip: "单位为秒，最小为 0。设为 0 时，有新活动会立即静默应用；大于 0 时按倒计时批量应用。",
			autoRefreshLabel: "自动刷新",
			autoRefreshTip: "用于非最新活动的排序视图，停留首屏时按间隔重新拉取当前列表。不要设置太快，频繁请求可能触发站点速率限制。",
			autoRefreshIntervalLabel: "自动刷新间隔",
			autoRefreshIntervalTip: "单位为秒，最小为 1。到达间隔后刷新当前筛选和排序下的列表。",
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
			topicUnavailableTip: "此话题已从服务器列表中消失，可能被取消公开、隐藏或删除。点击可自行确认实际情况。",
			closedTitle: "此话题已被关闭；不再接受新回复",
			loadMore: "加载更多",
			noMore: "— 已经到底了 —",
			requestFailed: "请求失败"
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
			incomingHintTip: "Show incoming candidates for the current category scope in the refresh button. Away from the head, clicking the count returns to the top before applying them.",
			autoSilentLabel: "Auto silent refresh",
			autoSilentTip: "In the latest activity view, automatically apply incoming topics while the feed is at the head. Away from the head, pause applying and keep accumulating candidates.",
			hidePinnedTip: "Only in the latest activity view, exclude read pinned topics at the top when loading the first page. Incoming topics and load more are not affected.",
			silentIntervalLabel: "Silent interval",
			silentIntervalTip: "Seconds. Minimum 0. With 0, incoming activity is applied immediately; otherwise candidates are batched by countdown.",
			autoRefreshLabel: "Auto refresh",
			autoRefreshTip: "For non-latest sorting views, re-fetch the current list while the feed is at the head. Avoid very short intervals to reduce rate-limit risk.",
			autoRefreshIntervalLabel: "Refresh interval",
			autoRefreshIntervalTip: "Seconds. Minimum 1. Refreshes the current filter and sorting view when the interval elapses.",
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
			topicUnavailableTip: "This topic disappeared from the server list; it may be unlisted, hidden, or deleted. Click to check what happened.",
			closedTitle: "This topic is closed; it no longer accepts replies",
			loadMore: "Load more",
			noMore: "No more topics",
			requestFailed: "Request failed"
		}
	};
	function createI18n(getDiscourse) {
		function getUiLocale() {
			const language = [
				document.documentElement?.getAttribute("lang"),
				document.documentElement?.getAttribute("xml:lang"),
				getDiscourse()?.SiteSettings?.default_locale,
				navigator.language
			].find((value) => String(value || "").trim()) || "en";
			return /^zh/i.test(language) ? "zh-CN" : "en";
		}
		function t(key, params = {}) {
			const template = (I18N[getUiLocale()] || I18N.en)[key] || I18N.en[key] || key;
			return String(template).replace(/\{(\w+)\}/g, (_, name) => {
				return params[name] === void 0 ? `{${name}}` : String(params[name]);
			});
		}
		function formatRelativeTime(dateStr) {
			const date = new Date(dateStr || "");
			if (Number.isNaN(date.getTime())) return "";
			const diff = Math.max(0, new Date().getTime() - date.getTime());
			const seconds = Math.floor(diff / 1e3);
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
		return {
			getUiLocale,
			t,
			formatRelativeTime
		};
	}
	var Lifetime = class {
		cleanups = new Set();
		timeouts = new Set();
		frames = new Set();
		ended = false;
		aborter = new AbortController();
		get disposed() {
			return this.ended;
		}
		get signal() {
			return this.aborter.signal;
		}
		defer(cleanup) {
			if (this.ended) {
				cleanup();
				return () => {};
			}
			this.cleanups.add(cleanup);
			return () => {
				this.cleanups.delete(cleanup);
			};
		}
		listen(target, type, fn, options) {
			if (this.ended) return () => {};
			target.addEventListener(type, fn, options);
			const cleanup = () => target.removeEventListener(type, fn, options);
			const forget = this.defer(cleanup);
			return () => {
				cleanup();
				forget();
			};
		}
		timeout(fn, ms) {
			if (this.ended) return 0;
			const id = window.setTimeout(() => {
				this.timeouts.delete(id);
				if (!this.ended) fn();
			}, ms);
			this.timeouts.add(id);
			return id;
		}
		clearTimeout(id) {
			window.clearTimeout(id);
			this.timeouts.delete(id);
		}
		frame(fn) {
			if (this.ended) return 0;
			const id = window.requestAnimationFrame((time) => {
				this.frames.delete(id);
				if (!this.ended) fn(time);
			});
			this.frames.add(id);
			return id;
		}
		cancelFrame(id) {
			window.cancelAnimationFrame(id);
			this.frames.delete(id);
		}
		dispose() {
			if (this.ended) return;
			this.ended = true;
			this.aborter.abort();
			for (const cleanup of [...this.cleanups].reverse()) cleanup();
			this.cleanups.clear();
			for (const id of this.timeouts) window.clearTimeout(id);
			for (const id of this.frames) window.cancelAnimationFrame(id);
			this.timeouts.clear();
			this.frames.clear();
		}
	};
	function createRouteWatcher(callbacks) {
		let stopCurrent;
		function stop() {
			stopCurrent?.();
			stopCurrent = void 0;
		}
		function start() {
			if (stopCurrent) return;
			let lastUrl = location.href;
			let active = true;
			const checkUrl = () => {
				if (!active || location.href === lastUrl) return;
				lastUrl = location.href;
				callbacks.onRouteChange();
			};
			const originalPush = history.pushState;
			const originalReplace = history.replaceState;
			const push = function(...args) {
				originalPush.apply(this, args);
				checkUrl();
			};
			const replace = function(...args) {
				originalReplace.apply(this, args);
				checkUrl();
			};
			history.pushState = push;
			history.replaceState = replace;
			window.addEventListener("popstate", checkUrl);
			const observer = new MutationObserver(() => {
				if (!active) return;
				checkUrl();
				callbacks.onMutation();
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			stopCurrent = () => {
				active = false;
				observer.disconnect();
				window.removeEventListener("popstate", checkUrl);
				if (history.pushState === push) history.pushState = originalPush;
				if (history.replaceState === replace) history.replaceState = originalReplace;
			};
		}
		return {
			start,
			stop
		};
	}
	var storage_keys_exports = __exportAll({
		AUTO_REFRESH_ENABLED_KEY: () => AUTO_REFRESH_ENABLED_KEY,
		AUTO_REFRESH_INTERVAL_KEY: () => AUTO_REFRESH_INTERVAL_KEY,
		AUTO_SILENT_REFRESH_INTERVAL_KEY: () => AUTO_SILENT_REFRESH_INTERVAL_KEY,
		AUTO_SILENT_REFRESH_KEY: () => AUTO_SILENT_REFRESH_KEY,
		CATEGORY_DATA_CACHE_KEY: () => CATEGORY_DATA_CACHE_KEY,
		FILTER_KEY: () => FILTER_KEY,
		HIDE_PINNED_KEY: () => HIDE_PINNED_KEY,
		LEGACY_LINUXDO_ORIGIN: () => LEGACY_LINUXDO_ORIGIN,
		ORDER_KEY: () => ORDER_KEY,
		PERIOD_KEY: () => PERIOD_KEY,
		SHOW_INCOMING_HINT_KEY: () => SHOW_INCOMING_HINT_KEY,
		SITE_SCOPED_STORAGE_KEYS: () => SITE_SCOPED_STORAGE_KEYS,
		SITE_STORAGE_PREFIX: () => SITE_STORAGE_PREFIX,
		STATE_KEY: () => STATE_KEY,
		STORAGE_MISSING: () => STORAGE_MISSING,
		TAB_KEY: () => TAB_KEY,
		TAB_ORDER_KEY: () => TAB_ORDER_KEY,
		TAG_STYLE_CACHE_KEY: () => TAG_STYLE_CACHE_KEY,
		WIDTH_KEY: () => WIDTH_KEY
	});
	var STATE_KEY = "sfp_feed_mode_enabled";
	var ORDER_KEY = "sfp_current_order";
	var PERIOD_KEY = "sfp_current_period";
	var WIDTH_KEY = "sfp_sidebar_width";
	var TAB_KEY = "sfp_current_tab";
	var TAB_ORDER_KEY = "sfp_tab_order";
	var FILTER_KEY = "sfp_current_filter";
	var HIDE_PINNED_KEY = "sfp_activity_hide_pinned";
	var SHOW_INCOMING_HINT_KEY = "sfp_show_incoming_hint";
	var AUTO_SILENT_REFRESH_KEY = "sfp_auto_silent_refresh";
	var AUTO_SILENT_REFRESH_INTERVAL_KEY = "sfp_auto_silent_refresh_interval";
	var AUTO_REFRESH_ENABLED_KEY = "sfp_auto_refresh_enabled";
	var AUTO_REFRESH_INTERVAL_KEY = "sfp_auto_refresh_interval";
	var CATEGORY_DATA_CACHE_KEY = "sfp_category_data_cache_v1";
	var TAG_STYLE_CACHE_KEY = "sfp_tag_style_cache_v1";
	var SITE_STORAGE_PREFIX = "sfp_site";
	var LEGACY_LINUXDO_ORIGIN = "https://linux.do";
	var STORAGE_MISSING = "__SFP_STORAGE_MISSING__";
	var SITE_SCOPED_STORAGE_KEYS = [
		STATE_KEY,
		ORDER_KEY,
		PERIOD_KEY,
		WIDTH_KEY,
		TAB_KEY,
		TAB_ORDER_KEY,
		FILTER_KEY,
		HIDE_PINNED_KEY,
		SHOW_INCOMING_HINT_KEY,
		AUTO_SILENT_REFRESH_KEY,
		AUTO_SILENT_REFRESH_INTERVAL_KEY,
		AUTO_REFRESH_ENABLED_KEY,
		AUTO_REFRESH_INTERVAL_KEY,
		CATEGORY_DATA_CACHE_KEY,
		TAG_STYLE_CACHE_KEY
	];
	var AUTO_LOAD_RATE_WINDOW_MS = 5e3;
	function buildCategoryPath(categoryId, getCategoryMeta) {
		const targetCategoryId = Number(categoryId);
		if (!Number.isFinite(targetCategoryId)) return "";
		const chain = [];
		const seen = new Set();
		let meta = getCategoryMeta(targetCategoryId);
		while (meta && !seen.has(meta.id)) {
			seen.add(meta.id);
			chain.unshift(meta);
			const parentId = Number(meta.parent_category_id);
			if (!Number.isFinite(parentId) || parentId === meta.id) break;
			meta = getCategoryMeta(parentId);
		}
		const slugs = chain.map((cat) => cat.slug).filter((slug) => !!slug);
		if (slugs.length === 0) slugs.push("category");
		return `/c/${slugs.map((slug) => encodeURIComponent(slug)).join("/")}/${targetCategoryId}`;
	}
	function _needsPeriodForUrl(order) {
		return [
			"views",
			"posts",
			"likes",
			"op_likes"
		].includes(order);
	}
	function _usesPeriodScopedTopList(order, period) {
		return period !== "all" && _needsPeriodForUrl(order);
	}
	function feedQueryKey(query) {
		return [
			query.tab,
			query.categoryId || "",
			query.order,
			query.period,
			query.filter
		].join("|");
	}
	function buildFeedUrl(query, page, getCategoryMeta) {
		const useTopList = _usesPeriodScopedTopList(query.order, query.period);
		if (query.tab !== "all" && query.categoryId) {
			const categoryPath = buildCategoryPath(query.categoryId, getCategoryMeta);
			const params = [`page=${page}`, "include_subcategories=true"];
			if (useTopList) {
				params.push(`period=${encodeURIComponent(query.period)}`);
				params.push(`order=${encodeURIComponent(query.order)}`);
				return `${categoryPath}/l/top.json?${params.join("&")}`;
			}
			params.push(`order=${encodeURIComponent(query.order)}`);
			return `${categoryPath}/l/latest.json?${params.join("&")}`;
		}
		if (useTopList) return `/top.json?${[
			`period=${encodeURIComponent(query.period)}`,
			`order=${encodeURIComponent(query.order)}`,
			`page=${page}`
		].join("&")}`;
		const params = [`order=${encodeURIComponent(query.order)}`, `page=${page}`];
		if (query.period !== "all" && _needsPeriodForUrl(query.order)) params.push(`period=${encodeURIComponent(query.period)}`);
		return `/latest.json?${params.join("&")}`;
	}
	function objectPayload(value) {
		return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
	}
	function errorMessage(error) {
		return error instanceof Error ? error.message : String(error);
	}
	var SAFE_ICON_RE = /^[A-Za-z0-9_-]+$/;
	var SAFE_COLOR_RE = /^#?[A-Fa-f0-9]{3,8}$/;
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
		return [
			"icon",
			"emoji",
			"square"
		].includes(styleType || "") ? styleType : hasIcon ? "icon" : "square";
	}
	var ORDER_OPTION_DEFS = [
		{
			labelKey: "orderActivity",
			value: "activity",
			capability: "latest"
		},
		{
			labelKey: "orderCreated",
			value: "created",
			capability: "new"
		},
		{
			labelKey: "orderViews",
			value: "views",
			capability: "top"
		},
		{
			labelKey: "orderPosts",
			value: "posts",
			capability: "top"
		},
		{
			labelKey: "orderLikes",
			value: "likes",
			capability: "top"
		},
		{
			labelKey: "orderOpLikes",
			value: "op_likes",
			capability: "top"
		}
	];
	var PERIOD_OPTION_DEFS = [
		{
			labelKey: "periodAll",
			value: "all"
		},
		{
			labelKey: "periodDaily",
			value: "daily"
		},
		{
			labelKey: "periodWeekly",
			value: "weekly"
		},
		{
			labelKey: "periodMonthly",
			value: "monthly"
		},
		{
			labelKey: "periodQuarterly",
			value: "quarterly"
		},
		{
			labelKey: "periodYearly",
			value: "yearly"
		}
	];
	var FILTER_OPTION_DEFS = [
		{
			labelKey: "filterAll",
			value: "all"
		},
		{
			labelKey: "filterUnseen",
			value: "unseen"
		},
		{
			labelKey: "filterRead",
			value: "read"
		}
	];
	function createSiteData({ storage, getCsrfToken, onChange }) {
		let scope = new Lifetime();
		const _getSiteValue = storage.get;
		const _setSiteValue = storage.set;
		const categoryMetaById = new Map();
		let tabCategories = [];
		let siteCapabilities = _createDefaultSiteCapabilities();
		let categoryMetaPromise = null;
		let categoryMetaLoaded = false;
		let siteDataPromise = null;
		let siteDataLoaded = false;
		let siteDataCache = null;
		let categoriesAndLatestPromise = null;
		let categoriesAndLatestLoaded = false;
		let categoriesAndLatestCache = null;
		function _createDefaultSiteCapabilities() {
			return {
				orderValues: new Set(ORDER_OPTION_DEFS.map((option) => option.value)),
				periodValues: new Set(PERIOD_OPTION_DEFS.map((option) => option.value)),
				filterValues: new Set(FILTER_OPTION_DEFS.map((option) => option.value)),
				rawFilters: new Set(),
				rawTopMenuItems: new Set()
			};
		}
		function _stringSet(values) {
			return new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean));
		}
		function _updateSiteCapabilities(site) {
			const rawFilters = _stringSet(site?.filters);
			const rawTopMenuItems = _stringSet(site?.top_menu_items);
			_stringSet(site?.anonymous_top_menu_items).forEach((item) => rawTopMenuItems.add(item));
			rawTopMenuItems.forEach((item) => rawFilters.add(item));
			const supportsLatest = rawFilters.size === 0 || rawFilters.has("latest");
			const supportsNew = rawFilters.has("new");
			const supportsTop = rawFilters.has("top");
			const orderValues = new Set();
			if (supportsLatest) orderValues.add("activity");
			if (supportsNew || supportsLatest) orderValues.add("created");
			if (supportsTop) [
				"views",
				"posts",
				"likes",
				"op_likes"
			].forEach((order) => orderValues.add(order));
			if (orderValues.size === 0) orderValues.add("activity");
			const sitePeriods = _stringSet(site?.periods);
			const periodValues = sitePeriods.size > 0 ? new Set(PERIOD_OPTION_DEFS.map((option) => option.value).filter((value) => sitePeriods.has(value))) : new Set(PERIOD_OPTION_DEFS.map((option) => option.value));
			if (periodValues.size === 0) periodValues.add("all");
			const filterValues = new Set(["all"]);
			if (rawFilters.has("unseen") || rawFilters.has("unread") || rawFilters.has("new")) filterValues.add("unseen");
			if (rawFilters.has("read")) filterValues.add("read");
			siteCapabilities = {
				orderValues,
				periodValues,
				filterValues,
				rawFilters,
				rawTopMenuItems
			};
		}
		function _categoryTabId(id) {
			return `cat-${Number(id)}`;
		}
		function _findTabCategoryByTabId(tabId) {
			return tabCategories.find((cat) => {
				return cat.tabId === tabId || cat.legacyTabIds?.includes(tabId);
			}) || null;
		}
		function _categoryIdFromPath(value) {
			if (!value || typeof value !== "string") return null;
			let path = value;
			try {
				path = new URL(value, location.origin).pathname;
			} catch (e) {
				path = value.split("?")[0].split("#")[0];
			}
			const parts = path.split("/").filter(Boolean);
			if (parts[0] !== "c") return null;
			for (let index = parts.length - 1; index >= 1; index--) {
				const id = Number(parts[index]);
				if (Number.isInteger(id) && id > 0) return id;
			}
			return null;
		}
		function _categoryListCategories(data) {
			return Array.isArray(data?.category_list?.categories) ? data.category_list.categories : [];
		}
		function _mergeCategoryRecords(...categoryLists) {
			const rawById = new Map();
			categoryLists.forEach((categoryList) => {
				if (!Array.isArray(categoryList)) return;
				categoryList.forEach((cat) => {
					const id = Number(cat?.id);
					if (!Number.isFinite(id)) return;
					rawById.set(id, {
						...rawById.get(id) || {},
						...cat,
						id
					});
				});
			});
			return Array.from(rawById.values());
		}
		function _collectNavigationCategoryIds(site, rawById, categoryListCategories = []) {
			const ids = [];
			const seen = new Set();
			const addId = (value) => {
				const id = Number(value);
				if (!Number.isInteger(id) || id <= 0 || !rawById.has(id) || seen.has(id)) return;
				seen.add(id);
				ids.push(id);
			};
			const addRecord = (record) => {
				if (!record) return;
				if (typeof record === "number" || typeof record === "string") {
					addId(record);
					const pathId = _categoryIdFromPath(String(record));
					if (pathId) addId(pathId);
					return;
				}
				if (typeof record !== "object") return;
				addId(record.category_id ?? record.categoryId ?? record.category?.id);
				if ((String(record.type || record.section_type || "").toLowerCase() === "category" || record.topic_count !== void 0 || record.parent_category_id !== void 0 || record.read_restricted !== void 0) && record.id !== void 0) addId(record.id);
				[
					record.value,
					record.url,
					record.href,
					record.path,
					record.link,
					record.route
				].forEach((path) => {
					const pathId = _categoryIdFromPath(path);
					if (pathId) addId(pathId);
				});
			};
			const addRecords = (records) => {
				if (!Array.isArray(records)) return;
				records.forEach(addRecord);
			};
			[
				site?.navigation_menu_categories,
				site?.navigation_menu_site_categories,
				site?.default_navigation_menu_categories,
				site?.anonymous_default_navigation_menu_categories
			].forEach(addRecords);
			[
				site?.anonymous_sidebar_sections,
				site?.sidebar_sections,
				site?.navigation_menu_sections
			].forEach((sections) => {
				if (!Array.isArray(sections)) return;
				sections.forEach((section) => {
					addRecord(section);
					addRecords(section?.links);
				});
			});
			if (ids.length === 0) addRecords(categoryListCategories);
			return ids;
		}
		function _buildTabCategories(site, navigationCategories, rawById) {
			return _collectNavigationCategoryIds(site, rawById, navigationCategories).map((id) => _getCategoryMeta(id)).filter((meta) => !!meta?.name).map((meta) => ({
				id: meta.id,
				tabId: _categoryTabId(meta.id),
				legacyTabIds: [meta.slug].filter(Boolean),
				name: meta.name,
				icon: meta.icon,
				color: `#${meta.color}`,
				slug: meta.slug
			}));
		}
		function _normalizeCategoryMeta(raw = {}, parent = null) {
			const id = Number(raw.id);
			const icon = _safeIconName(raw.icon || "");
			return {
				id,
				name: raw.name || "",
				color: _normalizeHexColor(raw.color, "888"),
				text_color: _normalizeHexColor(raw.text_color, "FFFFFF"),
				icon,
				style_type: _safeCategoryStyleType(raw.style_type, !!icon),
				slug: raw.slug || "",
				parent_category_id: raw.parent_category_id || null,
				parent_color: parent ? _normalizeHexColor(parent.color, "888") : null,
				parent_text_color: parent ? _normalizeHexColor(parent.text_color, "FFFFFF") : null,
				read_restricted: !!raw.read_restricted,
				description_text: raw.description_text || raw.description_excerpt || raw.description || "",
				description_excerpt: raw.description_excerpt || raw.description_text || raw.description || ""
			};
		}
		function _getCategoryMeta(id) {
			const numericId = Number(id);
			if (!Number.isFinite(numericId)) return null;
			return categoryMetaById.get(numericId) || null;
		}
		function _cloneJsonArray(value) {
			if (!Array.isArray(value)) return [];
			try {
				return JSON.parse(JSON.stringify(value));
			} catch (e) {
				return [];
			}
		}
		function _createCategoryDataCacheSource(site = {}, navigationCategories = []) {
			return {
				site: {
					categories: _cloneJsonArray(site?.categories),
					filters: _cloneJsonArray(site?.filters),
					periods: _cloneJsonArray(site?.periods),
					top_menu_items: _cloneJsonArray(site?.top_menu_items),
					anonymous_top_menu_items: _cloneJsonArray(site?.anonymous_top_menu_items),
					top_tags: _cloneJsonArray(site?.top_tags),
					can_tag_topics: site?.can_tag_topics,
					navigation_menu_categories: _cloneJsonArray(site?.navigation_menu_categories),
					navigation_menu_site_categories: _cloneJsonArray(site?.navigation_menu_site_categories),
					default_navigation_menu_categories: _cloneJsonArray(site?.default_navigation_menu_categories),
					anonymous_default_navigation_menu_categories: _cloneJsonArray(site?.anonymous_default_navigation_menu_categories),
					anonymous_sidebar_sections: _cloneJsonArray(site?.anonymous_sidebar_sections),
					sidebar_sections: _cloneJsonArray(site?.sidebar_sections),
					navigation_menu_sections: _cloneJsonArray(site?.navigation_menu_sections)
				},
				navigationCategories: _cloneJsonArray(navigationCategories)
			};
		}
		function _applyCategoryDataSource(source, { primeSiteData = false } = {}) {
			const site = source?.site || {};
			const navigationCategories = Array.isArray(source?.navigationCategories) ? source.navigationCategories : [];
			const categories = _mergeCategoryRecords(site?.categories, navigationCategories);
			const rawById = new Map(categories.map((cat) => [Number(cat.id), cat]));
			_updateSiteCapabilities(site);
			categoryMetaById.clear();
			categories.forEach((cat) => {
				const id = Number(cat.id);
				if (!Number.isFinite(id)) return;
				const parent = cat.parent_category_id ? rawById.get(Number(cat.parent_category_id)) : null;
				categoryMetaById.set(id, _normalizeCategoryMeta(cat, parent));
			});
			tabCategories = _buildTabCategories(site, navigationCategories, rawById);
			onChange();
			if (primeSiteData && !siteDataLoaded) {
				siteDataCache = site;
				siteDataLoaded = true;
			}
			categoryMetaLoaded = true;
		}
		function _loadCategoryDataCache() {
			try {
				const cache = _getSiteValue(CATEGORY_DATA_CACHE_KEY, null);
				if (!cache || cache.version !== 1 || !cache.source) return null;
				const source = cache.source;
				if (!source.site || !Array.isArray(source.site.categories) || !Array.isArray(source.navigationCategories)) return null;
				return source;
			} catch (e) {
				console.warn("[SFP] load category data cache failed:", e);
				return null;
			}
		}
		function _saveCategoryDataCache(source) {
			try {
				_setSiteValue(CATEGORY_DATA_CACHE_KEY, {
					version: 1,
					savedAt: Date.now(),
					source
				});
			} catch (e) {
				console.warn("[SFP] save category data cache failed:", e);
			}
		}
		function _resetRuntimeCategoryData() {
			scope.dispose();
			scope = new Lifetime();
			categoryMetaPromise = null;
			categoryMetaLoaded = false;
			categoryMetaById.clear();
			tabCategories = [];
			siteDataPromise = null;
			siteDataLoaded = false;
			siteDataCache = null;
			categoriesAndLatestPromise = null;
			categoriesAndLatestLoaded = false;
			categoriesAndLatestCache = null;
		}
		function getCategoryTabMeta(cat) {
			const meta = _getCategoryMeta(cat.id);
			return {
				...cat,
				name: meta?.name || cat.name,
				icon: meta?.icon || cat.icon,
				color: meta?.color ? `#${meta.color}` : cat.color
			};
		}
		function _getSavedTabOrder() {
			const savedOrder = _getSiteValue(TAB_ORDER_KEY, []);
			if (!Array.isArray(savedOrder)) return [];
			return savedOrder.map((id) => Number(id)).filter((id) => Number.isFinite(id));
		}
		function _getOrderedTabCategories() {
			const savedOrder = _getSavedTabOrder();
			if (!savedOrder.length) return [...tabCategories];
			return [...tabCategories].sort((a, b) => {
				const idxA = savedOrder.indexOf(a.id);
				const idxB = savedOrder.indexOf(b.id);
				if (idxA === -1 && idxB === -1) return 0;
				if (idxA === -1) return 1;
				if (idxB === -1) return -1;
				return idxA - idxB;
			});
		}
		function _parsePreloadedPayload(raw) {
			if (!raw) return null;
			try {
				const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
				return objectPayload(JSON.parse(decoded));
			} catch (e) {
				return null;
			}
		}
		function _extractPreloadedSiteData() {
			const candidates = [...document.querySelectorAll("[data-preloaded]"), ...document.querySelectorAll("script[type='application/json']")];
			for (const el of candidates) {
				const payload = _parsePreloadedPayload(el.getAttribute("data-preloaded") || el.textContent || "");
				const site = payload?._site || payload?.site || payload;
				if (site?.categories || site?.top_tags) return site;
			}
			return null;
		}
		async function loadSiteData() {
			scope.signal.throwIfAborted();
			if (siteDataLoaded) return siteDataCache;
			if (siteDataPromise) return siteDataPromise;
			const loadScope = scope;
			siteDataPromise = (async () => {
				const preloaded = _extractPreloadedSiteData();
				if (preloaded) {
					siteDataCache = preloaded;
					siteDataLoaded = true;
					return siteDataCache;
				}
				const resp = await fetch("/site.json", {
					signal: loadScope.signal,
					headers: { "X-CSRF-Token": getCsrfToken() }
				});
				if (!resp.ok) throw new Error(`site.json ${resp.status}`);
				const data = await resp.json();
				loadScope.signal.throwIfAborted();
				siteDataCache = objectPayload(data);
				siteDataLoaded = true;
				return siteDataCache;
			})().finally(() => {
				if (loadScope === scope) siteDataPromise = null;
			});
			return siteDataPromise;
		}
		async function loadCategoriesAndLatestData() {
			scope.signal.throwIfAborted();
			if (categoriesAndLatestLoaded) return categoriesAndLatestCache;
			if (categoriesAndLatestPromise) return categoriesAndLatestPromise;
			const loadScope = scope;
			categoriesAndLatestPromise = (async () => {
				const resp = await fetch("/categories_and_latest.json", {
					signal: loadScope.signal,
					headers: { "X-CSRF-Token": getCsrfToken() }
				});
				if (!resp.ok) throw new Error(`categories_and_latest.json ${resp.status}`);
				const data = await resp.json();
				loadScope.signal.throwIfAborted();
				categoriesAndLatestCache = objectPayload(data);
				categoriesAndLatestLoaded = true;
				return categoriesAndLatestCache;
			})().finally(() => {
				if (loadScope === scope) categoriesAndLatestPromise = null;
			});
			return categoriesAndLatestPromise;
		}
		async function loadCategoryMetadata() {
			scope.signal.throwIfAborted();
			if (categoryMetaLoaded) return;
			if (categoryMetaPromise) return categoryMetaPromise;
			const loadScope = scope;
			categoryMetaPromise = (async () => {
				try {
					const cachedSource = _loadCategoryDataCache();
					if (cachedSource) {
						_applyCategoryDataSource(cachedSource, { primeSiteData: true });
						return;
					}
					const [siteResult, categoriesAndLatestResult] = await Promise.allSettled([loadSiteData(), loadCategoriesAndLatestData()]);
					loadScope.signal.throwIfAborted();
					const site = siteResult.status === "fulfilled" ? siteResult.value : null;
					const categoriesAndLatest = categoriesAndLatestResult.status === "fulfilled" ? categoriesAndLatestResult.value : null;
					if (siteResult.status === "rejected") console.warn("[SFP] load site data failed:", siteResult.reason);
					if (categoriesAndLatestResult.status === "rejected") console.warn("[SFP] load categories_and_latest failed:", categoriesAndLatestResult.reason);
					if (!site && !categoriesAndLatest) throw new Error("site category metadata unavailable");
					const navigationCategories = _categoryListCategories(categoriesAndLatest);
					const source = _createCategoryDataCacheSource(site || {}, navigationCategories);
					_applyCategoryDataSource(source);
					_saveCategoryDataCache(source);
				} catch (e) {
					if (loadScope.disposed) return;
					console.warn("[SFP] load category metadata failed:", e);
					tabCategories = [];
					onChange();
					categoryMetaLoaded = true;
				} finally {
					if (loadScope === scope) categoryMetaPromise = null;
				}
			})();
			return categoryMetaPromise;
		}
		return {
			get loaded() {
				return categoryMetaLoaded;
			},
			get tabCategories() {
				return tabCategories;
			},
			get capabilities() {
				return siteCapabilities;
			},
			_getCategoryMeta,
			_findTabCategoryByTabId,
			getCategoryTabMeta,
			_getOrderedTabCategories,
			_extractPreloadedSiteData,
			loadSiteData,
			loadCategoryMetadata,
			reset: _resetRuntimeCategoryData,
			dispose: () => scope.dispose()
		};
	}
	function closestTarget(event, selector) {
		return event.target instanceof Element ? event.target.closest(selector) : null;
	}
	function escapeHtml(text) {
		if (!text) return "";
		const div = document.createElement("div");
		div.textContent = String(text);
		return div.innerHTML;
	}
	function escapeAttr(text) {
		return escapeHtml(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}
	function _svgIcon(icon, extraClass = "") {
		const safeIcon = _safeIconName(icon);
		if (!safeIcon) return "";
		return `<svg class="${`fa d-icon d-icon-${safeIcon} svg-icon fa-width-auto svg-string${extraClass ? ` ${extraClass}` : ""}`}" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#${safeIcon}"></use></svg>`;
	}
	function _categoryColorMarkerHtml(color) {
		return `<span class="sfp-category-color-marker" style="--sfp-category-marker-color:#${_normalizeHexColor(color, "888")}" aria-hidden="true"></span>`;
	}
	function createControls({ t, prefs, site, host, getScope, updatePreference, saveTabOrder, getCategoryId, setCategoryId, _resetAutoLoadState, loadTopics, _beginSidebarIncomingViewSettling, _syncDefaultViewControls, _syncRefreshButtonBusy, _handleHeadActionClick, _syncSidebarIncomingTracking, _syncHeadActionState, _isAutoSilentRefreshActive, _queueSidebarIncomingApply, _startAutoSilentRefresh, _startAutoRefresh, _isLatestActivityView, renderTopics, _finishSidebarIncomingViewSettling }) {
		const { getCategoryTabMeta, _getOrderedTabCategories } = site;
		let feedRefreshBtn = null;
		let globalHelpTooltip = null;
		let pendingTabBarScrollTab = null;
		const requestAnimationFrame = (fn) => getScope().frame(fn);
		const setTimeout = (fn, ms) => getScope().timeout(fn, ms);
		function clampNumber(value, min, max, fallback) {
			const numeric = Number(value);
			if (!Number.isFinite(numeric)) return fallback;
			return Math.min(max, Math.max(min, Math.round(numeric)));
		}
		function _getOrderOptions() {
			return ORDER_OPTION_DEFS.filter((option) => site.capabilities.orderValues.has(option.value)).map((option) => ({
				label: t(option.labelKey),
				value: option.value
			}));
		}
		function _getPeriodOptions() {
			return PERIOD_OPTION_DEFS.filter((option) => site.capabilities.periodValues.has(option.value)).map((option) => ({
				label: t(option.labelKey),
				value: option.value
			}));
		}
		function _getFilterOptions() {
			return FILTER_OPTION_DEFS.filter((option) => site.capabilities.filterValues.has(option.value)).map((option) => ({
				label: t(option.labelKey),
				value: option.value
			}));
		}
		function _saveTabOrderFromGrid(grid) {
			saveTabOrder(Array.from(grid.querySelectorAll(".sfp-tab-grid-item[data-category-id]")).map((item) => Number(item.dataset.categoryId)).filter((id) => Number.isFinite(id)));
		}
		function _buildCategoryTabContent(cat) {
			const tabMeta = getCategoryTabMeta(cat);
			return `${tabMeta.icon ? _svgIcon(tabMeta.icon) : _categoryColorMarkerHtml(tabMeta.color)}<span>${escapeHtml(tabMeta.name)}</span>`;
		}
		function _cssEscape(value) {
			return typeof window.CSS?.escape === "function" ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
		}
		function _closeFloatingPanels(exceptEl = null) {
			document.querySelectorAll(".sfp-custom-select.open, .sfp-settings-wrap.open, .sfp-tab-shell.open").forEach((el) => {
				if (el !== exceptEl) el.classList.remove("open");
			});
		}
		function _scrollTabIntoView(shell, tabId = prefs.currentTab, behavior = "auto") {
			const bar = shell?.querySelector(".sfp-tab-bar");
			const activeTab = shell?.querySelector(`.sfp-tab-bar .sfp-tab-item[data-tab="${_cssEscape(tabId)}"]`);
			if (!bar || !activeTab) return;
			const maxScrollLeft = Math.max(0, bar.scrollWidth - bar.clientWidth);
			const targetLeft = activeTab.offsetLeft - (bar.clientWidth - activeTab.offsetWidth) / 2;
			const left = Math.min(maxScrollLeft, Math.max(0, targetLeft));
			bar.scrollTo({
				left,
				behavior
			});
		}
		function _buildHeaderControls(header) {
			const orderOptions = _getOrderOptions();
			const periodOptions = _getPeriodOptions();
			const periodSelect = _buildCustomSelect(periodOptions, prefs.currentPeriod, (value) => {
				updatePreference("currentPeriod", value);
				_resetAutoLoadState();
				loadTopics();
			});
			periodSelect.classList.add("sfp-period-select");
			_updatePeriodVisibility(periodSelect);
			const orderSelect = _buildCustomSelect(orderOptions, prefs.currentOrder, (value) => {
				updatePreference("currentOrder", value);
				_updatePeriodVisibility(periodSelect);
				_beginSidebarIncomingViewSettling();
				_syncDefaultViewControls();
				_resetAutoLoadState();
				loadTopics();
			});
			orderSelect.classList.add("sfp-order-select");
			function _updatePeriodVisibility(ps) {
				ps.style.display = _needsPeriodForUrl(prefs.currentOrder) && periodOptions.length > 1 ? "" : "none";
			}
			header.appendChild(orderSelect);
			header.appendChild(periodSelect);
			const spacer = document.createElement("span");
			spacer.className = "sfp-header-spacer";
			header.appendChild(spacer);
			header.appendChild(_buildSettingsControl());
			const refreshBtn = document.createElement("button");
			refreshBtn.className = "sfp-refresh-btn";
			refreshBtn.type = "button";
			refreshBtn.title = t("refresh");
			refreshBtn.setAttribute("aria-label", t("refresh"));
			refreshBtn.innerHTML = _refreshIconHtml();
			refreshBtn.addEventListener("click", _handleHeadActionClick);
			feedRefreshBtn = refreshBtn;
			_syncRefreshButtonBusy();
			header.appendChild(refreshBtn);
		}
		function _buildSettingsControl() {
			const wrapper = document.createElement("span");
			wrapper.className = "sfp-settings-wrap";
			const isLatestActivityView = _isLatestActivityView();
			const shell = document.createElement("span");
			shell.className = "sfp-settings-shell";
			const btn = document.createElement("button");
			btn.className = "sfp-settings-btn";
			btn.type = "button";
			btn.title = t("settings");
			btn.innerHTML = `
      <span class="sfp-settings-line sfp-settings-line-1"></span>
      <span class="sfp-settings-line sfp-settings-line-2"></span>
      <span class="sfp-settings-line sfp-settings-line-3"></span>
    `;
			const panel = document.createElement("div");
			panel.className = "sfp-settings-panel";
			if (isLatestActivityView) panel.innerHTML = `
        <div class="sfp-setting-row sfp-incoming-hint-row">
          ${_buildSettingLabelHtml(t("incomingHintLabel"), t("incomingHintTip"))}
          <input type="checkbox" class="sfp-incoming-hint-input"${prefs.showIncomingHint ? " checked" : ""}>
        </div>
        <div class="sfp-setting-row sfp-hide-pinned-row">
          ${_buildSettingLabelHtml(t("hidePinned"), t("hidePinnedTip"))}
          <input type="checkbox" class="sfp-hide-pinned-input"${prefs.hidePinned ? " checked" : ""}>
        </div>
        <div class="sfp-setting-row sfp-auto-silent-row">
          ${_buildSettingLabelHtml(t("autoSilentLabel"), t("autoSilentTip"))}
          <input type="checkbox" class="sfp-auto-silent-input"${prefs.autoSilentRefreshEnabled ? " checked" : ""}>
        </div>
        <div class="sfp-setting-interval sfp-auto-silent-interval${_isAutoSilentRefreshActive() ? " visible" : ""}">
          ${_buildSettingLabelHtml(t("silentIntervalLabel"), t("silentIntervalTip"))}
          <input type="number" class="sfp-auto-silent-refresh-interval-input" min="0" step="1" value="${prefs.autoSilentRefreshInterval}">
          <span>${escapeHtml(t("secondsSuffix"))}</span>
        </div>
      `;
			else panel.innerHTML = `
        <div class="sfp-setting-row sfp-auto-refresh-row">
          ${_buildSettingLabelHtml(t("autoRefreshLabel"), t("autoRefreshTip"))}
          <input type="checkbox" class="sfp-auto-refresh-input"${prefs.autoRefreshEnabled ? " checked" : ""}>
        </div>
        <div class="sfp-setting-interval sfp-auto-refresh-interval${prefs.autoRefreshEnabled ? " visible" : ""}">
          ${_buildSettingLabelHtml(t("autoRefreshIntervalLabel"), t("autoRefreshIntervalTip"))}
          <input type="number" class="sfp-auto-refresh-interval-input" min="1" step="1" value="${prefs.autoRefreshInterval}">
          <span>${escapeHtml(t("secondsSuffix"))}</span>
        </div>
      `;
			btn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				const shouldOpen = !wrapper.classList.contains("open");
				_closeFloatingPanels(wrapper);
				wrapper.classList.toggle("open", shouldOpen);
				_syncSettingsPanelState(wrapper);
			});
			panel.addEventListener("click", (e) => e.stopPropagation());
			panel.querySelectorAll(".sfp-setting-help").forEach((helpBtn) => {
				const showTooltip = () => {
					if (!globalHelpTooltip) return;
					const text = helpBtn.getAttribute("data-tooltip");
					if (!text) return;
					globalHelpTooltip.textContent = text;
					globalHelpTooltip.style.display = "";
					globalHelpTooltip.style.visibility = "hidden";
					globalHelpTooltip?.classList.add("visible");
					const btnRect = helpBtn.getBoundingClientRect();
					const gap = 6;
					const tooltipHeight = globalHelpTooltip.offsetHeight;
					const tooltipWidth = globalHelpTooltip.offsetWidth;
					let left = btnRect.left;
					let top = btnRect.bottom + gap;
					if (left + tooltipWidth > window.innerWidth - 8) left = Math.max(8, btnRect.right - tooltipWidth);
					if (top + tooltipHeight > window.innerHeight - 8) top = btnRect.top - tooltipHeight - gap;
					globalHelpTooltip.style.left = left + "px";
					globalHelpTooltip.style.top = top + "px";
					globalHelpTooltip.style.visibility = "";
					globalHelpTooltip.classList.remove("visible");
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							globalHelpTooltip?.classList.add("visible");
						});
					});
				};
				const hideTooltip = () => {
					if (globalHelpTooltip) {
						globalHelpTooltip.classList.remove("visible");
						globalHelpTooltip.style.display = "none";
					}
				};
				helpBtn.addEventListener("mouseenter", showTooltip);
				helpBtn.addEventListener("mouseleave", hideTooltip);
				helpBtn.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
				});
			});
			const incomingHintInput = panel.querySelector(".sfp-incoming-hint-input");
			if (incomingHintInput) _bindCheckboxSetting(incomingHintInput, (checked) => {
				updatePreference("showIncomingHint", checked);
				_syncSettingsPanelState(wrapper);
				_syncSidebarIncomingTracking();
				_syncHeadActionState();
				if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) _queueSidebarIncomingApply();
			});
			const hidePinnedInput = panel.querySelector(".sfp-hide-pinned-input");
			if (hidePinnedInput) _bindCheckboxSetting(hidePinnedInput, (checked) => {
				updatePreference("hidePinned", checked);
				_syncSettingsPanelState(wrapper);
				_resetAutoLoadState();
				loadTopics();
			});
			const autoSilentInput = panel.querySelector(".sfp-auto-silent-input");
			const silentIntervalInput = panel.querySelector(".sfp-auto-silent-refresh-interval-input");
			if (autoSilentInput) _bindCheckboxSetting(autoSilentInput, (checked) => {
				updatePreference("autoSilentRefreshEnabled", checked);
				_syncSettingsPanelState(wrapper);
				_syncSidebarIncomingTracking();
				_startAutoSilentRefresh();
				_syncHeadActionState();
				if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) _queueSidebarIncomingApply();
			});
			_bindNumberSetting(silentIntervalInput, 0, 0, (seconds) => {
				updatePreference("autoSilentRefreshInterval", seconds);
				_startAutoSilentRefresh();
				_syncHeadActionState();
				if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) _queueSidebarIncomingApply();
			});
			const autoRefreshInput = panel.querySelector(".sfp-auto-refresh-input");
			const intervalRow = panel.querySelector(".sfp-auto-refresh-interval");
			const intervalInput = panel.querySelector(".sfp-auto-refresh-interval-input");
			if (autoRefreshInput) _bindCheckboxSetting(autoRefreshInput, (checked) => {
				updatePreference("autoRefreshEnabled", checked);
				intervalRow?.classList.toggle("visible", prefs.autoRefreshEnabled);
				_syncSettingsPanelHeight(wrapper);
				_startAutoRefresh();
				_syncHeadActionState();
			});
			_bindNumberSetting(intervalInput, 1, 10, (seconds) => {
				updatePreference("autoRefreshInterval", seconds);
				_startAutoRefresh();
				_syncHeadActionState();
			});
			shell.appendChild(btn);
			shell.appendChild(panel);
			wrapper.appendChild(shell);
			_syncSettingsPanelState(wrapper);
			return wrapper;
		}
		function _buildSettingLabelHtml(label, tooltip) {
			return `
      <span class="sfp-setting-label">
        <span>${escapeHtml(label)}</span>
        <span class="sfp-setting-help-wrap">
          <button type="button" class="sfp-setting-help" aria-label="${escapeHtml(label + t("helpSuffix"))}" data-tooltip="${escapeHtml(tooltip)}">
            <svg viewBox="0 0 1024 1024" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M514.048 54.272q95.232 0 178.688 36.352t145.92 98.304 98.304 145.408 35.84 178.688-35.84 178.176-98.304 145.408-145.92 98.304-178.688 35.84-178.176-35.84-145.408-98.304-98.304-145.408-35.84-178.176 35.84-178.688 98.304-145.408 145.408-98.304 178.176-36.352zM515.072 826.368q26.624 0 44.544-17.92t17.92-43.52q0-26.624-17.92-44.544t-44.544-17.92-44.544 17.92-17.92 44.544q0 25.6 17.92 43.52t44.544 17.92zM567.296 574.464q-1.024-16.384 20.48-34.816t48.128-40.96 49.152-50.688 24.576-65.024q2.048-39.936-8.192-74.752t-33.792-59.904-60.928-39.936-87.552-14.848q-62.464 0-103.936 22.016t-67.072 53.248-35.84 64.512-9.216 55.808q1.024 26.624 16.896 38.912t34.304 12.8 33.792-10.24 15.36-31.232q0-12.288 7.68-30.208t20.992-34.304 32.256-27.648 42.496-11.264q46.08 0 73.728 23.04t25.6 57.856q0 17.408-10.24 32.256t-26.112 28.672-33.792 27.648-33.792 28.672-26.624 32.256-11.776 37.888l1.024 38.912q0 15.36 14.336 29.184t37.888 14.848q23.552-1.024 37.376-15.36t12.8-32.768l0-24.576z"></path></svg>
          </button>
        </span>
      </span>
    `;
		}
		function _syncSettingsPanelState(wrapper) {
			const panel = wrapper?.querySelector(".sfp-settings-panel");
			if (!panel) return;
			const incomingHintInput = panel.querySelector(".sfp-incoming-hint-input");
			const hidePinnedInput = panel.querySelector(".sfp-hide-pinned-input");
			const autoSilentInput = panel.querySelector(".sfp-auto-silent-input");
			const autoSilentRow = panel.querySelector(".sfp-auto-silent-row");
			const autoSilentIntervalRow = panel.querySelector(".sfp-auto-silent-interval");
			const autoRefreshInput = panel.querySelector(".sfp-auto-refresh-input");
			const autoRefreshIntervalRow = panel.querySelector(".sfp-auto-refresh-interval");
			if (incomingHintInput) incomingHintInput.checked = prefs.showIncomingHint;
			if (hidePinnedInput) hidePinnedInput.checked = prefs.hidePinned;
			if (autoSilentInput) autoSilentInput.checked = prefs.autoSilentRefreshEnabled;
			if (autoRefreshInput) autoRefreshInput.checked = prefs.autoRefreshEnabled;
			if (autoSilentRow) autoSilentRow.classList.remove("hidden");
			if (autoSilentIntervalRow) {
				autoSilentIntervalRow.classList.remove("hidden");
				autoSilentIntervalRow.classList.toggle("visible", prefs.autoSilentRefreshEnabled);
			}
			if (autoRefreshIntervalRow) autoRefreshIntervalRow.classList.toggle("visible", prefs.autoRefreshEnabled);
			_syncSettingsPanelHeight(wrapper);
		}
		function _syncSettingsPanelHeight(wrapper) {
			const shell = wrapper?.querySelector(".sfp-settings-shell");
			const panel = wrapper?.querySelector(".sfp-settings-panel");
			if (!shell || !panel) return;
			requestAnimationFrame(() => {
				const contentBottom = Array.from(panel.children).filter((child) => {
					return child instanceof HTMLElement && getComputedStyle(child).display !== "none";
				}).reduce((bottom, row) => {
					return Math.max(bottom, row.offsetTop + row.offsetHeight);
				}, 28);
				const panelStyle = getComputedStyle(panel);
				const paddingBottom = Number.parseFloat(panelStyle.paddingBottom) || 0;
				const height = Math.max(28, Math.ceil(contentBottom + paddingBottom));
				shell.style.setProperty("--sfp-settings-shell-height", `${height}px`);
			});
		}
		function _bindCheckboxSetting(input, onChange) {
			if (!input) return;
			input.addEventListener("change", () => onChange(input.checked));
		}
		function _bindNumberSetting(input, min, fallback, onChange, max = Infinity) {
			if (!input) return;
			input.addEventListener("change", () => {
				const nextValue = clampNumber(input.value, min, max, fallback);
				input.value = String(nextValue);
				onChange(nextValue);
			});
		}
		function _buildCustomSelect(options, selectedValue, onChange) {
			const safeOptions = options.length ? options : [{
				label: "",
				value: selectedValue || ""
			}];
			const wrapper = document.createElement("span");
			wrapper.className = "sfp-custom-select";
			const btn = document.createElement("button");
			btn.className = "sfp-custom-select-btn";
			btn.type = "button";
			btn.textContent = (safeOptions.find((o) => o.value === selectedValue) || safeOptions[0]).label;
			const dropdown = document.createElement("div");
			dropdown.className = "sfp-custom-select-dropdown";
			let _currentSelected = selectedValue;
			safeOptions.forEach((opt) => {
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
			});
			wrapper.appendChild(btn);
			wrapper.appendChild(dropdown);
			return wrapper;
		}
		function _buildTabBar() {
			const shell = document.createElement("div");
			shell.className = "sfp-tab-shell";
			const bar = document.createElement("div");
			bar.className = "sfp-tab-bar";
			const moreBtn = document.createElement("button");
			moreBtn.type = "button";
			moreBtn.className = "sfp-tab-more-btn";
			moreBtn.title = t("tabMore");
			moreBtn.setAttribute("aria-label", t("tabMore"));
			moreBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M7 10a2 2 0 1 1 .01 0H7zm5 0a2 2 0 1 1 .01 0H12zm5 0a2 2 0 1 1 .01 0H17zM7 16a2 2 0 1 1 .01 0H7zm5 0a2 2 0 1 1 .01 0H12zm5 0a2 2 0 1 1 .01 0H17z"/></svg>`;
			const panel = document.createElement("div");
			panel.className = "sfp-tab-panel";
			panel.innerHTML = `
      <div class="sfp-tab-panel-header">
        <span class="sfp-tab-panel-title">
          <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M10 4h10v2H10V4zM4 3.5h4v3H4v-3zM10 11h10v2H10v-2zM4 10.5h4v3H4v-3zM10 18h10v2H10v-2zM4 17.5h4v3H4v-3z"/></svg>
          <span>${escapeHtml(t("tabPanelTitle"))}</span>
        </span>
        <button type="button" class="sfp-tab-panel-close" title="${escapeAttr(t("close"))}" aria-label="${escapeAttr(t("close"))}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5z"/></svg>
        </button>
      </div>
      <div class="sfp-tab-grid"></div>
    `;
			const grid = panel.querySelector(".sfp-tab-grid");
			const allTab = document.createElement("span");
			allTab.className = "sfp-tab-item" + (prefs.currentTab === "all" ? " active" : "");
			allTab.dataset.tab = "all";
			allTab.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg><span>${escapeHtml(t("all"))}</span>`;
			bar.appendChild(allTab);
			const allGridItem = document.createElement("span");
			allGridItem.className = "sfp-tab-grid-item" + (prefs.currentTab === "all" ? " active" : "");
			allGridItem.dataset.tab = "all";
			allGridItem.innerHTML = allTab.innerHTML;
			grid.appendChild(allGridItem);
			_getOrderedTabCategories().forEach((cat) => {
				const tab = document.createElement("span");
				tab.className = "sfp-tab-item" + (prefs.currentTab === cat.tabId ? " active" : "");
				tab.dataset.tab = cat.tabId;
				tab.dataset.categoryId = String(cat.id);
				tab.innerHTML = _buildCategoryTabContent(cat);
				bar.appendChild(tab);
				const gridItem = document.createElement("span");
				gridItem.className = "sfp-tab-grid-item" + (prefs.currentTab === cat.tabId ? " active" : "");
				gridItem.draggable = true;
				gridItem.dataset.tab = cat.tabId;
				gridItem.dataset.categoryId = String(cat.id);
				gridItem.title = getCategoryTabMeta(cat).name;
				gridItem.innerHTML = _buildCategoryTabContent(cat);
				grid.appendChild(gridItem);
			});
			shell.addEventListener("click", (e) => {
				e.stopPropagation();
				_closeFloatingPanels(shell);
				if (closestTarget(e, ".sfp-tab-panel-close")) {
					e.stopPropagation();
					shell.classList.remove("open");
					return;
				}
				if (closestTarget(e, ".sfp-tab-more-btn")) {
					e.stopPropagation();
					shell.classList.toggle("open", !shell.classList.contains("open"));
					return;
				}
				const tab = closestTarget(e, ".sfp-tab-item, .sfp-tab-grid-item");
				if (!tab) return;
				const tabId = tab.dataset.tab || "all";
				const catId = tab.dataset.categoryId ? Number(tab.dataset.categoryId) : null;
				const fromGrid = tab.classList.contains("sfp-tab-grid-item");
				if (tabId === prefs.currentTab && catId === getCategoryId()) {
					if (fromGrid) {
						shell.classList.remove("open");
						_scrollTabIntoView(shell, tabId, "smooth");
					}
					return;
				}
				updatePreference("currentTab", tabId);
				setCategoryId(catId);
				_beginSidebarIncomingViewSettling();
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
				const item = closestTarget(e, ".sfp-tab-grid-item[data-category-id]");
				if (!item) return;
				dragItem = item;
				tabOrderChanged = false;
				item.classList.add("dragging");
				if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
				e.dataTransfer?.setData("text/plain", item.dataset.categoryId || "");
			});
			grid.addEventListener("dragover", (e) => {
				if (!dragItem) return;
				const target = closestTarget(e, ".sfp-tab-grid-item[data-category-id]");
				if (!target || target === dragItem) return;
				e.preventDefault();
				grid.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
				target.classList.add("drop-target");
				const rect = target.getBoundingClientRect();
				const nextNode = e.clientY < rect.top + rect.height / 2 ? target : target.nextSibling;
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
			const scrollLeft = oldShell.querySelector(".sfp-tab-bar")?.scrollLeft || 0;
			const keepOpen = options.keepOpen ?? oldShell.classList.contains("open");
			const newShell = _buildTabBar();
			if (keepOpen) newShell.classList.add("open");
			oldShell.replaceWith(newShell);
			const newBar = newShell.querySelector(".sfp-tab-bar");
			if (options.scrollTabId) requestAnimationFrame(() => {
				_scrollTabIntoView(newShell, options.scrollTabId || void 0, options.scrollBehavior || "auto");
			});
			else if (newBar) newBar.scrollLeft = scrollLeft;
			return newShell;
		}
		function _buildFilterBar() {
			const bar = document.createElement("div");
			bar.className = "sfp-filter-bar";
			_getFilterOptions().forEach((f) => {
				const item = document.createElement("span");
				item.className = "sfp-filter-item" + (prefs.currentFilter === f.value ? " active" : "");
				item.dataset.filter = f.value;
				item.textContent = f.label;
				bar.appendChild(item);
			});
			bar.addEventListener("click", (e) => {
				const item = closestTarget(e, ".sfp-filter-item");
				if (!item) return;
				const filterVal = item.dataset.filter || "all";
				if (filterVal === prefs.currentFilter) return;
				updatePreference("currentFilter", filterVal);
				_beginSidebarIncomingViewSettling();
				_syncDefaultViewControls();
				_resetAutoLoadState();
				bar.querySelectorAll(".sfp-filter-item[data-filter]").forEach((i) => i.classList.remove("active"));
				item.classList.add("active");
				renderTopics();
				_finishSidebarIncomingViewSettling();
			});
			return bar;
		}
		function _refreshCategoryTabs() {
			const shell = host.feedContainer?.querySelector(".sfp-tab-shell");
			if (!shell) return;
			const scrollTabId = pendingTabBarScrollTab;
			pendingTabBarScrollTab = null;
			_rerenderTabBar(shell, {
				scrollTabId,
				scrollBehavior: scrollTabId ? "smooth" : "auto"
			});
		}
		function _updateSettingsControl() {
			if (!host.feedHeaderEl) return;
			const oldSettings = host.feedHeaderEl.querySelector(".sfp-settings-wrap");
			if (!oldSettings) return;
			if (!!oldSettings.querySelector(".sfp-incoming-hint-row") === _isLatestActivityView()) {
				_syncSettingsPanelState(oldSettings);
				return;
			}
			const isOpen = oldSettings.classList.contains("open");
			const nextSettings = _buildSettingsControl();
			if (isOpen) nextSettings.classList.add("open");
			oldSettings.replaceWith(nextSettings);
		}
		function _formatIncomingCount(count) {
			return count > 999 ? "999" : String(count);
		}
		function _refreshIconHtml() {
			return `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
		}
		function _backTopIconHtml() {
			return `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12 5.5 5.5 12l1.4 1.4 4.1-4.1V20h2V9.3l4.1 4.1 1.4-1.4L12 5.5z"/></svg>`;
		}
		function _playBackTopEnterAnimation() {
			if (!feedRefreshBtn) return;
			if (feedRefreshBtn.classList.contains("sfp-back-top-enter")) return;
			feedRefreshBtn.classList.add("sfp-back-top-enter");
			setTimeout(() => {
				feedRefreshBtn?.classList.remove("sfp-back-top-enter");
			}, 220);
		}
		function start() {
			if (globalHelpTooltip) return;
			globalHelpTooltip = document.createElement("div");
			globalHelpTooltip.className = "sfp-help-tooltip";
			globalHelpTooltip.setAttribute("role", "tooltip");
			globalHelpTooltip.style.display = "none";
			document.body.append(globalHelpTooltip);
		}
		function reset() {
			_closeFloatingPanels();
			feedRefreshBtn = null;
			pendingTabBarScrollTab = null;
		}
		function dispose() {
			reset();
			globalHelpTooltip?.remove();
			globalHelpTooltip = null;
		}
		function renderHeadAction(isAway, isBusy, incomingCount) {
			if (!feedRefreshBtn) return;
			const showsCount = incomingCount > 0;
			const nextAction = showsCount ? "incoming" : isAway && !isBusy ? "back-top" : "refresh";
			const currentAction = feedRefreshBtn.dataset.action || "";
			const nextIncomingCount = showsCount ? String(incomingCount) : "";
			const shouldUpdateActionHtml = currentAction !== nextAction || showsCount && feedRefreshBtn.dataset.incomingCount !== nextIncomingCount;
			const nextTitle = showsCount ? t("applyIncoming", { count: incomingCount }) : nextAction === "back-top" ? t("backToTop") : t("refresh");
			const nextHtml = showsCount ? `<span class="sfp-refresh-count">${escapeHtml(_formatIncomingCount(incomingCount))}</span>` : nextAction === "back-top" ? _backTopIconHtml() : _refreshIconHtml();
			feedRefreshBtn.classList.toggle("sfp-away-from-head", isAway);
			feedRefreshBtn.classList.toggle("sfp-has-incoming-count", showsCount);
			if (currentAction !== nextAction) feedRefreshBtn.dataset.action = nextAction;
			if (nextIncomingCount) feedRefreshBtn.dataset.incomingCount = nextIncomingCount;
			else delete feedRefreshBtn.dataset.incomingCount;
			if (feedRefreshBtn.title !== nextTitle) {
				feedRefreshBtn.title = nextTitle;
				feedRefreshBtn.setAttribute("aria-label", nextTitle);
			}
			if (shouldUpdateActionHtml) {
				feedRefreshBtn.innerHTML = nextHtml;
				if (nextAction === "back-top") _playBackTopEnterAnimation();
			}
			if (nextAction !== "back-top") feedRefreshBtn.classList.remove("sfp-back-top-enter");
		}
		function setBusy(isBusy) {
			if (!feedRefreshBtn) return false;
			const wasBusy = feedRefreshBtn.classList.contains("spinning");
			feedRefreshBtn.classList.toggle("spinning", isBusy);
			feedRefreshBtn.setAttribute("aria-busy", String(isBusy));
			return wasBusy && !isBusy;
		}
		return {
			start,
			reset,
			dispose,
			renderHeadAction,
			setBusy,
			get feedRefreshBtn() {
				return feedRefreshBtn;
			},
			_getOrderOptions,
			_getPeriodOptions,
			_getFilterOptions,
			_closeFloatingPanels,
			_buildHeaderControls,
			_buildTabBar,
			_rerenderTabBar,
			_buildFilterBar,
			_refreshCategoryTabs,
			_updateSettingsControl
		};
	}
	function createFeedHost({ t, getEnabled, getWidth, onToggle, onWidth, getScope }) {
		let toggleBtn = null;
		let resizerEl = null;
		let isResizing = false;
		let originalSidebarWidthBeforeFeed = null;
		let widthAnimationTimer = null;
		let feedContainer = null;
		let feedHeaderEl = null;
		let feedScrollEl = null;
		let feedListEl = null;
		const requestAnimationFrame = (fn) => getScope().frame(fn);
		const setTimeout = (fn, ms) => getScope().timeout(fn, ms);
		function createToggle() {
			if (toggleBtn?.isConnected) return toggleBtn;
			toggleBtn?.remove();
			const homeLogo = document.querySelector(".home-logo-wrapper-outlet");
			if (!homeLogo) return null;
			toggleBtn = document.createElement("button");
			toggleBtn.className = "sfp-toggle-btn" + (getEnabled() ? " active" : "");
			toggleBtn.title = t("toggleTitle");
			toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="18" rx="1" fill="currentColor" opacity="0.6"/><rect x="13" y="3" width="8" height="18" rx="1" fill="currentColor"/></svg>`;
			toggleBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				e.preventDefault();
				onToggle();
				toggleBtn?.classList.toggle("active", getEnabled());
			});
			const titleEl = homeLogo.querySelector(".title");
			if (titleEl) titleEl.appendChild(toggleBtn);
			else homeLogo.appendChild(toggleBtn);
			return toggleBtn;
		}
		function getMinSidebarWidth() {
			return 272;
		}
		function getSidebarElement() {
			return document.querySelector("#d-sidebar") || document.querySelector(".sidebar-container");
		}
		function applySidebarWidth(width) {
			const clampedWidth = Math.min(500, Math.max(getMinSidebarWidth(), width));
			const sidebar = getSidebarElement();
			if (sidebar) sidebar.style.setProperty("width", clampedWidth + "px", "important");
			document.documentElement.style.setProperty("--d-sidebar-width", clampedWidth + "px");
		}
		function getSidebarWidthTransitionElements(sidebar) {
			return [sidebar, sidebar?.classList?.contains("sidebar-wrapper") ? sidebar : sidebar?.closest(".sidebar-wrapper")].filter((el) => !!el);
		}
		function setSidebarWidthForAnimation(sidebar, width, { enforceMin = true } = {}) {
			const minWidth = enforceMin ? getMinSidebarWidth() : 0;
			const clampedWidth = Math.min(500, Math.max(minWidth, width));
			sidebar.style.setProperty("width", clampedWidth + "px", "important");
			document.documentElement.style.setProperty("--d-sidebar-width", clampedWidth + "px");
		}
		function animateSidebarWidth(targetWidth, { cleanupAfter = false, enforceMin = true } = {}) {
			const sidebar = getSidebarElement();
			if (!sidebar) return;
			if (widthAnimationTimer) {
				getScope().clearTimeout(widthAnimationTimer);
				widthAnimationTimer = null;
			}
			const startWidth = sidebar.getBoundingClientRect().width || 272;
			const minWidth = enforceMin ? getMinSidebarWidth() : 0;
			const clampedTarget = Math.min(500, Math.max(minWidth, targetWidth));
			const transitionEls = getSidebarWidthTransitionElements(sidebar);
			setSidebarWidthForAnimation(sidebar, startWidth, { enforceMin: false });
			transitionEls.forEach((el) => el.classList.add("sfp-width-animating"));
			requestAnimationFrame(() => {
				setSidebarWidthForAnimation(sidebar, clampedTarget, { enforceMin });
				widthAnimationTimer = setTimeout(() => {
					widthAnimationTimer = null;
					transitionEls.forEach((el) => el.classList.remove("sfp-width-animating"));
					if (cleanupAfter) restoreSidebarWidth();
				}, 260);
			});
		}
		function restoreSidebarWidth() {
			const sidebar = getSidebarElement();
			if (sidebar) {
				sidebar.style.removeProperty("width");
				getSidebarWidthTransitionElements(sidebar).forEach((el) => el.classList.remove("sfp-width-animating"));
			}
			document.documentElement.style.removeProperty("--d-sidebar-width");
		}
		function setupResizer() {
			const sidebar = getSidebarElement();
			if (!sidebar) return;
			if (resizerEl && !sidebar.contains(resizerEl)) {
				resizerEl.remove();
				resizerEl = null;
			}
			if (resizerEl) return;
			resizerEl = sidebar.querySelector(":scope > .sfp-resizer") || document.createElement("div");
			resizerEl.className = "sfp-resizer";
			if (!resizerEl.parentElement) sidebar.appendChild(resizerEl);
			resizerEl.addEventListener("mousedown", (e) => {
				if (isResizing) return;
				e.preventDefault();
				e.stopPropagation();
				isResizing = true;
				const startX = e.clientX;
				const startWidth = sidebar.offsetWidth;
				let finalWidth = getWidth();
				resizerEl?.classList.add("sfp-resizing");
				getSidebarWidthTransitionElements(sidebar).forEach((el) => el.classList.remove("sfp-width-animating"));
				document.body.style.cursor = "ew-resize";
				document.body.style.userSelect = "none";
				const onMouseMove = (e) => {
					if (!isResizing) return;
					const delta = e.clientX - startX;
					const newWidth = Math.min(500, Math.max(getMinSidebarWidth(), startWidth + delta));
					applySidebarWidth(newWidth);
					finalWidth = newWidth;
				};
				const onMouseUp = () => {
					onWidth(finalWidth);
					cleanup();
					forget();
				};
				const removeMove = getScope().listen(document, "mousemove", onMouseMove);
				const removeUp = getScope().listen(document, "mouseup", onMouseUp);
				const cleanup = () => {
					isResizing = false;
					resizerEl?.classList.remove("sfp-resizing");
					document.body.style.cursor = "";
					document.body.style.userSelect = "";
					removeMove();
					removeUp();
				};
				const forget = getScope().defer(cleanup);
			});
		}
		function removeResizer() {
			if (resizerEl) {
				resizerEl.remove();
				resizerEl = null;
			}
			getSidebarElement()?.querySelectorAll(":scope > .sfp-resizer").forEach((el) => el.remove());
		}
		function ensure() {
			const sidebar = getSidebarElement();
			if (!sidebar) return;
			if (!sidebar.classList.contains("sfp-feed-mode") || originalSidebarWidthBeforeFeed === null) originalSidebarWidthBeforeFeed = sidebar.getBoundingClientRect().width || 272;
			sidebar.classList.add("sfp-feed-mode");
			animateSidebarWidth(getWidth());
			setupResizer();
		}
		function mount(buildHeader, buildTabs, buildFilter) {
			const sidebar = getSidebarElement();
			if (!sidebar) return false;
			feedContainer = document.createElement("div");
			feedContainer.className = "sfp-feed-container";
			feedHeaderEl = document.createElement("div");
			feedHeaderEl.className = "sfp-feed-header";
			buildHeader(feedHeaderEl);
			feedContainer.append(feedHeaderEl, buildTabs(), buildFilter());
			feedScrollEl = document.createElement("div");
			feedScrollEl.className = "sfp-feed-scroll";
			const wrapper = document.createElement("div");
			wrapper.className = "sfp-content-wrapper";
			feedListEl = document.createElement("div");
			feedListEl.className = "sfp-topic-list";
			wrapper.append(feedListEl);
			feedScrollEl.append(wrapper);
			feedContainer.append(feedScrollEl);
			sidebar.append(feedContainer);
			ensure();
			return true;
		}
		function unmount() {
			feedContainer?.remove();
			feedContainer = feedHeaderEl = feedScrollEl = feedListEl = null;
			getSidebarElement()?.classList.remove("sfp-feed-mode");
			removeResizer();
			animateSidebarWidth(originalSidebarWidthBeforeFeed || 272, {
				cleanupAfter: true,
				enforceMin: false
			});
			originalSidebarWidthBeforeFeed = null;
		}
		function dispose() {
			toggleBtn?.remove();
			toggleBtn = null;
			unmount();
			restoreSidebarWidth();
		}
		return {
			createToggle,
			getSidebarElement,
			removeResizer,
			restoreSidebarWidth,
			ensure,
			mount,
			unmount,
			dispose,
			get feedContainer() {
				return feedContainer;
			},
			get feedHeaderEl() {
				return feedHeaderEl;
			},
			get feedScrollEl() {
				return feedScrollEl;
			},
			get feedListEl() {
				return feedListEl;
			},
			get resizerEl() {
				return resizerEl;
			}
		};
	}
	function createFeedScroll(callbacks) {
		let release;
		function dispose() {
			release?.();
			release = void 0;
		}
		function bind(element) {
			dispose();
			if (!element) return;
			let timer;
			const onLoadScroll = () => {
				clearTimeout(timer);
				timer = setTimeout(() => {
					timer = void 0;
					if (!callbacks.canLoadMore()) return;
					const { scrollTop, scrollHeight, clientHeight } = element;
					if (scrollHeight - scrollTop - clientHeight < 200) callbacks.onLoadMore();
				}, 300);
			};
			element.addEventListener("scroll", callbacks.onReadingState, { passive: true });
			element.addEventListener("scroll", onLoadScroll, { passive: true });
			release = () => {
				clearTimeout(timer);
				element.removeEventListener("scroll", callbacks.onReadingState);
				element.removeEventListener("scroll", onLoadScroll);
			};
		}
		return {
			bind,
			dispose
		};
	}
	function _topicBaseUrl(topic) {
		return `/t/${topic.slug || "topic"}/${topic.id}`;
	}
	function _isPinnedTopic(topic) {
		return !!(topic && (topic.pinned || topic.pinned_globally));
	}
	function _hasLastReadPostNumber(topic) {
		return topic.last_read_post_number !== null && topic.last_read_post_number !== void 0 && topic.last_read_post_number !== "";
	}
	function _topicListUrl(topic) {
		const baseUrl = _topicBaseUrl(topic);
		if (!_hasLastReadPostNumber(topic)) return baseUrl;
		const lastRead = Number(topic.last_read_post_number);
		const highest = Number(topic.highest_post_number);
		if (!Number.isFinite(lastRead)) return baseUrl;
		let postNumber = lastRead + 1;
		if (Number.isFinite(highest) && postNumber > highest) postNumber = highest;
		if (postNumber < 1) postNumber = 1;
		return `${baseUrl}/${postNumber}`;
	}
	function _isTopicRead(topic) {
		if (!topic || !topic.id) return false;
		const baseUrl = _topicBaseUrl(topic);
		const url = _topicListUrl(topic);
		return url !== baseUrl && url.startsWith(`${baseUrl}/`);
	}
	function _hasUnreadMarker(topic) {
		return !_isTopicRead(topic);
	}
	function _applyReadMarker(topic) {
		topic.unread_posts = 0;
		topic.new_posts = 0;
		topic.unseen = false;
		topic.is_seen = true;
		if (topic.highest_post_number) topic.last_read_post_number = topic.highest_post_number;
	}
	function createTopicRenderer({ t, formatRelativeTime, site, tags, discourse, getUser, markTopicAsRead, getScope }) {
		const { _getCategoryMeta } = site;
		const { _tagDisplayName, _getTagStyle } = tags;
		const { toAbsoluteSiteUrl, getAvatarUrl, getUserProfileUrl, handlePointerNavigation } = discourse;
		const topicHighlightTimers = new WeakMap();
		const setTimeout = (fn, delay) => getScope().timeout(fn, delay);
		function _triggerTopicHighlight(item) {
			if (!item) return;
			const oldTimer = topicHighlightTimers.get(item);
			if (oldTimer) getScope().clearTimeout(oldTimer);
			item.classList.remove("sfp-new-highlight");
			item.offsetWidth;
			item.classList.add("sfp-new-highlight");
			const timer = setTimeout(() => {
				item.classList.remove("sfp-new-highlight");
				topicHighlightTimers.delete(item);
			}, 1e4);
			topicHighlightTimers.set(item, timer);
		}
		function _topicStatsHtml(topic) {
			const replies = Math.max(0, (topic.posts_count || 1) - 1);
			const views = (topic.views || 0) >= 1e3 ? ((topic.views || 0) / 1e3).toFixed(1) + "k" : topic.views || 0;
			const likes = topic.like_count || 0;
			return `
        <span class="sfp-topic-stat">${_svgIcon("comment")} ${replies}</span>
        <span class="sfp-topic-stat">${_svgIcon("far-eye")} ${views}</span>
        <span class="sfp-topic-stat">${_svgIcon("heart")} ${likes}</span>
      `;
		}
		function _topicStatusBadgesHtml(topic) {
			const statusBadges = [];
			if (topic.is_hot) statusBadges.push(`<span class="topic-status-card --hot"><svg class="fa d-icon d-icon-fire svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire"></use></svg><p class="topic-status-card__name">${escapeHtml(t("hot"))}</p></span>`);
			if (topic.pinned || topic.pinned_globally) statusBadges.push(`<span class="topic-status-card --pinned"><svg class="fa d-icon d-icon-thumbtack svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#thumbtack"></use></svg><p class="topic-status-card__name">${escapeHtml(t("pinned"))}</p></span>`);
			if (_isTopicUnavailable(topic)) statusBadges.push(`<span class="topic-status-card --unavailable" title="${escapeAttr(t("topicUnavailableTip"))}">${_svgIcon("far-eye-slash")}<p class="topic-status-card__name">${escapeHtml(t("topicUnavailable"))}</p></span>`);
			return statusBadges.length ? `<span class="sfp-topic-status-badges">${statusBadges.join("")}</span>` : "";
		}
		function _topicTimeHtml(topic) {
			return `${formatRelativeTime(topic.bumped_at || topic.last_posted_at || topic.created_at)}${`<span class="${_hasUnreadMarker(topic) ? "sfp-unread-dot" : "sfp-unread-dot sfp-unread-dot--hidden"}" aria-hidden="true"></span>`}`;
		}
		function _isTopicUnavailable(topic) {
			return !!topic?.sfpUnavailable;
		}
		function _buildCategoryBadge(categoryId) {
			const meta = _getCategoryMeta(categoryId);
			if (!meta?.name) return "";
			const styleParts = [`--category-badge-color: #${_normalizeHexColor(meta.color, "888")}`, `--category-badge-text-color: #${_normalizeHexColor(meta.text_color, "FFFFFF")}`];
			if (meta.parent_category_id && meta.parent_color) {
				styleParts.push(`--parent-category-badge-color: #${_normalizeHexColor(meta.parent_color, "888")}`);
				styleParts.push(`--parent-category-badge-text-color: #${_normalizeHexColor(meta.parent_text_color, "FFFFFF")}`);
			}
			const styleType = _safeCategoryStyleType(meta.style_type, !!meta.icon);
			const categoryClasses = ["badge-category"];
			if (meta.read_restricted) categoryClasses.push("restricted");
			if (meta.parent_category_id) categoryClasses.push("--has-parent");
			categoryClasses.push(`--style-${styleType}`);
			const dataParent = meta.parent_category_id ? ` data-parent-category-id="${Number(meta.parent_category_id)}"` : "";
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
			const classes = [
				"discourse-tag",
				"box",
				"sfp-tag"
			];
			if (tagStyle?.hasIcon) classes.push("discourse-tag--tag-icons-style");
			const styleAttr = tagStyle?.cssText ? ` style="${tagStyle.cssText}"` : "";
			const iconHtml = tagStyle?.hasIcon ? `<span class="tag-icon">${_svgIcon(tagStyle.icon)}</span>` : "";
			return `<span class="${classes.join(" ")}"${styleAttr}>${iconHtml}${escapeHtml(tagName)}</span>`;
		}
		function createTopicItem(topic, isNew = false) {
			const item = document.createElement("a");
			const targetUrl = _topicListUrl(topic);
			item.className = "sfp-topic-item";
			item.href = toAbsoluteSiteUrl(targetUrl);
			item.dataset.topicId = String(topic.id);
			if (topic.pinned || topic.pinned_globally) item.classList.add("sfp-pinned");
			if (_isTopicRead(topic)) item.classList.add("sfp-read");
			if (_isTopicUnavailable(topic)) item.classList.add("sfp-topic-unavailable");
			if (isNew) _triggerTopicHighlight(item);
			let avatarUrl = "";
			let name = "";
			let username = "";
			let userProfileUrl = "";
			if (topic.posters && topic.posters.length > 0) {
				const userId = topic.posters[0].user_id;
				const user = getUser(userId);
				if (user) {
					name = user.name || "";
					username = user.username || "";
					userProfileUrl = getUserProfileUrl(username);
					if (user.avatar_template) avatarUrl = getAvatarUrl(user.avatar_template, 45);
				}
			}
			const avatarHtml = userProfileUrl && avatarUrl ? `<span class="sfp-topic-user-link sfp-topic-avatar-link" data-user-profile-url="${escapeAttr(userProfileUrl)}" data-user-profile-link="true"><img class="sfp-topic-avatar" src="${avatarUrl}" alt="${escapeHtml(username)}" loading="lazy"></span>` : avatarUrl ? `<img class="sfp-topic-avatar" src="${avatarUrl}" alt="${escapeHtml(username)}" loading="lazy">` : "";
			const displayName = name && name !== username ? userProfileUrl ? `<span class="sfp-topic-user-link sfp-topic-name" data-user-profile-url="${escapeAttr(userProfileUrl)}" data-user-profile-link="true">${escapeHtml(name)}</span>` : `<span class="sfp-topic-name">${escapeHtml(name)}</span>` : "";
			const usernameHtml = userProfileUrl ? `<span class="sfp-topic-user-link sfp-topic-username" data-user-profile-url="${escapeAttr(userProfileUrl)}" data-user-profile-link="true">${escapeHtml(username)}</span>` : `<span class="sfp-topic-username">${escapeHtml(username)}</span>`;
			const statusBadgesHtml = _topicStatusBadgesHtml(topic);
			const closedHtml = topic.closed ? `<span class="topic-statuses"><span title="${escapeAttr(t("closedTitle"))}" class="topic-status --closed"><svg class="fa d-icon d-icon-lock svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#lock"></use></svg></span></span>` : "";
			const categoryHtml = _buildCategoryBadge(topic.category_id);
			let tagsHtml = "";
			if (topic.tags && topic.tags.length > 0) tagsHtml = `<span class="sfp-topic-tags">${topic.tags.slice(0, 3).map((tag) => {
				return _buildTagBadge(tag);
			}).join("")}</span>`;
			item.innerHTML = `
      <div class="sfp-topic-header">
        ${avatarHtml}
        <div class="sfp-topic-meta-col">
          <div class="sfp-topic-user-info">
            ${displayName}
            ${usernameHtml}
          </div>
        </div>
        ${statusBadgesHtml}
        <span class="sfp-topic-time">${_topicTimeHtml(topic)}</span>
      </div>
      <div class="sfp-topic-title"><span class="sfp-topic-title-line">${closedHtml}${escapeHtml(topic.unicode_title?.trim() || topic.title)}</span></div>
      <div class="sfp-topic-category-tags">
        ${categoryHtml}
        ${tagsHtml}
      </div>
      <div class="sfp-topic-stats">
        ${_topicStatsHtml(topic)}
      </div>
    `;
			item.addEventListener("click", (e) => {
				const profileLink = closestTarget(e, "[data-user-profile-link='true']");
				if (profileLink) {
					const profileUrl = profileLink.getAttribute("data-user-profile-url") || "";
					handlePointerNavigation(e, profileUrl);
					return;
				}
				handlePointerNavigation(e, targetUrl, { onPrimaryActivate: () => markTopicAsRead(topic, item) });
			});
			item.addEventListener("auxclick", (e) => {
				const profileLink = closestTarget(e, "[data-user-profile-link='true']");
				if (profileLink) {
					const profileUrl = profileLink.getAttribute("data-user-profile-url") || "";
					handlePointerNavigation(e, profileUrl);
					return;
				}
				handlePointerNavigation(e, targetUrl, { onMiddleActivate: () => markTopicAsRead(topic, item) });
			});
			return item;
		}
		return {
			createTopicItem,
			markRead(item) {
				item.classList.add("sfp-read");
				item.querySelector(".sfp-unread-dot")?.classList.add("sfp-unread-dot--hidden");
			}
		};
	}
	function createTopicList({ getScroll, getList, getScope, syncHead, atHead, t, hasMore, loadMore, renderItem }) {
		const requestAnimationFrame = (fn) => getScope().frame(fn);
		function _captureFeedScrollAnchor() {
			const feedScrollEl = getScroll();
			const feedListEl = getList();
			if (!feedScrollEl || !feedListEl) return null;
			if (feedScrollEl.scrollTop <= 1) return null;
			const scrollRect = feedScrollEl.getBoundingClientRect();
			const items = feedListEl.querySelectorAll(".sfp-topic-item[data-topic-id]");
			for (const item of items) {
				const itemRect = item.getBoundingClientRect();
				if (itemRect.bottom > scrollRect.top + 1) return {
					topicId: item.dataset.topicId || null,
					offsetTop: itemRect.top - scrollRect.top,
					scrollTop: feedScrollEl.scrollTop,
					scrollHeight: feedScrollEl.scrollHeight
				};
			}
			return {
				topicId: null,
				offsetTop: 0,
				scrollTop: feedScrollEl.scrollTop,
				scrollHeight: feedScrollEl.scrollHeight
			};
		}
		function _restoreFeedScrollAnchor(anchor) {
			const feedScrollEl = getScroll();
			const feedListEl = getList();
			if (!anchor || !feedScrollEl || !feedListEl) return;
			const restore = () => {
				if (!feedScrollEl || !feedListEl) return;
				if (anchor.topicId) {
					const item = feedListEl.querySelector(`.sfp-topic-item[data-topic-id="${anchor.topicId}"]`);
					if (item) {
						const scrollRect = feedScrollEl.getBoundingClientRect();
						const itemRect = item.getBoundingClientRect();
						feedScrollEl.scrollTop += itemRect.top - scrollRect.top - anchor.offsetTop;
						syncHead();
						return;
					}
				}
				feedScrollEl.scrollTop = anchor.scrollTop + (feedScrollEl.scrollHeight - anchor.scrollHeight);
				syncHead();
			};
			restore();
			requestAnimationFrame(restore);
		}
		function _waitForFeedScrollHead(timeoutMs = 1200) {
			const feedScrollEl = getScroll();
			const viewScope = getScope();
			if (!feedScrollEl) return Promise.resolve("interrupted");
			if (atHead()) return Promise.resolve("reached");
			const scrollElement = feedScrollEl;
			return new Promise((resolve) => {
				let forget = () => {};
				const startedAt = Date.now();
				let settledFrames = 0;
				let done = false;
				const cleanup = () => {
					if (done) return;
					done = true;
					scrollElement.removeEventListener("scroll", onScroll);
					scrollElement.removeEventListener("wheel", onInterrupt);
					scrollElement.removeEventListener("pointerdown", onInterrupt);
					scrollElement.removeEventListener("touchstart", onInterrupt);
					window.removeEventListener("keydown", onInterrupt, true);
				};
				const finish = (result) => {
					if (done) return;
					forget();
					cleanup();
					resolve(result);
				};
				const onInterrupt = () => {
					if (feedScrollEl) feedScrollEl.scrollTo({
						top: feedScrollEl.scrollTop,
						behavior: "auto"
					});
					finish(atHead() ? "reached" : "interrupted");
				};
				const onScroll = () => {
					if (!feedScrollEl) {
						finish("interrupted");
						return;
					}
					if (atHead()) {
						settledFrames++;
						if (settledFrames >= 2) finish("reached");
					} else settledFrames = 0;
				};
				const tick = () => {
					if (done) return;
					onScroll();
					if (done) return;
					if (Date.now() - startedAt >= timeoutMs) {
						finish(atHead() ? "reached" : "timeout");
						return;
					}
					requestAnimationFrame(tick);
				};
				forget = viewScope.defer(() => finish("interrupted"));
				scrollElement.addEventListener("scroll", onScroll, { passive: true });
				scrollElement.addEventListener("wheel", onInterrupt, { passive: true });
				scrollElement.addEventListener("pointerdown", onInterrupt, { passive: true });
				scrollElement.addEventListener("touchstart", onInterrupt, { passive: true });
				window.addEventListener("keydown", onInterrupt, true);
				requestAnimationFrame(tick);
			});
		}
		function _renderPaginationFooter({ note = "" } = {}) {
			const list = getList();
			if (!list) return;
			_removePaginationFooter();
			if (note) {
				const noteEl = document.createElement("div");
				noteEl.className = "sfp-load-more-note";
				noteEl.textContent = note;
				list.appendChild(noteEl);
			}
			if (hasMore()) {
				const loadMoreEl = document.createElement("div");
				loadMoreEl.className = "sfp-load-more";
				loadMoreEl.textContent = t("loadMore");
				loadMoreEl.addEventListener("click", () => {
					loadMoreEl.remove();
					loadMore();
				});
				list.appendChild(loadMoreEl);
				return;
			}
			_appendNoMore();
		}
		function _showLoadMoreSpinner() {
			const list = getList();
			_removePaginationFooter();
			const el = document.createElement("div");
			el.className = "sfp-load-more";
			el.innerHTML = `<span class="sfp-load-more-spinner"></span>${escapeHtml(t("loading"))}`;
			if (list) list.appendChild(el);
		}
		function _removePaginationFooter() {
			getList()?.querySelectorAll(".sfp-load-more, .sfp-no-more, .sfp-load-more-note").forEach((el) => el.remove());
		}
		function _showNoMore() {
			_removePaginationFooter();
			_appendNoMore();
		}
		function _appendNoMore() {
			const list = getList();
			const el = document.createElement("div");
			el.className = "sfp-no-more";
			el.textContent = t("noMore");
			if (list) list.appendChild(el);
		}
		function _showLoadMoreError(error) {
			const list = getList();
			_removePaginationFooter();
			const el = document.createElement("div");
			el.className = "sfp-load-more sfp-load-more-error";
			el.innerHTML = `
      <span>${escapeHtml(t("requestFailed"))}</span>
      <button type="button" class="sfp-load-more-retry">${escapeHtml(t("retry"))}</button>
    `;
			el.querySelector(".sfp-load-more-retry")?.addEventListener("click", () => {
				loadMore();
			});
			if (list) list.appendChild(el);
			console.warn("[SFP] load more failed:", error);
		}
		function showMessage(message) {
			const list = getList();
			if (list) list.innerHTML = `<div class="sfp-empty">${escapeHtml(message)}</div>`;
		}
		function showLoading() {
			const list = getList();
			if (list) list.innerHTML = `<div class="sfp-loading"><div class="sfp-spinner"></div>${escapeHtml(t("loading"))}</div>`;
		}
		function showError(error, retry) {
			const list = getList();
			if (!list) return;
			list.innerHTML = `<div class="sfp-error"><div class="sfp-error-icon">!</div><div class="sfp-error-msg">${escapeHtml(t("loadFailed"))}</div><div class="sfp-error-detail">${escapeHtml(errorMessage(error))}</div><button class="sfp-retry-btn">${escapeHtml(t("retry"))}</button></div>`;
			list.querySelector(".sfp-retry-btn")?.addEventListener("click", retry);
		}
		function append(topics, highlights = []) {
			const list = getList();
			if (list) for (const topic of topics) list.append(renderItem(topic, highlights.includes(topic.id)));
		}
		function render(topics, emptyMessage, highlights) {
			const list = getList();
			if (!list) return;
			list.replaceChildren();
			if (!topics.length) showMessage(emptyMessage);
			else append(topics, highlights);
			_renderPaginationFooter();
		}
		return {
			showMessage,
			showLoading,
			showError,
			append,
			render,
			_renderPaginationFooter,
			_showLoadMoreSpinner,
			_showNoMore,
			_showLoadMoreError,
			captureAnchor: _captureFeedScrollAnchor,
			restoreAnchor: _restoreFeedScrollAnchor,
			waitForHead: _waitForFeedScrollHead
		};
	}
	function topicResponse(value) {
		const data = objectPayload(value) || {};
		const list = objectPayload(data.topic_list);
		return {
			users: Array.isArray(data.users) ? data.users.filter((user) => !!user && Number.isFinite(user.id)) : [],
			topic_list: list ? {
				topics: Array.isArray(list.topics) ? list.topics.filter((topic) => !!topic && Number.isFinite(topic.id)) : void 0,
				more_topics_url: typeof list.more_topics_url === "string" ? list.more_topics_url : null
			} : void 0
		};
	}
	function createFeedApi({ buildUrl, getCsrfToken, getSignal }) {
		async function request(url) {
			const response = await fetch(url, {
				headers: { "X-CSRF-Token": getCsrfToken() },
				signal: getSignal()
			});
			if (!response.ok) throw new Error(`API error: ${response.status}`);
			return topicResponse(await response.json());
		}
		return {
			page: (query, page) => request(buildUrl(query, page)),
			byIds(ids) {
				const unique = [...new Set(ids.map(Number).filter(Number.isFinite))];
				return unique.length ? request(`/latest.json?topic_ids=${unique.join(",")}`) : Promise.resolve(null);
			}
		};
	}
	var AutoLoadGate = class {
		now;
		key = "";
		timestamps = [];
		emptyCount = 0;
		stopped = false;
		constructor(now = Date.now) {
			this.now = now;
		}
		reset(key) {
			this.key = key;
			this.timestamps = [];
			this.emptyCount = 0;
			this.stopped = false;
		}
		ensure(key) {
			if (this.key !== key) this.reset(key);
		}
		canRun(key) {
			this.ensure(key);
			if (this.stopped) return false;
			this.timestamps = this.timestamps.filter((time) => this.now() - time < AUTO_LOAD_RATE_WINDOW_MS);
			return this.timestamps.length < 3;
		}
		recordRequest(key) {
			this.ensure(key);
			this.timestamps.push(this.now());
		}
		recordResult(key, count) {
			this.ensure(key);
			this.emptyCount = count > 0 ? 0 : this.emptyCount + 1;
			if (this.emptyCount >= 3) this.stopped = true;
		}
	};
	var IncomingTopics = class {
		candidates = [];
		candidateIds = new Set();
		cache = new Map();
		filtered = [];
		get ids() {
			return this.candidates;
		}
		get matchingIds() {
			return this.filtered;
		}
		get(id) {
			return this.cache.get(id);
		}
		clear() {
			this.candidates = [];
			this.candidateIds.clear();
			this.cache.clear();
			this.filtered = [];
		}
		touch(id, payload) {
			const numeric = Number(id);
			if (!Number.isFinite(numeric)) return false;
			if (this.candidateIds.has(numeric)) {
				const index = this.candidates.indexOf(numeric);
				if (index !== -1) this.candidates.splice(index, 1);
			} else this.candidateIds.add(numeric);
			this.candidates.push(numeric);
			if (payload) this.cache.set(numeric, {
				...this.cache.get(numeric),
				...payload,
				id: numeric
			});
			return true;
		}
		recompute(enabled, matches) {
			this.filtered = enabled ? this.candidates.filter((id) => {
				const topic = this.cache.get(id);
				return !topic || matches(topic);
			}) : [];
			return this.filtered;
		}
		loadIds(pageSize) {
			return this.filtered.slice(-Math.max(1, pageSize));
		}
		remove(ids) {
			const removed = new Set(ids.map(Number).filter(Number.isFinite));
			this.candidates = this.candidates.filter((id) => !removed.has(id));
			this.filtered = this.filtered.filter((id) => !removed.has(id));
			removed.forEach((id) => {
				this.candidateIds.delete(id);
				this.cache.delete(id);
			});
		}
	};
	var ReadingState = class {
		away = null;
		atHead(scrollTop) {
			return scrollTop <= 1;
		}
		isAway(scrollTop, viewport) {
			return !this.atHead(scrollTop) && (this.away === true || scrollTop > viewport);
		}
		reset() {
			this.away = null;
		}
	};
	var RefreshCountdown = class {
		timer = null;
		remaining = 0;
		get running() {
			return this.timer !== null;
		}
		reset(seconds) {
			this.remaining = seconds;
		}
		start(seconds, tick) {
			this.stop();
			this.reset(seconds);
			this.timer = window.setInterval(() => {
				if (--this.remaining <= 0) {
					this.reset(seconds);
					tick();
				}
			}, 1e3);
		}
		stop() {
			if (this.timer !== null) window.clearInterval(this.timer);
			this.timer = null;
		}
	};
	var PageActivity = class {
		now;
		lastActivity;
		constructor(now = Date.now) {
			this.now = now;
			this.lastActivity = now();
		}
		record = () => {
			this.lastActivity = this.now();
		};
		idle(hidden) {
			return hidden || this.now() - this.lastActivity > 6e5;
		}
		start(scope) {
			for (const event of [
				"pointerdown",
				"keydown",
				"wheel",
				"touchstart",
				"scroll"
			]) scope.listen(window, event, this.record, { passive: true });
			scope.listen(document, "visibilitychange", () => {
				if (document.visibilityState === "visible") this.record();
			});
		}
	};
	function markUnavailable(topic) {
		if (!topic || topic.sfpUnavailable) return false;
		topic.sfpUnavailable = true;
		topic.sfpUnavailablePushed = 0;
		return true;
	}
	function sortKey(topic, order) {
		if (!topic) return null;
		switch (order) {
			case "created": {
				const created = Date.parse(topic.created_at || "");
				return Number.isFinite(created) ? created : null;
			}
			case "views": return Number.isFinite(topic.views) ? topic.views : null;
			case "posts": return Number.isFinite(topic.posts_count) ? topic.posts_count : null;
			case "likes": return Number.isFinite(topic.like_count) ? topic.like_count : null;
			case "op_likes": return Number.isFinite(topic.op_like_count) ? topic.op_like_count : null;
			default: {
				const bumped = Date.parse(topic.bumped_at || "");
				return Number.isFinite(bumped) ? bumped : null;
			}
		}
	}
	function interleaveUnavailableTopics(allTopics, query, freshLength) {
		if (allTopics.length <= freshLength) return;
		const anomalies = [];
		for (let index = allTopics.length - 1; index >= freshLength; index--) if (allTopics[index]?.sfpUnavailable) anomalies.unshift(allTopics.splice(index, 1)[0]);
		if (anomalies.length === 0) return;
		const pinnedFloats = !query?.order || ["activity", "default"].includes(query.order);
		for (const anomaly of anomalies) {
			const keyValue = sortKey(anomaly, query.order);
			let insertIndex = 0;
			if (keyValue !== null) while (insertIndex < allTopics.length) {
				const resident = allTopics[insertIndex];
				if (pinnedFloats && (resident.pinned || resident.pinned_globally)) {
					insertIndex++;
					continue;
				}
				const residentKey = sortKey(resident, query.order);
				if (residentKey !== null && residentKey < keyValue) break;
				insertIndex++;
			}
			allTopics.splice(insertIndex, 0, anomaly);
		}
	}
	function detectVanishedTopics(allTopics, rawTopics, query) {
		if (!Array.isArray(rawTopics) || rawTopics.length === 0) return;
		if (allTopics.length === 0) return;
		if (_needsPeriodForUrl(query.order) && query.period !== "all") return;
		const pinnedFloats = !query.order || ["activity", "default"].includes(query.order);
		const newTopicIds = new Set(rawTopics.map((topic) => Number(topic?.id)).filter(Number.isFinite));
		let windowMinKeyValue = null;
		for (const topic of rawTopics) {
			if (pinnedFloats && (topic?.pinned || topic?.pinned_globally)) continue;
			const keyValue = sortKey(topic, query.order);
			if (keyValue === null) continue;
			if (windowMinKeyValue === null || keyValue < windowMinKeyValue) windowMinKeyValue = keyValue;
		}
		if (windowMinKeyValue === null) return;
		const candidateWindow = Math.min(rawTopics.length, allTopics.length);
		for (let index = 0; index < candidateWindow; index++) {
			const topic = allTopics[index];
			if (!topic || newTopicIds.has(Number(topic.id))) continue;
			if (pinnedFloats && (topic.pinned || topic.pinned_globally)) continue;
			if (topic.sfpUnavailable) continue;
			const keyValue = sortKey(topic, query.order);
			if (keyValue === null || keyValue <= windowMinKeyValue) continue;
			markUnavailable(topic);
		}
	}
	var ResidentTopics = class {
		retained = [];
		displayUsers = {};
		loaded = new Set();
		depth = 0;
		size = 30;
		more = true;
		get topics() {
			return this.retained;
		}
		get users() {
			return this.displayUsers;
		}
		get page() {
			return this.depth;
		}
		get pageSize() {
			return this.size;
		}
		get hasMore() {
			return this.more;
		}
		get limit() {
			return Math.max(1, this.size) * (Math.max(0, this.depth) + 1);
		}
		has(id) {
			return this.loaded.has(id);
		}
		reset({ clearUsers = true } = {}) {
			this.retained = [];
			if (clearUsers) this.displayUsers = {};
			this.loaded.clear();
			this.depth = 0;
			this.more = true;
		}
		addUsers(users = []) {
			for (const user of users) this.displayUsers[user.id] = user;
		}
		loadHead(topics, rawPageSize, moreTopicsUrl) {
			this.retained = topics;
			this.loaded = new Set(topics.map((topic) => topic.id));
			this.size = rawPageSize;
			this.depth = 0;
			this.more = !!moreTopicsUrl;
		}
		endPages() {
			this.more = false;
		}
		append(topics, moreTopicsUrl) {
			this.depth++;
			this.more = !!moreTopicsUrl;
			const added = topics.filter((topic) => {
				if (this.loaded.has(topic.id)) return false;
				this.loaded.add(topic.id);
				return true;
			});
			this.retained = this.retained.concat(added);
			return added;
		}
		markRead(topic) {
			if (_isTopicRead(topic)) return false;
			_applyReadMarker(topic);
			const resident = this.retained.find((candidate) => candidate.id === topic.id);
			if (resident && resident !== topic) _applyReadMarker(resident);
			return true;
		}
		lifecycle(message) {
			if (!message?.topic_id) return false;
			const topicId = Number(message.topic_id);
			if (!Number.isFinite(topicId)) return false;
			const topic = this.retained.find((candidate) => candidate.id === topicId);
			if (!topic) return false;
			if (message.message_type === "recover") {
				if (!topic.sfpUnavailable) return false;
				topic.sfpUnavailable = false;
				delete topic.sfpUnavailablePushed;
				return true;
			}
			return ["delete", "destroy"].includes(message.message_type || "") && markUnavailable(topic);
		}
		detectVanished(rawTopics, query) {
			detectVanishedTopics(this.retained, rawTopics, query);
		}
		rebuildUsers() {
			const next = {};
			for (const topic of this.retained) {
				const id = topic.posters?.[0]?.user_id;
				if (id !== void 0 && this.displayUsers[id]) next[id] = this.displayUsers[id];
			}
			this.displayUsers = next;
		}
		expireUnavailable(newEntrants) {
			if (!newEntrants) return;
			const expired = new Set();
			for (const topic of this.retained) {
				if (!topic.sfpUnavailable) continue;
				topic.sfpUnavailablePushed = (topic.sfpUnavailablePushed || 0) + newEntrants;
				if (topic.sfpUnavailablePushed >= this.limit) expired.add(topic.id);
			}
			if (!expired.size) return;
			this.retained = this.retained.filter((topic) => !expired.has(topic.id));
			expired.forEach((id) => this.loaded.delete(id));
			this.rebuildUsers();
		}
		trim() {
			let kept = 0;
			const trimmed = [];
			this.retained = this.retained.filter((topic) => {
				if (topic.sfpUnavailable) return true;
				if (kept++ < this.limit) return true;
				trimmed.push(topic.id);
				return false;
			});
			if (!trimmed.length) return;
			trimmed.forEach((id) => this.loaded.delete(id));
			this.rebuildUsers();
		}
		merge(topics, options = {}) {
			if (!topics.length) return null;
			const { mode = "prepend", resetFeedDepth = true, moreTopicsUrl, sortQuery } = options;
			const fetched = new Map(topics.map((topic) => [topic.id, topic]));
			for (const resident of this.retained) {
				const replacement = fetched.get(resident.id);
				if (replacement && _isTopicRead(resident) && !_isTopicRead(replacement)) _applyReadMarker(replacement);
			}
			if (resetFeedDepth) this.depth = 0;
			const highlights = topics.filter((topic) => mode === "prepend" || !this.loaded.has(topic.id)).map((topic) => topic.id);
			this.retained = [...topics, ...this.retained.filter((topic) => !fetched.has(topic.id))];
			if (mode === "replace-head") {
				if (sortQuery) interleaveUnavailableTopics(this.retained, sortQuery, topics.length);
				this.more = !!moreTopicsUrl;
			} else if (resetFeedDepth) this.more = this.retained.length >= Math.max(1, this.size);
			const entrants = topics.filter((topic) => !this.loaded.has(topic.id)).length;
			topics.forEach((topic) => this.loaded.add(topic.id));
			this.expireUnavailable(entrants);
			this.trim();
			return highlights;
		}
	};
	function createFeedController({ storage, discourse, prefs, site, tags }) {
		const { CATEGORY_DATA_CACHE_KEY, TAG_STYLE_CACHE_KEY } = storage_keys_exports;
		const { delete: _deleteSiteValue } = storage;
		const { getCsrfToken, getDiscourse, getMessageBus, waitForStableHeaderMount } = discourse;
		const { t, getUiLocale, formatRelativeTime } = createI18n(getDiscourse);
		const { _getCategoryMeta, _findTabCategoryByTabId, loadCategoryMetadata } = site;
		const { loadTagStyleIndex } = tags;
		const scroll = createFeedScroll({
			canLoadMore: () => resident.hasMore && !isLoadingMore,
			onLoadMore: () => loadMoreTopics({ source: "auto" }),
			onReadingState: () => _scheduleHeadActionStateSync()
		});
		const FeedQuery = {
			snapshot: () => ({
				tab: prefs.currentTab,
				categoryId: currentCategoryId,
				order: prefs.currentOrder,
				period: prefs.currentPeriod,
				filter: prefs.currentFilter
			}),
			key: feedQueryKey,
			isCurrent: (query) => feedQueryKey(query) === feedQueryKey(FeedQuery.snapshot()),
			buildUrl: (query, page) => buildFeedUrl(query, page, _getCategoryMeta)
		};
		const api = createFeedApi({
			buildUrl: FeedQuery.buildUrl,
			getCsrfToken,
			getSignal: () => requests.signal
		});
		const fetchFeedTopics = api.page;
		const fetchFeedTopicsByIds = api.byIds;
		const RouteWatcher = createRouteWatcher({
			onRouteChange: () => {
				if (prefs.feedModeEnabled) _syncIncomingHeadAction();
			},
			onMutation: () => {
				if (!prefs.feedModeEnabled) return;
				const sidebar = getSidebarElement();
				if (!sidebar) {
					if (host.feedContainer) deactivateFeed();
					return;
				}
				const resizerMissing = !host.resizerEl || !sidebar?.contains(host.resizerEl);
				if (sidebar && (!host.feedContainer || !sidebar.contains(host.feedContainer) || !sidebar.classList.contains("sfp-feed-mode") || resizerMissing)) activateFeed();
			}
		});
		let currentCategoryId = null;
		const resident = new ResidentTopics();
		const autoLoad = new AutoLoadGate();
		let isLoading = false;
		let loadCycle = null;
		let isLoadingMore = false;
		let isRefreshing = false;
		const silentRefresh = new RefreshCountdown();
		const automaticRefresh = new RefreshCountdown();
		const activity = new PageActivity();
		const appScope = new Lifetime();
		let viewScope = new Lifetime();
		let headActionScheduled = false;
		let started = false;
		let disposed = false;
		let active = false;
		let viewEpoch = 0;
		let requests = new AbortController();
		const setTimeout = (callback, delay) => viewScope.timeout(callback, delay);
		const clearTimeout = (id) => viewScope.clearTimeout(id);
		const requestAnimationFrame = (callback) => viewScope.frame(callback);
		function invalidateRequests() {
			viewEpoch++;
			sidebarIncomingState.applyQueued = false;
			refreshBusyCount = 0;
			requests.abort();
			requests = new AbortController();
			activeLoadToken++;
			activeLoadMoreToken++;
			activeRefreshToken++;
			sidebarIncomingState.filterRefreshToken++;
		}
		const incoming = new IncomingTopics();
		const reading = new ReadingState();
		const sidebarIncomingState = {
			filterRefreshTimer: null,
			filterRefreshToken: 0,
			viewSettling: false,
			filterStable: false,
			applyQueued: false
		};
		let sidebarMessageBus = null;
		let sidebarLatestMessageBusCallback = null;
		let sidebarNewMessageBusCallback = null;
		let sidebarLifecycleMessageBus = null;
		let sidebarLifecycleMessageBusCallback = null;
		let activeLoadToken = 0;
		let activeLoadMoreToken = 0;
		let activeRefreshToken = 0;
		let refreshBusyCount = 0;
		const topicRenderer = createTopicRenderer({
			t,
			formatRelativeTime,
			site,
			tags,
			discourse,
			getUser: (id) => resident.users[id],
			markTopicAsRead,
			getScope: () => viewScope
		});
		const host = createFeedHost({
			t,
			getEnabled: () => prefs.feedModeEnabled,
			getWidth: () => prefs.sfpSidebarWidth,
			onToggle: () => {
				prefs.feedModeEnabled = !prefs.feedModeEnabled;
				if (prefs.feedModeEnabled) activateFeed();
				else deactivateFeed();
			},
			onWidth: (width) => {
				prefs.sfpSidebarWidth = width;
			},
			getScope: () => viewScope
		});
		const { createToggle, getSidebarElement, removeResizer, restoreSidebarWidth } = host;
		const { createTopicItem } = topicRenderer;
		const controls = createControls({
			renderTopics,
			_finishSidebarIncomingViewSettling,
			t,
			prefs,
			site,
			host,
			getScope: () => viewScope,
			updatePreference: (key, value) => {
				const changed = prefs[key] !== value;
				Object.assign(prefs, { [key]: value });
				if (key === "currentFilter" && changed) {
					if (isLoading) loadTopics();
					else {
						invalidateRequests();
						isLoadingMore = isRefreshing = false;
					}
				}
			},
			saveTabOrder: (ids) => prefs.saveTabOrder(ids),
			getCategoryId: () => currentCategoryId,
			setCategoryId: (id) => {
				currentCategoryId = id;
			},
			_resetAutoLoadState,
			loadTopics,
			_beginSidebarIncomingViewSettling,
			_syncDefaultViewControls,
			_syncRefreshButtonBusy,
			_handleHeadActionClick,
			_syncSidebarIncomingTracking,
			_syncHeadActionState,
			_isAutoSilentRefreshActive,
			_queueSidebarIncomingApply,
			_startAutoSilentRefresh,
			_startAutoRefresh,
			_isLatestActivityView
		});
		const { _getOrderOptions, _getPeriodOptions, _getFilterOptions, _closeFloatingPanels, _buildHeaderControls, _buildTabBar, _rerenderTabBar, _buildFilterBar, _refreshCategoryTabs, _updateSettingsControl } = controls;
		const topicList = createTopicList({
			t,
			hasMore: () => resident.hasMore,
			loadMore: () => loadMoreTopics(),
			renderItem: createTopicItem,
			getScroll: () => host.feedScrollEl,
			getList: () => host.feedListEl,
			getScope: () => viewScope,
			syncHead: _syncHeadActionState,
			atHead: _isAtFeedHead
		});
		const { _renderPaginationFooter, _showLoadMoreSpinner, _showNoMore, _showLoadMoreError } = topicList;
		let siteControlsSignature = "";
		function _normalizeCurrentSiteState() {
			let changed = false;
			const orderOptions = _getOrderOptions();
			const periodOptions = _getPeriodOptions();
			const filterOptions = _getFilterOptions();
			if (!site.capabilities.orderValues.has(prefs.currentOrder)) {
				prefs.currentOrder = orderOptions[0]?.value || "activity";
				changed = true;
			}
			if (!site.capabilities.periodValues.has(prefs.currentPeriod)) {
				prefs.currentPeriod = site.capabilities.periodValues.has("all") ? "all" : periodOptions[0]?.value || "all";
				changed = true;
			}
			if (!site.capabilities.filterValues.has(prefs.currentFilter)) {
				prefs.currentFilter = filterOptions[0]?.value || "all";
				changed = true;
			}
			if (prefs.currentTab === "all") currentCategoryId = null;
			else {
				const tab = _findTabCategoryByTabId(prefs.currentTab);
				if (tab) {
					currentCategoryId = tab.id;
					if (prefs.currentTab !== tab.tabId) {
						prefs.currentTab = tab.tabId;
						changed = true;
					}
				} else {
					prefs.currentTab = "all";
					currentCategoryId = null;
					changed = true;
				}
			}
			return changed;
		}
		function _siteControlsStateSignature() {
			return JSON.stringify({
				locale: getUiLocale(),
				orders: _getOrderOptions().map((option) => option.value),
				periods: _getPeriodOptions().map((option) => option.value),
				filters: _getFilterOptions().map((option) => option.value),
				tabs: site.tabCategories.map((cat) => `${cat.id}:${cat.name}:${cat.icon}:${cat.color}`),
				currentTab: prefs.currentTab,
				currentOrder: prefs.currentOrder,
				currentPeriod: prefs.currentPeriod,
				currentFilter: prefs.currentFilter
			});
		}
		function _syncSiteDerivedControls({ force = false } = {}) {
			const nextSignature = _siteControlsStateSignature();
			if (!force && nextSignature === siteControlsSignature) return;
			siteControlsSignature = nextSignature;
			if (host.feedHeaderEl) {
				host.feedHeaderEl.replaceChildren();
				_buildHeaderControls(host.feedHeaderEl);
			}
			const tabShell = host.feedContainer?.querySelector(".sfp-tab-shell");
			if (tabShell) _rerenderTabBar(tabShell);
			const filterBar = host.feedContainer?.querySelector(".sfp-filter-bar");
			if (filterBar) filterBar.replaceWith(_buildFilterBar());
		}
		function clearDataCaches({ reload = false } = {}) {
			_deleteSiteValue(CATEGORY_DATA_CACHE_KEY);
			_deleteSiteValue(TAG_STYLE_CACHE_KEY);
			site.reset();
			tags.reset();
			console.info("[SFP] category data and tag style caches cleared");
			if (reload && prefs.feedModeEnabled) {
				_resetAutoLoadState();
				loadTopics();
			}
		}
		function activateFeed() {
			if (disposed || !prefs.feedModeEnabled) return;
			const sidebar = getSidebarElement();
			if (!sidebar) return;
			active = true;
			if (host.feedContainer && sidebar.contains(host.feedContainer)) {
				host.ensure();
				_startSidebarTopicLifecycleTracking();
				_syncDefaultViewControls();
				_syncIncomingHeadAction();
				_syncHeadActionState();
				return;
			}
			if (host.feedContainer) deactivateFeed();
			active = true;
			if (!host.mount(_buildHeaderControls, _buildTabBar, _buildFilterBar)) return;
			_restoreTabState();
			_syncDefaultViewControls();
			loadTopics();
			scroll.bind(host.feedScrollEl);
			_startSidebarTopicLifecycleTracking();
		}
		function deactivateFeed() {
			active = false;
			invalidateRequests();
			viewScope.dispose();
			viewScope = new Lifetime();
			headActionScheduled = false;
			isLoading = false;
			loadCycle = null;
			isLoadingMore = false;
			isRefreshing = false;
			sidebarIncomingState.applyQueued = false;
			scroll.dispose();
			_stopAutoRefresh();
			_stopAutoSilentRefresh();
			_stopSidebarIncomingTracking();
			_stopSidebarTopicLifecycleTracking();
			_resetRefreshButtonBusy();
			controls.feedRefreshBtn?.classList.remove("sfp-back-top-enter");
			host.unmount();
			controls.reset();
			resident.reset();
			_resetAutoLoadState();
		}
		function _beginRefreshButtonBusy() {
			refreshBusyCount++;
			_syncRefreshButtonBusy();
			let ended = false;
			const busyEpoch = viewEpoch;
			return () => {
				if (ended || busyEpoch !== viewEpoch) return;
				ended = true;
				refreshBusyCount = Math.max(0, refreshBusyCount - 1);
				_syncRefreshButtonBusy();
			};
		}
		function _syncRefreshButtonBusy() {
			if (controls.setBusy(refreshBusyCount > 0)) _syncHeadActionState();
		}
		function _resetRefreshButtonBusy() {
			refreshBusyCount = 0;
			_syncRefreshButtonBusy();
		}
		function _restoreTabState() {
			if (prefs.currentTab === "all") {
				currentCategoryId = null;
				return;
			}
			const cat = _findTabCategoryByTabId(prefs.currentTab);
			if (cat) {
				currentCategoryId = cat.id;
				prefs.currentTab = cat.tabId;
			} else if (site.loaded) {
				prefs.currentTab = "all";
				currentCategoryId = null;
			} else currentCategoryId = null;
		}
		function _isAtFeedHead() {
			return reading.atHead(host.feedScrollEl?.scrollTop || 0);
		}
		function _getIncomingCountDisplayValue(query = FeedQuery.snapshot()) {
			if (!prefs.showIncomingHint || !_canShowSidebarIncomingHint(query)) return 0;
			if (!reading.isAway(host.feedScrollEl?.scrollTop || 0, host.feedScrollEl?.clientHeight || 0) && _isAutoSilentRefreshActive(query)) return 0;
			return sidebarIncomingState.filterStable ? incoming.matchingIds.length : 0;
		}
		function _restartAutomaticRefreshTimers() {
			if (isLoading || isLoadingMore || isRefreshing) return;
			_startAutoSilentRefresh();
			_startAutoRefresh();
			if (_isAtFeedHead() && _isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) _queueSidebarIncomingApply();
		}
		function _isAutoSilentRefreshTimerExpected() {
			return _isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval > 0;
		}
		function _isAutoRefreshTimerExpected() {
			return prefs.autoRefreshEnabled && !_isLatestActivityView() && _isAtFeedHead();
		}
		function _restoreMissingAutomaticRefreshTimers() {
			if (isLoading || isLoadingMore || isRefreshing) return;
			if (_isAutoSilentRefreshTimerExpected() && !silentRefresh.running) _startAutoSilentRefresh();
			if (_isAutoRefreshTimerExpected() && !automaticRefresh.running) _startAutoRefresh();
		}
		function _syncHeadActionState({ restartAuto = true } = {}) {
			if (!controls.feedRefreshBtn) return;
			const isAtHead = _isAtFeedHead();
			const isAway = reading.isAway(host.feedScrollEl?.scrollTop || 0, host.feedScrollEl?.clientHeight || 0);
			const isBusy = refreshBusyCount > 0;
			const incomingCount = _getIncomingCountDisplayValue();
			controls.renderHeadAction(isAway, isBusy, incomingCount);
			_syncRefreshButtonBusy();
			if (reading.away !== isAway) {
				reading.away = isAway;
				if (isAway) {
					_stopAutoRefresh();
					_stopAutoSilentRefresh();
				} else if (restartAuto && isAtHead) _restartAutomaticRefreshTimers();
			} else if (!isAway && restartAuto && isAtHead) _restoreMissingAutomaticRefreshTimers();
		}
		function _scheduleHeadActionStateSync() {
			if (headActionScheduled) return;
			headActionScheduled = true;
			requestAnimationFrame(() => {
				headActionScheduled = false;
				_syncHeadActionState();
			});
		}
		async function _returnToHead({ animated = true, restartAuto = true } = {}) {
			if (!host.feedScrollEl) return false;
			host.feedScrollEl.scrollTo({
				top: 0,
				behavior: animated ? "smooth" : "auto"
			});
			if (!animated) {
				_syncHeadActionState({ restartAuto });
				return _isAtFeedHead();
			}
			const scrollResult = await topicList.waitForHead();
			if (scrollResult === "timeout" && host.feedScrollEl && !_isAtFeedHead()) host.feedScrollEl.scrollTop = 0;
			_syncHeadActionState({ restartAuto });
			return scrollResult !== "interrupted" && _isAtFeedHead();
		}
		async function _handleHeadActionClick(event) {
			if (!controls.feedRefreshBtn || controls.feedRefreshBtn.getAttribute("aria-busy") === "true") return;
			const action = controls.feedRefreshBtn.dataset.action || "refresh";
			if (event?.detail >= 2 && action === "back-top") {
				if (!_isAtFeedHead()) await _returnToHead({ animated: false });
				else _syncHeadActionState();
				return;
			}
			if (action === "incoming") {
				if (!_isAtFeedHead()) {
					if (!await _returnToHead({
						animated: true,
						restartAuto: false
					})) {
						_syncHeadActionState();
						return;
					}
				}
				await _applySidebarIncomingTopics({
					requireDefaultView: true,
					logPrefix: "head action incoming",
					queueIfBusy: false,
					resetFeedDepth: true
				});
				_restartAutomaticRefreshTimers();
				_syncHeadActionState();
				return;
			}
			if (action === "back-top") {
				await _returnToHead({ animated: true });
				return;
			}
			await refreshCurrentView();
			_syncHeadActionState();
		}
		function _beginSidebarIncomingViewSettling() {
			sidebarIncomingState.viewSettling = true;
			sidebarIncomingState.filterStable = false;
			incoming.recompute(false, () => false);
			sidebarIncomingState.filterRefreshToken++;
			if (sidebarIncomingState.filterRefreshTimer) {
				clearTimeout(sidebarIncomingState.filterRefreshTimer);
				sidebarIncomingState.filterRefreshTimer = null;
			}
			_syncHeadActionState();
		}
		function _finishSidebarIncomingViewSettling() {
			sidebarIncomingState.viewSettling = false;
			sidebarIncomingState.filterStable = false;
			_recomputeSidebarIncomingFilteredTopicIds();
			_scheduleSidebarIncomingFilterRefresh();
			_syncIncomingHeadAction();
			if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) _queueSidebarIncomingApply();
		}
		function _syncIncomingHeadAction({ skipIncomingFilterRefresh = false } = {}) {
			if (!skipIncomingFilterRefresh) _scheduleSidebarIncomingFilterRefresh();
			_syncHeadActionState();
		}
		function _isLatestActivityView(query = FeedQuery.snapshot()) {
			return query.order === "activity";
		}
		function _canUseSidebarIncomingRefresh(query = FeedQuery.snapshot()) {
			return _isLatestActivityView(query);
		}
		function _shouldUseSidebarIncomingQueue(query = FeedQuery.snapshot()) {
			return _canUseSidebarIncomingRefresh(query) && (prefs.showIncomingHint || prefs.autoSilentRefreshEnabled);
		}
		function _canShowSidebarIncomingHint(query = FeedQuery.snapshot()) {
			return prefs.showIncomingHint && _canUseSidebarIncomingRefresh(query) && query.filter === "all";
		}
		function _isAutoSilentRefreshActive(query = FeedQuery.snapshot()) {
			return active && !disposed && prefs.autoSilentRefreshEnabled && _isAtFeedHead() && _canUseSidebarIncomingRefresh(query);
		}
		function _topicMatchesCategoryScope(topic, query = FeedQuery.snapshot()) {
			if (query.tab === "all" || !query.categoryId) return true;
			let categoryId = Number(topic?.category_id);
			const targetCategoryId = Number(query.categoryId);
			if (!Number.isFinite(categoryId) || !Number.isFinite(targetCategoryId)) return false;
			while (Number.isFinite(categoryId)) {
				if (categoryId === targetCategoryId) return true;
				const parentId = Number(_getCategoryMeta(categoryId)?.parent_category_id);
				if (!Number.isFinite(parentId) || parentId === categoryId) break;
				categoryId = parentId;
			}
			return false;
		}
		function _topicMatchesLocalFilter(topic, query = FeedQuery.snapshot()) {
			if (query.filter === "unseen") return _hasUnreadMarker(topic);
			if (query.filter === "read") return !_hasUnreadMarker(topic);
			return true;
		}
		function _topicMatchesIncomingView(topic, query = FeedQuery.snapshot()) {
			return _topicMatchesIncomingCandidate(topic, query) && _topicMatchesLocalFilter(topic, query);
		}
		function _topicMatchesIncomingCandidate(topic, query = FeedQuery.snapshot()) {
			return _canUseSidebarIncomingRefresh(query) && _topicMatchesCategoryScope(topic, query);
		}
		function _recomputeSidebarIncomingFilteredTopicIds(query = FeedQuery.snapshot()) {
			const enabled = _canUseSidebarIncomingRefresh(query);
			if (!enabled) sidebarIncomingState.filterStable = false;
			return incoming.recompute(enabled, (topic) => _topicMatchesIncomingCandidate(topic, query));
		}
		function _scheduleSidebarIncomingFilterRefresh() {
			if (sidebarIncomingState.viewSettling || isLoading || isRefreshing) return;
			if (!_canUseSidebarIncomingRefresh() || incoming.ids.length === 0) return;
			if (sidebarIncomingState.filterRefreshTimer) return;
			sidebarIncomingState.filterRefreshTimer = setTimeout(() => {
				sidebarIncomingState.filterRefreshTimer = null;
				_refreshSidebarIncomingFilter().catch((e) => {
					console.warn("[SFP] incoming filter refresh error:", e);
				});
			}, 150);
		}
		async function _refreshSidebarIncomingFilter() {
			const requestQuery = FeedQuery.snapshot();
			if (sidebarIncomingState.viewSettling || isLoading || isRefreshing) return incoming.matchingIds;
			if (!_canUseSidebarIncomingRefresh(requestQuery)) {
				_recomputeSidebarIncomingFilteredTopicIds(requestQuery);
				_syncIncomingHeadAction({ skipIncomingFilterRefresh: true });
				return [];
			}
			const incomingTopicIds = incoming.ids.slice();
			const token = ++sidebarIncomingState.filterRefreshToken;
			if (incomingTopicIds.length === 0) {
				incoming.recompute(false, () => false);
				sidebarIncomingState.filterStable = true;
				_syncIncomingHeadAction({ skipIncomingFilterRefresh: true });
				return [];
			}
			await loadCategoryMetadata();
			if (token !== sidebarIncomingState.filterRefreshToken || !FeedQuery.isCurrent(requestQuery)) return incoming.matchingIds;
			_recomputeSidebarIncomingFilteredTopicIds(requestQuery);
			sidebarIncomingState.filterStable = true;
			_syncIncomingHeadAction({ skipIncomingFilterRefresh: true });
			return incoming.matchingIds;
		}
		function _syncDefaultViewControls() {
			_syncSidebarIncomingTracking();
			_recomputeSidebarIncomingFilteredTopicIds();
			_updateSettingsControl();
			_syncIncomingHeadAction();
			_syncHeadActionState();
			_scheduleSidebarIncomingFilterRefresh();
			if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) _queueSidebarIncomingApply();
		}
		function _startSidebarIncomingTracking() {
			if (!_shouldUseSidebarIncomingQueue()) return;
			if (sidebarLatestMessageBusCallback || sidebarNewMessageBusCallback) return;
			const messageBus = getMessageBus();
			if (!messageBus?.subscribe) {
				console.warn("[SFP] message-bus service unavailable; incoming topics will not auto-update");
				return;
			}
			sidebarMessageBus = messageBus;
			sidebarLatestMessageBusCallback = (data) => _handleSidebarIncomingMessage(data);
			sidebarNewMessageBusCallback = (data) => _handleSidebarIncomingMessage(data);
			messageBus.subscribe("/latest", sidebarLatestMessageBusCallback, _getMessageBusLastId(messageBus, "/latest"));
			messageBus.subscribe("/new", sidebarNewMessageBusCallback, _getMessageBusLastId(messageBus, "/new"));
		}
		function _syncSidebarIncomingTracking() {
			if (prefs.feedModeEnabled && _shouldUseSidebarIncomingQueue()) _startSidebarIncomingTracking();
			else _stopSidebarIncomingTracking();
		}
		function _getMessageBusLastId(messageBus, channel) {
			const candidates = [
				messageBus?.lastId?.(channel),
				messageBus?.lastIdForChannel?.(channel),
				messageBus?.lastIds?.[channel],
				messageBus?.last_ids?.[channel],
				messageBus?.channels?.[channel]?.lastId
			];
			for (const candidate of candidates) {
				const lastId = Number(candidate);
				if (Number.isFinite(lastId)) return lastId;
			}
			return -1;
		}
		function _stopSidebarIncomingTracking() {
			if (sidebarMessageBus?.unsubscribe) {
				if (sidebarLatestMessageBusCallback) sidebarMessageBus.unsubscribe("/latest", sidebarLatestMessageBusCallback);
				if (sidebarNewMessageBusCallback) sidebarMessageBus.unsubscribe("/new", sidebarNewMessageBusCallback);
			}
			sidebarMessageBus = null;
			sidebarLatestMessageBusCallback = null;
			sidebarNewMessageBusCallback = null;
			_clearSidebarIncomingCandidates();
		}
		function _startSidebarTopicLifecycleTracking() {
			if (!prefs.feedModeEnabled) return;
			if (sidebarLifecycleMessageBusCallback) return;
			const messageBus = getMessageBus();
			if (!messageBus?.subscribe) return;
			sidebarLifecycleMessageBus = messageBus;
			sidebarLifecycleMessageBusCallback = (data) => _handleSidebarTopicLifecycleMessage(data);
			messageBus.subscribe("/delete", sidebarLifecycleMessageBusCallback, _getMessageBusLastId(messageBus, "/delete"));
			messageBus.subscribe("/recover", sidebarLifecycleMessageBusCallback, _getMessageBusLastId(messageBus, "/recover"));
			messageBus.subscribe("/destroy", sidebarLifecycleMessageBusCallback, _getMessageBusLastId(messageBus, "/destroy"));
		}
		function _stopSidebarTopicLifecycleTracking() {
			if (sidebarLifecycleMessageBus?.unsubscribe && sidebarLifecycleMessageBusCallback) {
				sidebarLifecycleMessageBus.unsubscribe("/delete", sidebarLifecycleMessageBusCallback);
				sidebarLifecycleMessageBus.unsubscribe("/recover", sidebarLifecycleMessageBusCallback);
				sidebarLifecycleMessageBus.unsubscribe("/destroy", sidebarLifecycleMessageBusCallback);
			}
			sidebarLifecycleMessageBus = null;
			sidebarLifecycleMessageBusCallback = null;
		}
		function _handleSidebarTopicLifecycleMessage(data) {
			if (resident.lifecycle(data) && host.feedListEl) renderTopics();
		}
		function _handleSidebarIncomingMessage(data) {
			if (!data || !["latest", "new_topic"].includes(data.message_type || "")) return;
			if (!data.topic_id) return;
			if (!_shouldUseSidebarIncomingQueue()) {
				_clearSidebarIncomingCandidates();
				return;
			}
			if (data.payload?.archetype && data.payload.archetype !== "regular") return;
			incoming.touch(data.topic_id, data.payload);
			sidebarIncomingState.filterStable = false;
			if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) _queueSidebarIncomingApply();
			else if (_canUseSidebarIncomingRefresh()) {
				_recomputeSidebarIncomingFilteredTopicIds();
				sidebarIncomingState.filterStable = true;
				_syncIncomingHeadAction({ skipIncomingFilterRefresh: true });
			}
		}
		function _clearSidebarIncomingCandidates() {
			incoming.clear();
			sidebarIncomingState.filterStable = false;
			sidebarIncomingState.applyQueued = false;
			if (sidebarIncomingState.filterRefreshTimer) {
				clearTimeout(sidebarIncomingState.filterRefreshTimer);
				sidebarIncomingState.filterRefreshTimer = null;
			}
			sidebarIncomingState.filterRefreshToken++;
			_syncHeadActionState();
		}
		function _resetSidebarIncomingCandidatesForQueryChange() {
			incoming.clear();
			sidebarIncomingState.filterStable = false;
			sidebarIncomingState.applyQueued = false;
			if (sidebarIncomingState.filterRefreshTimer) {
				clearTimeout(sidebarIncomingState.filterRefreshTimer);
				sidebarIncomingState.filterRefreshTimer = null;
			}
			sidebarIncomingState.filterRefreshToken++;
			_syncHeadActionState();
		}
		function _getSidebarIncomingLoadTopicIds() {
			return incoming.loadIds(resident.pageSize);
		}
		function _removeSidebarIncomingTopicIds(topicIds) {
			incoming.remove(topicIds);
			_recomputeSidebarIncomingFilteredTopicIds();
		}
		function _removeSidebarIncomingTopicsForQuery(query = FeedQuery.snapshot()) {
			if (!incoming.ids.length) return;
			_removeSidebarIncomingTopicIds(incoming.ids.filter((id) => {
				const topic = incoming.get(Number(id));
				return topic && _topicMatchesIncomingCandidate(topic, query);
			}));
		}
		function _queueSidebarIncomingApply() {
			if (sidebarIncomingState.viewSettling) return;
			if (!_canUseSidebarIncomingRefresh()) return;
			if (!_isAutoSilentRefreshActive() || prefs.autoSilentRefreshInterval > 0) return;
			if (_shouldSkipAutomaticRefresh()) return;
			if (incoming.ids.length === 0) return;
			if (sidebarIncomingState.applyQueued) return;
			sidebarIncomingState.applyQueued = true;
			const queuedEpoch = viewEpoch;
			Promise.resolve().then(async () => {
				if (disposed || queuedEpoch !== viewEpoch) return;
				sidebarIncomingState.applyQueued = false;
				if (!_isAutoSilentRefreshActive() || prefs.autoSilentRefreshInterval > 0) return;
				await _applySidebarIncomingTopics({
					requireDefaultView: true,
					logPrefix: "auto silent refresh"
				});
			});
		}
		function _flushQueuedSidebarIncomingApply() {
			if (!sidebarIncomingState.applyQueued) return;
			if (!_isAutoSilentRefreshActive() || prefs.autoSilentRefreshInterval > 0) {
				sidebarIncomingState.applyQueued = false;
				return;
			}
			sidebarIncomingState.applyQueued = false;
			_queueSidebarIncomingApply();
		}
		function _getAutoLoadSessionKey() {
			return FeedQuery.key(FeedQuery.snapshot());
		}
		function _resetAutoLoadState() {
			autoLoad.reset(_getAutoLoadSessionKey());
		}
		function _canRunAutoLoad() {
			return autoLoad.canRun(_getAutoLoadSessionKey());
		}
		function _recordAutoLoadRequest() {
			autoLoad.recordRequest(_getAutoLoadSessionKey());
		}
		function _recordAutoLoadFilterResult(count) {
			autoLoad.recordResult(_getAutoLoadSessionKey(), count);
		}
		function _shouldExcludeTopReadPinnedTopics(query, page) {
			return prefs.hidePinned && page === 0 && _isLatestActivityView(query);
		}
		function _excludeTopReadPinnedTopics(topics, query, page) {
			if (!_shouldExcludeTopReadPinnedTopics(query, page) || !Array.isArray(topics)) return topics;
			let firstNonPinnedIndex = 0;
			while (firstNonPinnedIndex < topics.length && _isPinnedTopic(topics[firstNonPinnedIndex])) firstNonPinnedIndex++;
			if (firstNonPinnedIndex === 0) return topics;
			const topPinnedTopics = topics.slice(0, firstNonPinnedIndex);
			const visibleTopPinnedTopics = topPinnedTopics.filter((topic) => _hasUnreadMarker(topic));
			if (visibleTopPinnedTopics.length === topPinnedTopics.length) return topics;
			return visibleTopPinnedTopics.concat(topics.slice(firstNonPinnedIndex));
		}
		function _startTagStyleIndexLoad() {
			if (tags.loaded || tags.loading) return;
			loadTagStyleIndex().then(() => {
				if (prefs.feedModeEnabled && host.feedListEl && resident.topics.length > 0) renderTopics();
			});
		}
		async function loadTopics() {
			if (disposed || !prefs.feedModeEnabled || !host.feedListEl) return;
			if (loadCycle) {
				loadCycle.pending = true;
				invalidateRequests();
				return;
			}
			const cycle = { pending: false };
			loadCycle = cycle;
			invalidateRequests();
			let requestQuery = null;
			const requestToken = ++activeLoadToken;
			activeLoadMoreToken++;
			activeRefreshToken++;
			_beginSidebarIncomingViewSettling();
			_resetSidebarIncomingCandidatesForQueryChange();
			isLoading = true;
			isLoadingMore = false;
			isRefreshing = false;
			resident.reset({ clearUsers: false });
			if (host.feedScrollEl) host.feedScrollEl.scrollTop = 0;
			reading.away = null;
			_syncIncomingHeadAction();
			_resetAutoLoadState();
			reading.away = null;
			topicList.showLoading();
			_syncHeadActionState();
			try {
				await loadCategoryMetadata();
				_startTagStyleIndexLoad();
				if (requestToken !== activeLoadToken) return;
				requestQuery = FeedQuery.snapshot();
				_resetAutoLoadState();
				_syncSiteDerivedControls();
				if (requestToken !== activeLoadToken || !FeedQuery.isCurrent(requestQuery)) return;
				_refreshCategoryTabs();
				const data = await fetchFeedTopics(requestQuery, 0);
				if (requestToken !== activeLoadToken || !FeedQuery.isCurrent(requestQuery)) return;
				_processUsers(data);
				if (data?.topic_list?.topics) {
					const rawTopics = data.topic_list.topics;
					const topics = _excludeTopReadPinnedTopics(rawTopics, requestQuery, 0);
					resident.loadHead(topics, rawTopics.length, data.topic_list.more_topics_url);
					renderTopics();
					_removeSidebarIncomingTopicIds(topics.map((topic) => topic.id));
					_syncIncomingHeadAction();
				} else {
					topicList.showMessage(t("emptyTopics"));
					resident.endPages();
				}
			} catch (e) {
				if (requestToken !== activeLoadToken || requestQuery && !FeedQuery.isCurrent(requestQuery)) return;
				console.error("[SFP] loadTopics error:", e);
				topicList.showError(e, () => {
					loadTopics();
				});
			} finally {
				if (loadCycle === cycle) {
					loadCycle = null;
					isLoading = false;
					if (cycle.pending) loadTopics();
					else {
						_flushQueuedSidebarIncomingApply();
						_finishSidebarIncomingViewSettling();
						_restartAutomaticRefreshTimers();
					}
				}
			}
		}
		async function loadMoreTopics({ source = "manual" } = {}) {
			if (disposed || !prefs.feedModeEnabled || isLoading || isLoadingMore || !resident.hasMore) return;
			const isAutoLoad = source === "auto";
			if (isAutoLoad && !_canRunAutoLoad()) return;
			const requestQuery = FeedQuery.snapshot();
			const requestToken = ++activeLoadMoreToken;
			isLoadingMore = true;
			if (isAutoLoad) _recordAutoLoadRequest();
			_showLoadMoreSpinner();
			try {
				await loadCategoryMetadata();
				if (requestToken !== activeLoadMoreToken || !FeedQuery.isCurrent(requestQuery)) return;
				const data = await fetchFeedTopics(requestQuery, resident.page + 1);
				if (requestToken !== activeLoadMoreToken || !FeedQuery.isCurrent(requestQuery)) return;
				_processUsers(data);
				if (data?.topic_list?.topics) {
					const topics = data.topic_list.topics;
					const newTopics = resident.append(topics, data.topic_list.more_topics_url);
					if (newTopics.length === 0) {
						if (resident.hasMore) _renderPaginationFooter({ note: !isAutoLoad ? t("nextPageNoMatch") : "" });
						else _showNoMore();
					} else {
						const filteredNew = _applyFilter(newTopics);
						topicList.append(filteredNew);
						if (isAutoLoad) _recordAutoLoadFilterResult(filteredNew.length);
						_renderPaginationFooter({ note: !isAutoLoad && filteredNew.length === 0 ? t("nextPageNoMatch") : "" });
					}
				} else {
					resident.endPages();
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
			resident.addUsers(data?.users);
		}
		async function refreshCurrentView() {
			return _refreshCurrentView({ logPrefix: "manual refresh" });
		}
		function _mergeAndRenderTopics(fetchedTopics, { mode = "prepend", moreTopicsUrl = "", incomingCandidateIds = [], filterTopic = null, clearIncomingForQuery = null, resetFeedDepth = true, sortQuery = null } = {}) {
			const topics = mode !== "replace-head" && typeof filterTopic === "function" ? fetchedTopics.filter((topic) => filterTopic?.(topic)) : fetchedTopics;
			if (topics.length === 0) {
				if (incomingCandidateIds.length) _removeSidebarIncomingTopicIds(incomingCandidateIds);
				_syncIncomingHeadAction();
				return false;
			}
			const highlightTopicIds = resident.merge(topics, {
				mode,
				moreTopicsUrl,
				resetFeedDepth,
				sortQuery
			}) || [];
			const scrollAnchor = topicList.captureAnchor();
			renderTopics(highlightTopicIds);
			if (clearIncomingForQuery) _removeSidebarIncomingTopicsForQuery(clearIncomingForQuery);
			else if (incomingCandidateIds.length) _removeSidebarIncomingTopicIds(incomingCandidateIds);
			_syncIncomingHeadAction();
			topicList.restoreAnchor(scrollAnchor);
			_syncHeadActionState();
			return true;
		}
		async function _refreshCurrentView({ requireDefaultView = false, logPrefix = "refresh" } = {}) {
			if (disposed || !prefs.feedModeEnabled || isLoading || isLoadingMore || isRefreshing) return false;
			if (requireDefaultView && !_canUseSidebarIncomingRefresh()) return false;
			if (!host.feedListEl) return false;
			const requestQuery = FeedQuery.snapshot();
			const requestToken = ++activeRefreshToken;
			const endRefreshBusy = _beginRefreshButtonBusy();
			isRefreshing = true;
			try {
				await loadCategoryMetadata();
				if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return false;
				const data = await fetchFeedTopics(requestQuery, 0);
				if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return false;
				_processUsers(data);
				if (!data?.topic_list?.topics) return false;
				resident.detectVanished(data.topic_list.topics, requestQuery);
				return _mergeAndRenderTopics(_excludeTopReadPinnedTopics(data.topic_list.topics, requestQuery, 0), {
					mode: "replace-head",
					moreTopicsUrl: data.topic_list.more_topics_url,
					clearIncomingForQuery: requestQuery,
					resetFeedDepth: true,
					sortQuery: requestQuery
				});
			} catch (e) {
				console.warn(`[SFP] ${logPrefix} error:`, e);
				return false;
			} finally {
				if (requestToken === activeRefreshToken) {
					isRefreshing = false;
					_resetAutoRefreshCountdown();
					_flushQueuedSidebarIncomingApply();
					_syncHeadActionState();
				}
				endRefreshBusy();
			}
		}
		async function _applySidebarIncomingTopics({ requireDefaultView = false, logPrefix = "incoming", queueIfBusy = true, resetFeedDepth = true } = {}) {
			if (sidebarIncomingState.viewSettling || isLoading || isLoadingMore || isRefreshing) {
				if (queueIfBusy) sidebarIncomingState.applyQueued = true;
				return;
			}
			if (requireDefaultView && !_canUseSidebarIncomingRefresh()) return;
			if (!host.feedListEl) return;
			if (disposed || !prefs.feedModeEnabled) return;
			const applyEpoch = viewEpoch;
			const endRefreshBusy = _beginRefreshButtonBusy();
			let requestToken = null;
			try {
				const incomingCandidateIds = await _refreshSidebarIncomingFilter();
				if (disposed || applyEpoch !== viewEpoch) return;
				const incomingTopicIds = _getSidebarIncomingLoadTopicIds();
				if (incomingTopicIds.length === 0) return;
				if (isLoading || isLoadingMore || isRefreshing) {
					if (queueIfBusy) sidebarIncomingState.applyQueued = true;
					return;
				}
				const requestQuery = FeedQuery.snapshot();
				requestToken = ++activeRefreshToken;
				isRefreshing = true;
				await loadCategoryMetadata();
				if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return;
				const data = await fetchFeedTopicsByIds(incomingTopicIds);
				if (requestToken !== activeRefreshToken || !FeedQuery.isCurrent(requestQuery)) return;
				if (!data?.topic_list?.topics) return;
				_processUsers(data);
				_mergeAndRenderTopics(data.topic_list.topics, {
					mode: "prepend",
					incomingCandidateIds,
					filterTopic: (topic) => _topicMatchesIncomingView(topic, requestQuery),
					resetFeedDepth
				});
			} catch (e) {
				console.warn(`[SFP] ${logPrefix} error:`, e);
			} finally {
				if (requestToken === activeRefreshToken) {
					isRefreshing = false;
					_flushQueuedSidebarIncomingApply();
					_syncHeadActionState();
				}
				endRefreshBusy();
			}
		}
		function _startAutoSilentRefresh() {
			_stopAutoSilentRefresh();
			if (!_isAutoSilentRefreshActive()) return;
			if (prefs.autoSilentRefreshInterval <= 0) return;
			_resetAutoSilentRefreshCountdown();
			silentRefresh.start(prefs.autoSilentRefreshInterval, () => {
				if (prefs.feedModeEnabled && !isLoading && !isLoadingMore && !isRefreshing && !_shouldSkipAutomaticRefresh()) {
					if (_canUseSidebarIncomingRefresh()) _applySidebarIncomingTopics({
						requireDefaultView: true,
						logPrefix: "auto silent refresh interval",
						queueIfBusy: false
					});
					else _refreshCurrentView({ logPrefix: "auto silent refresh interval" });
				}
			});
		}
		function _resetAutoSilentRefreshCountdown() {
			if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval > 0) silentRefresh.reset(prefs.autoSilentRefreshInterval);
		}
		function _stopAutoSilentRefresh() {
			silentRefresh.stop();
		}
		function _isPageIdleForAutoRefresh() {
			return activity.idle(document.visibilityState === "hidden");
		}
		function _shouldSkipAutomaticRefresh() {
			return _isPageIdleForAutoRefresh() || !_isAtFeedHead();
		}
		function _setupPageActivityTracking() {
			activity.start(appScope);
		}
		function _startAutoRefresh() {
			_stopAutoRefresh();
			if (!active || disposed) return;
			if (_isLatestActivityView()) return;
			if (!prefs.autoRefreshEnabled) return;
			if (!_isAtFeedHead()) return;
			_resetAutoRefreshCountdown();
			automaticRefresh.start(prefs.autoRefreshInterval, () => {
				if (prefs.feedModeEnabled && !isLoading && !isLoadingMore && !_shouldSkipAutomaticRefresh()) _refreshCurrentView({ logPrefix: "auto refresh" });
			});
		}
		function _resetAutoRefreshCountdown() {
			if (prefs.autoRefreshEnabled) automaticRefresh.reset(prefs.autoRefreshInterval);
		}
		function _stopAutoRefresh() {
			automaticRefresh.stop();
		}
		function renderTopics(newTopicIds = []) {
			const filtered = _applyFilter(resident.topics);
			let emptyMessage = t("emptyTopics");
			if (resident.topics.length) {
				emptyMessage = prefs.currentFilter === "unseen" ? t(prefs.currentTab !== "all" ? "noUnreadInCategory" : "noUnread") : t(prefs.currentFilter === "read" ? "noRead" : "noMatchingTopics");
				if (resident.hasMore && !isLoadingMore) emptyMessage = t("currentPagePrefix") + emptyMessage;
			}
			topicList.render(filtered, emptyMessage, newTopicIds);
			_syncHeadActionState();
		}
		function markTopicAsRead(topic, itemElement) {
			if (resident.markRead(topic)) topicRenderer.markRead(itemElement);
		}
		function _applyFilter(topics) {
			if (prefs.currentFilter === "all") return topics;
			let result = topics;
			if (prefs.currentFilter === "unseen") result = result.filter((t) => _hasUnreadMarker(t));
			if (prefs.currentFilter === "read") result = result.filter((t) => !_hasUnreadMarker(t));
			return result;
		}
		function init() {
			if (started || disposed) return;
			started = true;
			appScope.listen(document, "click", () => _closeFloatingPanels());
			_setupPageActivityTracking();
			controls.start();
			waitForStableHeaderMount(() => {
				if (disposed) return;
				createToggle();
				RouteWatcher.start();
				if (prefs.feedModeEnabled) appScope.timeout(() => activateFeed(), 300);
				else {
					removeResizer();
					restoreSidebarWidth();
				}
			});
		}
		function dispose() {
			if (disposed) return;
			disposed = true;
			RouteWatcher.stop();
			deactivateFeed();
			viewScope.dispose();
			appScope.dispose();
			host.dispose();
			controls.dispose();
			restoreSidebarWidth();
		}
		return {
			start: init,
			activate: () => {
				prefs.feedModeEnabled = true;
				activateFeed();
			},
			deactivate: () => {
				prefs.feedModeEnabled = false;
				deactivateFeed();
			},
			dispose,
			clearCaches: clearDataCaches,
			normalizeSiteState: _normalizeCurrentSiteState
		};
	}
	function createDiscourseBridge(pageWindow) {
		let scope = new Lifetime();
		let cachedCsrfToken = null;
		function getCsrfToken() {
			if (cachedCsrfToken === null) cachedCsrfToken = document.querySelector("meta[name=\"csrf-token\"]")?.getAttribute("content") || "";
			return cachedCsrfToken;
		}
		function toAbsoluteSiteUrl(path) {
			if (!path) return "";
			return new URL(path, location.origin).href;
		}
		function navigateTo(path) {
			const script = document.createElement("script");
			script.textContent = `window.require("discourse/lib/url").default.routeTo(${JSON.stringify(path)});`;
			document.documentElement.appendChild(script);
			script.remove();
		}
		function getDiscourse() {
			try {
				return pageWindow?.Discourse || typeof window !== "undefined" && window.Discourse || typeof Discourse !== "undefined" && Discourse || null;
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
		function getAvatarUrl(template, size) {
			if (!template) return "";
			let url = template.replace("{size}", String(size));
			if (!url.startsWith("http")) url = toAbsoluteSiteUrl(url);
			return url;
		}
		function getUserProfileUrl(username) {
			if (!username) return "";
			return `/u/${encodeURIComponent(username)}`;
		}
		function openPathInNewTab(path) {
			window.open(toAbsoluteSiteUrl(path), "_blank", "noopener,noreferrer");
		}
		function handlePointerNavigation(e, path, { onPrimaryActivate, onMiddleActivate } = {}) {
			if (!path) return false;
			const isPrimaryClick = e.type === "click" && e.button === 0;
			const isMiddleClick = e.type === "auxclick" && e.button === 1;
			if (!isPrimaryClick && !isMiddleClick) return false;
			e.preventDefault();
			e.stopPropagation();
			if (isPrimaryClick && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
				onPrimaryActivate?.();
				openPathInNewTab(path);
				return true;
			}
			if (isPrimaryClick) {
				onPrimaryActivate?.();
				navigateTo(path);
				return true;
			}
			onMiddleActivate?.();
			openPathInNewTab(path);
			return true;
		}
		function waitForEmber(callback, maxWait = 15e3) {
			const start = Date.now();
			function check() {
				if (scope.disposed) return;
				try {
					if (getDiscourse()?.__container__) {
						callback();
						return;
					}
				} catch (e) {}
				if (Date.now() - start < maxWait) scope.timeout(check, 500);
				else console.warn("[SFP] Timed out waiting for Ember");
			}
			check();
		}
		function waitForStableHeaderMount(callback) {
			waitForEmber(() => {
				const run = () => {
					scope.frame(() => {
						scope.frame(() => {
							callback();
						});
					});
				};
				if (document.readyState === "complete") {
					run();
					return;
				}
				scope.listen(window, "load", run, { once: true });
			});
		}
		return {
			dispose: () => scope.dispose(),
			getCsrfToken,
			toAbsoluteSiteUrl,
			navigateTo,
			getDiscourse,
			getMessageBus,
			getAvatarUrl,
			getUserProfileUrl,
			openPathInNewTab,
			handlePointerNavigation,
			waitForEmber,
			waitForStableHeaderMount
		};
	}
	var _GM_addStyle = (() => typeof GM_addStyle != "undefined" ? GM_addStyle : void 0)();
	var _GM_deleteValue = (() => typeof GM_deleteValue != "undefined" ? GM_deleteValue : void 0)();
	var _GM_getValue = (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
	var _GM_registerMenuCommand = (() => typeof GM_registerMenuCommand != "undefined" ? GM_registerMenuCommand : void 0)();
	var _GM_setValue = (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
	var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
	var gm = {
		get: _GM_getValue,
		set: _GM_setValue,
		delete: (key) => {
			if (typeof _GM_deleteValue === "function") _GM_deleteValue(key);
		},
		addStyle: _GM_addStyle,
		registerMenu: (label, callback) => {
			if (typeof _GM_registerMenuCommand === "function") _GM_registerMenuCommand(label, callback);
		},
		pageWindow: () => typeof _unsafeWindow !== "undefined" ? _unsafeWindow : window
	};
	function createSiteStorage(origin, values) {
		const keyFor = (key) => `${SITE_STORAGE_PREFIX}:${encodeURIComponent(origin)}:${key}`;
		return {
			get: (key, fallback) => values.get(keyFor(key), fallback),
			set: (key, value) => values.set(keyFor(key), value),
			delete: (key) => values.delete(keyFor(key)),
			migrateLegacy() {
				if (origin !== "https://linux.do") return;
				for (const key of SITE_SCOPED_STORAGE_KEYS) {
					const legacy = values.get(key, STORAGE_MISSING);
					if (legacy === "__SFP_STORAGE_MISSING__") continue;
					if (values.get(keyFor(key), "__SFP_STORAGE_MISSING__") === "__SFP_STORAGE_MISSING__") values.set(keyFor(key), legacy);
					values.delete(key);
				}
			}
		};
	}
	var Preferences = class {
		storage;
		_feedModeEnabled;
		_currentOrder;
		_currentPeriod;
		_sfpSidebarWidth;
		_currentTab;
		_currentFilter;
		_hidePinned;
		_showIncomingHint;
		_autoSilentRefreshEnabled;
		_autoSilentRefreshInterval;
		_autoRefreshEnabled;
		_autoRefreshInterval;
		constructor(storage) {
			this.storage = storage;
			this._feedModeEnabled = storage.get(STATE_KEY, false);
			this._currentOrder = storage.get(ORDER_KEY, "activity");
			if (this._currentOrder === "default") {
				this._currentOrder = "activity";
				storage.set(ORDER_KEY, this._currentOrder);
			}
			this._currentPeriod = storage.get(PERIOD_KEY, "all");
			this._sfpSidebarWidth = storage.get(WIDTH_KEY, 272);
			this._currentTab = storage.get(TAB_KEY, "all");
			this._currentFilter = storage.get(FILTER_KEY, "all");
			this._hidePinned = storage.get(HIDE_PINNED_KEY, false);
			this._showIncomingHint = storage.get(SHOW_INCOMING_HINT_KEY, true);
			this._autoSilentRefreshEnabled = storage.get(AUTO_SILENT_REFRESH_KEY, false);
			this._autoSilentRefreshInterval = Math.max(0, Number(storage.get("sfp_auto_silent_refresh_interval", 0)) || 0);
			this._autoRefreshEnabled = storage.get(AUTO_REFRESH_ENABLED_KEY, false);
			this._autoRefreshInterval = Math.max(1, Number(storage.get("sfp_auto_refresh_interval", 10)) || 10);
		}
		get feedModeEnabled() {
			return this._feedModeEnabled;
		}
		set feedModeEnabled(value) {
			this._feedModeEnabled = value;
			this.storage.set(STATE_KEY, value);
		}
		get currentOrder() {
			return this._currentOrder;
		}
		set currentOrder(value) {
			this._currentOrder = value;
			this.storage.set(ORDER_KEY, value);
		}
		get currentPeriod() {
			return this._currentPeriod;
		}
		set currentPeriod(value) {
			this._currentPeriod = value;
			this.storage.set(PERIOD_KEY, value);
		}
		get sfpSidebarWidth() {
			return this._sfpSidebarWidth;
		}
		set sfpSidebarWidth(value) {
			this._sfpSidebarWidth = value;
			this.storage.set(WIDTH_KEY, value);
		}
		get currentTab() {
			return this._currentTab;
		}
		set currentTab(value) {
			this._currentTab = value;
			this.storage.set(TAB_KEY, value);
		}
		get currentFilter() {
			return this._currentFilter;
		}
		set currentFilter(value) {
			this._currentFilter = value;
			this.storage.set(FILTER_KEY, value);
		}
		get hidePinned() {
			return this._hidePinned;
		}
		set hidePinned(value) {
			this._hidePinned = value;
			this.storage.set(HIDE_PINNED_KEY, value);
		}
		get showIncomingHint() {
			return this._showIncomingHint;
		}
		set showIncomingHint(value) {
			this._showIncomingHint = value;
			this.storage.set(SHOW_INCOMING_HINT_KEY, value);
		}
		get autoSilentRefreshEnabled() {
			return this._autoSilentRefreshEnabled;
		}
		set autoSilentRefreshEnabled(value) {
			this._autoSilentRefreshEnabled = value;
			this.storage.set(AUTO_SILENT_REFRESH_KEY, value);
		}
		get autoSilentRefreshInterval() {
			return this._autoSilentRefreshInterval;
		}
		set autoSilentRefreshInterval(value) {
			this._autoSilentRefreshInterval = value;
			this.storage.set(AUTO_SILENT_REFRESH_INTERVAL_KEY, value);
		}
		get autoRefreshEnabled() {
			return this._autoRefreshEnabled;
		}
		set autoRefreshEnabled(value) {
			this._autoRefreshEnabled = value;
			this.storage.set(AUTO_REFRESH_ENABLED_KEY, value);
		}
		get autoRefreshInterval() {
			return this._autoRefreshInterval;
		}
		set autoRefreshInterval(value) {
			this._autoRefreshInterval = value;
			this.storage.set(AUTO_REFRESH_INTERVAL_KEY, value);
		}
		saveTabOrder(ids) {
			this.storage.set(TAB_ORDER_KEY, ids);
		}
	};
	function createTagStyles({ storage, site }) {
		let scope = new Lifetime();
		const _getSiteValue = storage.get;
		const _setSiteValue = storage.set;
		const { loadSiteData, _extractPreloadedSiteData } = site;
		const tagStyleByKey = new Map();
		let tagStylePromise = null;
		let tagStyleLoaded = false;
		function _tagIndexKeys(tag) {
			const keys = [];
			const add = (value) => {
				if (value === null || value === void 0) return;
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
			return typeof tag === "string" ? tag : tag?.name || tag?.text || tag?.slug || "";
		}
		function _normalizeTagRecord(tag) {
			if (typeof tag === "string") {
				const name = tag.trim();
				return name ? {
					name,
					slug: name
				} : null;
			}
			if (tag && typeof tag === "object") {
				const name = String(tag.name || tag.text || tag.slug || tag.id || "").trim();
				if (!name) return null;
				return {
					id: tag.id,
					name,
					slug: tag.slug || tag.name || name
				};
			}
			const name = String(tag || "").trim();
			return name ? {
				name,
				slug: name
			} : null;
		}
		function _getTopTagsFromSiteData(site) {
			if (site?.can_tag_topics === false) return [];
			return (Array.isArray(site?.top_tags) ? site.top_tags : []).map(_normalizeTagRecord).filter((tag) => !!tag);
		}
		function _cacheTagStyleAliases(tags) {
			tags.forEach((tag) => {
				const style = _getTagStyle(tag);
				if (style) _cacheTagStyle(_tagIndexKeys(tag), style);
			});
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
				if ((name === "--color1" || name === "--color2") && /^#[A-Fa-f0-9]{3,8}$/.test(value || "")) pairs.push(`${name}: ${value}`);
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
				const cache = _getSiteValue(TAG_STYLE_CACHE_KEY, null);
				if (!cache || cache.version !== 1 || !Array.isArray(cache.entries)) return false;
				cache.entries.forEach(([key, style]) => {
					if (!key || !style || typeof style !== "object") return;
					const icon = _safeIconName(style.icon || "");
					const cssText = _sanitizeTagStyle(style.cssText || "");
					if (!icon && !cssText) return;
					tagStyleByKey.set(String(key), {
						icon,
						cssText,
						hasIcon: !!icon
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
				_setSiteValue(TAG_STYLE_CACHE_KEY, {
					version: 1,
					savedAt: Date.now(),
					entries: Array.from(tagStyleByKey.entries())
				});
			} catch (e) {
				console.warn("[SFP] save tag style cache failed:", e);
			}
		}
		function _extractTagStylesFromDocument(doc) {
			Array.from(doc.querySelectorAll("a.discourse-tag[data-tag-name]")).forEach((anchor) => {
				const use = anchor.querySelector("svg use");
				const icon = _safeIconName((use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").replace(/^#/, ""));
				const style = {
					icon,
					cssText: _sanitizeTagStyle(anchor.getAttribute("style") || ""),
					hasIcon: !!icon
				};
				if (!style.hasIcon && !style.cssText) return;
				const hrefParts = (anchor.getAttribute("href") || "").split("/").filter(Boolean);
				_cacheTagStyle([
					anchor.dataset.tagName,
					anchor.textContent,
					hrefParts[1],
					hrefParts[2]
				], style);
			});
		}
		function _waitForIframeTags(iframe, loadScope, timeoutMs = 12e3) {
			return new Promise((resolve) => {
				const forget = loadScope.defer(() => resolve(null));
				const finish = (value) => {
					forget();
					resolve(value);
				};
				const start = Date.now();
				const tick = () => {
					let doc = null;
					try {
						doc = iframe.contentDocument;
						if (doc && doc.querySelector("a.discourse-tag[data-tag-name]")) {
							finish(doc);
							return;
						}
					} catch (e) {
						finish(null);
						return;
					}
					if (Date.now() - start >= timeoutMs) {
						finish(doc);
						return;
					}
					loadScope.timeout(tick, 250);
				};
				tick();
			});
		}
		async function loadTagStyleIndex() {
			if (scope.disposed) return;
			if (tagStyleLoaded) return;
			if (tagStylePromise) return tagStylePromise;
			const loadScope = scope;
			tagStylePromise = (async () => {
				let iframe = null;
				try {
					let siteTags = [];
					try {
						siteTags = _getTopTagsFromSiteData(await loadSiteData());
					} catch (e) {
						siteTags = _getTopTagsFromSiteData(_extractPreloadedSiteData());
					}
					if (loadScope.disposed) return;
					if (_loadTagStyleCache()) {
						_cacheTagStyleAliases(siteTags);
						tagStyleLoaded = true;
						return;
					}
					_extractTagStylesFromDocument(document);
					iframe = document.createElement("iframe");
					iframe.src = "/tags";
					iframe.setAttribute("aria-hidden", "true");
					iframe.style.cssText = "position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;border:0;visibility:hidden;pointer-events:none;";
					document.body.appendChild(iframe);
					const forgetIframe = loadScope.defer(() => iframe?.remove());
					const doc = await _waitForIframeTags(iframe, loadScope);
					forgetIframe();
					if (loadScope.disposed) return;
					if (doc) _extractTagStylesFromDocument(doc);
					_cacheTagStyleAliases(siteTags);
					_saveTagStyleCache();
					tagStyleLoaded = true;
				} catch (e) {
					console.warn("[SFP] load tag style index failed:", e);
				} finally {
					if (iframe) iframe.remove();
					if (loadScope === scope) tagStylePromise = null;
				}
			})();
			return tagStylePromise;
		}
		function _resetRuntimeTagStyleData() {
			scope.dispose();
			scope = new Lifetime();
			tagStylePromise = null;
			tagStyleLoaded = false;
			tagStyleByKey.clear();
		}
		return {
			get loaded() {
				return tagStyleLoaded;
			},
			get loading() {
				return !!tagStylePromise;
			},
			loadTagStyleIndex,
			_tagDisplayName,
			_getTagStyle,
			reset: _resetRuntimeTagStyleData,
			dispose: () => scope.dispose()
		};
	}
	var feed_default = "/* ===== 切换按钮 ===== */\n.sfp-toggle-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border: none;\n  background: var(--secondary);\n  color: var(--primary-medium);\n  cursor: pointer;\n  border-radius: 6px;\n  padding: 0;\n  margin-left: 6px;\n  vertical-align: middle;\n  transition:\n    color 0.2s,\n    background 0.2s;\n  flex-shrink: 0;\n}\n.sfp-toggle-btn:hover {\n  color: var(--primary);\n  background: var(--primary-low);\n}\n.sfp-toggle-btn.active {\n  color: var(--secondary);\n  background: var(--tertiary);\n}\n.sfp-toggle-btn svg {\n  width: 18px;\n  height: 18px;\n  fill: currentColor;\n}\n.home-logo-wrapper-outlet .title {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n}\n\n/* ===== 侧边栏 Feed 模式 ===== */\n.sidebar-wrapper:has(> .sidebar-container.sfp-feed-mode) {\n  overflow-x: hidden !important;\n}\n.sidebar-container.sfp-feed-mode {\n  overflow-x: hidden !important;\n}\n.sidebar-container.sfp-feed-mode .sfp-feed-container,\n.sidebar-container.sfp-feed-mode .sfp-feed-container * {\n  box-sizing: border-box;\n}\n/* 隐藏所有非 feed 的直接子元素 */\n.sidebar-container.sfp-feed-mode > :not(.sfp-feed-container):not(.sfp-resizer) {\n  display: none !important;\n}\n/* 显式隐藏常见 sidebar 组件（嵌套情况兜底） */\n.sidebar-container.sfp-feed-mode .sidebar-sections,\n.sidebar-container.sfp-feed-mode .sidebar-footer-container,\n.sidebar-container.sfp-feed-mode .sidebar-footer-wrapper,\n.sidebar-container.sfp-feed-mode .sidebar-footer,\n.sidebar-container.sfp-feed-mode .sidebar-custom-sections,\n.sidebar-container.sfp-feed-mode .sidebar-section-wrapper,\n.sidebar-container.sfp-feed-mode .sidebar-section-header,\n.sidebar-container.sfp-feed-mode .sidebar-section-link-wrapper {\n  display: none !important;\n}\n.sidebar-container.sfp-feed-mode .sfp-feed-container {\n  display: flex;\n  flex-direction: column;\n  position: relative;\n  width: 100%;\n  min-width: 0;\n  height: 100%;\n  overflow: hidden;\n  max-width: 100%;\n}\n.sidebar-wrapper.sfp-width-animating,\n.sidebar-container.sfp-width-animating,\n#d-sidebar.sfp-width-animating {\n  transition:\n    width 220ms ease,\n    max-width 220ms ease;\n}\n\n/* ===== 拖拽调整宽度 ===== */\n.sfp-resizer {\n  position: absolute;\n  top: 0;\n  right: -2px;\n  width: 5px;\n  height: 100%;\n  cursor: ew-resize;\n  z-index: 10001;\n  transition: background 0.2s;\n}\n.sfp-resizer:hover,\n.sfp-resizer.sfp-resizing {\n  background: var(--tertiary);\n}\n\n/* ===== Feed Header ===== */\n.sfp-feed-header {\n  position: relative;\n  flex-shrink: 0;\n  padding: 8px 12px;\n  border-bottom: 1px solid var(--primary-low);\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  align-items: center;\n  overflow: visible;\n}\n.sfp-feed-header .sfp-header-spacer {\n  flex: 1 1 auto;\n  min-width: 8px;\n}\n.sfp-feed-header .sfp-refresh-btn,\n.sfp-feed-header .sfp-settings-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border: none;\n  background: var(--primary-very-low);\n  color: var(--primary-medium);\n  cursor: pointer;\n  border-radius: 6px;\n  padding: 0;\n  flex-shrink: 0;\n  transition:\n    color 0.2s,\n    background 0.2s;\n}\n.sfp-feed-header .sfp-refresh-btn:hover,\n.sfp-feed-header .sfp-settings-btn:hover,\n.sfp-settings-wrap.open .sfp-settings-btn {\n  color: var(--tertiary);\n  background: var(--primary-low);\n}\n.sfp-feed-header .sfp-refresh-btn.spinning svg {\n  animation: sfp-spin 0.6s linear infinite;\n}\n.sfp-feed-header .sfp-refresh-btn.spinning {\n  color: var(--tertiary);\n  background: var(--primary-low);\n}\n.sfp-feed-header\n  .sfp-refresh-btn.sfp-back-top-enter:not(.sfp-has-incoming-count)\n  svg {\n  animation: sfp-back-top-enter 0.18s ease;\n}\n.sfp-feed-header .sfp-refresh-btn .sfp-refresh-count {\n  display: inline-block;\n  min-width: 3ch;\n  color: var(--tertiary);\n  font-size: 13px;\n  font-weight: 700;\n  line-height: 1;\n  text-align: center;\n  white-space: nowrap;\n}\n@keyframes sfp-spin {\n  from {\n    transform: rotate(0deg);\n  }\n  to {\n    transform: rotate(360deg);\n  }\n}\n@keyframes sfp-back-top-enter {\n  from {\n    opacity: 0;\n    transform: translateY(8px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n.sfp-feed-header .sfp-refresh-btn svg,\n.sfp-feed-header .sfp-settings-btn svg {\n  width: 16px;\n  height: 16px;\n  fill: currentColor;\n}\n.sfp-settings-btn {\n  position: absolute;\n  top: 0;\n  right: 0;\n  z-index: 2;\n  gap: 3px;\n  flex-direction: column;\n}\n.sfp-settings-line {\n  width: 14px;\n  height: 2px;\n  border-radius: 2px;\n  background: currentColor;\n  transition:\n    transform 0.28s ease,\n    opacity 0.2s ease;\n  transform-origin: center;\n}\n.sfp-settings-wrap.open .sfp-settings-line-1 {\n  transform: translateY(5px) rotate(45deg);\n}\n.sfp-settings-wrap.open .sfp-settings-line-2 {\n  opacity: 0;\n  transform: scaleX(0);\n}\n.sfp-settings-wrap.open .sfp-settings-line-3 {\n  transform: translateY(-5px) rotate(-45deg);\n}\n.sfp-settings-wrap {\n  position: relative;\n  width: 28px;\n  height: 28px;\n  flex-shrink: 0;\n  overflow: visible;\n}\n.sfp-settings-shell {\n  position: absolute;\n  top: 0;\n  right: 0;\n  width: 28px;\n  height: 28px;\n  background: transparent;\n  border: none;\n  border-radius: 6px;\n  box-shadow: none;\n  z-index: 10003;\n  overflow: hidden;\n  transition:\n    width 0.36s cubic-bezier(0.25, 1, 0.5, 1),\n    height 0.36s cubic-bezier(0.25, 1, 0.5, 1),\n    border-radius 0.24s ease,\n    background 0.2s ease;\n}\n.sfp-settings-wrap.open .sfp-settings-shell {\n  width: 204px;\n  height: var(--sfp-settings-shell-height, 128px);\n  overflow: visible;\n  background: var(--secondary);\n  border: 1px solid var(--primary-low);\n  border-radius: 8px;\n  box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 14%, transparent);\n}\n.sfp-settings-panel {\n  box-sizing: border-box;\n  width: 204px;\n  padding: 36px 10px 8px 10px;\n  opacity: 0;\n  visibility: hidden;\n  transform: translateY(-8px);\n  pointer-events: none;\n  transition:\n    opacity 0.18s ease,\n    transform 0.18s ease,\n    visibility 0.18s;\n}\n.sfp-settings-wrap.open .sfp-settings-panel {\n  opacity: 1;\n  visibility: visible;\n  transform: translateY(0);\n  pointer-events: auto;\n  transition:\n    opacity 0.26s ease 0.12s,\n    transform 0.26s ease 0.12s,\n    visibility 0.26s 0.12s;\n}\n.sfp-setting-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  column-gap: 8px;\n  font-size: 12px;\n  color: var(--primary);\n  line-height: 1.3;\n  padding: 4px 0;\n}\n.sfp-setting-label {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  min-width: 0;\n  white-space: nowrap;\n}\n.sfp-setting-help-wrap {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 14px;\n  flex: 0 0 14px;\n  pointer-events: none;\n}\n.sfp-setting-help {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 14px;\n  box-sizing: border-box;\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--primary-medium);\n  cursor: help;\n  padding: 0;\n  pointer-events: auto;\n}\n.sfp-setting-help svg {\n  width: 13px;\n  height: 13px;\n  display: block;\n  fill: currentColor;\n  pointer-events: none;\n}\n.sfp-setting-help:hover {\n  color: var(--tertiary);\n  outline: none;\n}\n.sfp-help-tooltip {\n  position: fixed;\n  z-index: 10004;\n  width: 178px;\n  max-width: calc(100vw - 32px);\n  padding: 8px 9px;\n  border: 1px solid var(--primary-low);\n  border-radius: 6px;\n  background: var(--secondary);\n  box-shadow: 0 8px 22px color-mix(in srgb, var(--primary) 16%, transparent);\n  color: var(--primary);\n  font-size: 12px;\n  font-weight: 400;\n  line-height: 1.45;\n  text-align: left;\n  white-space: normal;\n  opacity: 0;\n  pointer-events: none;\n  transform: translateY(-4px);\n  transition:\n    opacity 0.16s ease,\n    transform 0.16s ease;\n}\n.sfp-help-tooltip.visible {\n  opacity: 1;\n  transform: translateY(0);\n}\n.sfp-setting-row input[type=\"checkbox\"] {\n  flex-shrink: 0;\n  margin: 0;\n}\n.sfp-setting-interval {\n  display: none;\n  grid-template-columns: minmax(0, 1fr) 58px auto;\n  align-items: center;\n  column-gap: 6px;\n  margin-top: 6px;\n  font-size: 12px;\n  color: var(--primary-medium);\n}\n.sfp-setting-interval.visible {\n  display: grid;\n}\n.sfp-setting-row.hidden,\n.sfp-setting-interval.hidden {\n  display: none;\n}\n.sfp-setting-interval input {\n  width: 58px;\n  height: 26px;\n  padding: 2px 6px;\n  border: 1px solid var(--primary-low);\n  border-radius: 4px;\n  background: var(--secondary);\n  color: var(--primary);\n  font-size: 12px;\n}\n\n/* ===== 自定义下拉 ===== */\n.sfp-custom-select {\n  position: relative;\n  flex-shrink: 0;\n}\n.sfp-custom-select-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 4px 10px;\n  font-size: 12px;\n  height: 28px;\n  border: none;\n  background: var(--primary-very-low);\n  color: var(--primary);\n  border-radius: 6px;\n  cursor: pointer;\n  white-space: nowrap;\n  user-select: none;\n  transition:\n    background 0.2s,\n    color 0.2s;\n}\n.sfp-custom-select-btn:hover {\n  background: var(--primary-low);\n}\n.sfp-custom-select-btn::after {\n  content: \"\";\n  width: 0;\n  height: 0;\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-top: 5px solid currentColor;\n}\n.sfp-custom-select-dropdown {\n  position: absolute;\n  top: calc(100% + 4px);\n  left: 0;\n  min-width: 100%;\n  background: var(--secondary);\n  border: 1px solid var(--primary-low);\n  border-radius: 6px;\n  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 10%, transparent);\n  z-index: 10002;\n  display: none;\n  overflow: hidden;\n}\n.sfp-custom-select.open .sfp-custom-select-dropdown {\n  display: block;\n}\n.sfp-custom-select-option {\n  display: block;\n  width: 100%;\n  padding: 6px 14px;\n  font-size: 12px;\n  border: none;\n  background: none;\n  color: var(--primary);\n  cursor: pointer;\n  text-align: left;\n  white-space: nowrap;\n  transition: background 0.15s;\n}\n.sfp-custom-select-option:hover {\n  background: var(--primary-very-low);\n}\n.sfp-custom-select-option.selected {\n  color: var(--tertiary);\n  font-weight: 600;\n}\n\n/* ===== 分类标签栏 ===== */\n.sfp-tab-shell {\n  position: relative;\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 36px;\n  align-items: stretch;\n  width: 100%;\n  min-width: 0;\n  max-width: 100%;\n  border-bottom: 1px solid var(--primary-low);\n  flex-shrink: 0;\n  background: var(--d-content-background, var(--secondary));\n}\n.sfp-tab-bar {\n  display: flex;\n  gap: 8px;\n  overflow-x: auto;\n  overflow-y: hidden;\n  -webkit-overflow-scrolling: touch;\n  scrollbar-width: none;\n  width: 100%;\n  min-width: 0;\n  max-width: 100%;\n  padding: 8px 12px;\n  margin: 0;\n  flex-shrink: 0;\n  background: transparent;\n}\n.sfp-tab-bar::-webkit-scrollbar {\n  display: none;\n}\n.sfp-tab-item {\n  display: inline-flex;\n  align-items: center;\n  gap: 3px;\n  padding: 4px 12px;\n  font-size: 13px;\n  color: var(--primary-medium);\n  cursor: pointer;\n  white-space: nowrap;\n  border-radius: 16px;\n  background: var(--primary-very-low);\n  transition: all 0.2s;\n  border: 1px solid transparent;\n  flex-shrink: 0;\n  user-select: none;\n}\n.sfp-tab-item:hover {\n  color: var(--primary);\n  background: var(--primary-low);\n}\n.sfp-tab-item.active {\n  color: var(--secondary);\n  background: var(--tertiary);\n  border-color: var(--tertiary);\n}\n.sfp-tab-item svg {\n  width: 12px;\n  height: 12px;\n  fill: currentColor;\n  flex-shrink: 0;\n}\n.sfp-category-color-marker {\n  width: 0.72em;\n  height: 0.72em;\n  border-radius: 50%;\n  background: var(--sfp-category-marker-color, currentColor);\n  box-shadow: inset 0 0 0 1px\n    color-mix(in srgb, var(--primary) 12%, transparent);\n  flex: 0 0 auto;\n}\n.sfp-tab-more-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  min-width: 36px;\n  padding: 0;\n  border: none;\n  border-left: 1px solid var(--primary-low);\n  background: var(--d-content-background, var(--secondary));\n  color: var(--primary-medium);\n  cursor: pointer;\n  transition:\n    background 0.2s,\n    color 0.2s;\n}\n.sfp-tab-more-btn:hover,\n.sfp-tab-shell.open .sfp-tab-more-btn {\n  background: var(--primary-very-low);\n  color: var(--primary);\n}\n.sfp-tab-more-btn svg {\n  width: 16px;\n  height: 16px;\n  fill: currentColor;\n}\n.sfp-tab-panel {\n  position: absolute;\n  top: 100%;\n  right: 8px;\n  left: 8px;\n  display: none;\n  padding: 10px;\n  max-height: min(58vh, 420px);\n  overflow-y: auto;\n  background: var(--secondary);\n  border: 1px solid var(--primary-low);\n  border-radius: 8px;\n  box-shadow: 0 10px 28px color-mix(in srgb, var(--primary) 16%, transparent);\n  z-index: 10002;\n}\n.sfp-tab-shell.open .sfp-tab-panel {\n  display: block;\n}\n.sfp-tab-panel-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  margin-bottom: 8px;\n  font-size: 12px;\n  color: var(--primary-medium);\n  line-height: 1.3;\n}\n.sfp-tab-panel-title {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n}\n.sfp-tab-panel-title svg {\n  width: 13px;\n  height: 13px;\n  fill: currentColor;\n  flex-shrink: 0;\n}\n.sfp-tab-panel-close {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  padding: 0;\n  border: none;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--primary-medium);\n  cursor: pointer;\n}\n.sfp-tab-panel-close:hover {\n  background: var(--primary-very-low);\n  color: var(--primary);\n}\n.sfp-tab-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));\n  gap: 6px;\n}\n.sfp-tab-grid-item {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 5px;\n  min-width: 0;\n  min-height: 32px;\n  padding: 6px 8px;\n  border: 1px solid transparent;\n  border-radius: 6px;\n  background: var(--primary-very-low);\n  color: var(--primary-medium);\n  cursor: pointer;\n  font-size: 12px;\n  line-height: 1.2;\n  text-align: center;\n  user-select: none;\n  transition:\n    background 0.15s,\n    border-color 0.15s,\n    color 0.15s,\n    opacity 0.15s;\n}\n.sfp-tab-grid-item svg {\n  width: 12px;\n  height: 12px;\n  fill: currentColor;\n  flex: 0 0 auto;\n}\n.sfp-tab-grid-item .sfp-category-color-marker {\n  width: 0.75em;\n  height: 0.75em;\n}\n.sfp-tab-grid-item span {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.sfp-tab-grid-item:hover {\n  background: var(--primary-low);\n  color: var(--primary);\n}\n.sfp-tab-grid-item.active {\n  background: var(--tertiary);\n  border-color: var(--tertiary);\n  color: var(--secondary);\n}\n.sfp-tab-grid-item.dragging {\n  opacity: 0.45;\n}\n.sfp-tab-grid-item.drop-target {\n  border-color: var(--tertiary);\n  box-shadow: inset 0 0 0 1px var(--tertiary);\n}\n\n/* ===== 筛选栏 ===== */\n.sfp-filter-bar {\n  position: relative;\n  z-index: 3;\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  width: 100%;\n  min-width: 0;\n  max-width: 100%;\n  padding: 8px 16px;\n  margin: 0;\n  background: var(--primary-very-low);\n  border-bottom: 1px solid var(--primary-low);\n  font-size: 12px;\n  color: var(--primary-medium);\n  flex-shrink: 0;\n}\n.sfp-filter-item {\n  cursor: pointer;\n  padding: 2px 6px;\n  border-radius: 4px;\n  transition: all 0.2s;\n  user-select: none;\n}\n.sfp-filter-item:hover {\n  color: var(--tertiary);\n  background: var(--primary-low);\n}\n.sfp-filter-item.active {\n  color: var(--secondary);\n  background: var(--tertiary);\n}\n\n/* ===== Feed 滚动区 ===== */\n.sfp-feed-scroll {\n  position: relative;\n  flex: 1;\n  min-width: 0;\n  max-width: 100%;\n  overflow-y: auto;\n  overflow-x: hidden;\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior-y: contain;\n  touch-action: pan-y pinch-zoom;\n  --scrollbarBg: transparent;\n  --scrollbarThumbBg: var(--d-selected, var(--token-color-surface-hovered));\n  --scrollbarWidth: var(--space-2, 0.5em);\n  scrollbar-gutter: stable;\n  scrollbar-color: var(--scrollbarThumbBg) var(--scrollbarBg);\n}\n.sfp-feed-scroll::-webkit-scrollbar {\n  width: var(--scrollbarWidth);\n}\n.sfp-feed-scroll::-webkit-scrollbar-thumb {\n  background-color: var(--scrollbarThumbBg);\n  border-radius: calc(var(--scrollbarWidth) / 2);\n}\n.sfp-feed-scroll::-webkit-scrollbar-track {\n  background-color: transparent;\n}\n.sfp-content-wrapper {\n  position: relative;\n  min-width: 0;\n  max-width: 100%;\n  min-height: 100%;\n}\n\n/* ===== 帖子列表项 ===== */\n.sfp-topic-item {\n  display: block;\n  padding: 12px 20px;\n  border-bottom: 1px solid var(--primary-very-low);\n  color: inherit;\n  cursor: pointer;\n  text-decoration: none;\n  transition: background 0.2s;\n  position: relative;\n  min-width: 0;\n  max-width: 100%;\n  overflow-wrap: break-word;\n  word-break: break-word;\n}\n.sfp-topic-item:visited,\n.sfp-topic-item:hover,\n.sfp-topic-item:focus {\n  color: inherit;\n  text-decoration: none;\n}\n.sfp-topic-item:hover {\n  background: var(--primary-very-low);\n}\n.sfp-topic-item:focus-visible {\n  outline: 2px solid var(--tertiary);\n  outline-offset: -2px;\n}\n.sfp-topic-item.sfp-filter-mismatch {\n  opacity: 0.48;\n  filter: grayscale(0.85);\n}\n.sfp-topic-item.sfp-topic-unavailable {\n  opacity: 0.62;\n}\n.sfp-topic-item.sfp-topic-unavailable .sfp-topic-title-line {\n  text-decoration: line-through;\n}\n.sfp-topic-item.sfp-new-highlight {\n  --sfp-new-highlight-color: var(--tertiary-med-or-tertiary, var(--tertiary));\n  animation: sfp-new-pulse 10s ease-out forwards;\n  position: relative;\n}\n@keyframes sfp-new-pulse {\n  0% {\n    box-shadow: inset 0 0 0 2px var(--sfp-new-highlight-color);\n    background: color-mix(\n      in srgb,\n      var(--sfp-new-highlight-color) 15%,\n      transparent\n    );\n  }\n  100% {\n    box-shadow: inset 0 0 0 0px transparent;\n    background: transparent;\n  }\n}\n\n/* 未读圆点 — 紧跟在时间后 */\n.sfp-topic-item .sfp-topic-time {\n  font-size: 12px;\n  color: var(--primary-medium);\n  white-space: nowrap;\n  margin-left: auto;\n  flex-shrink: 0;\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  line-height: 1;\n}\n.sfp-topic-item .sfp-unread-dot {\n  width: 8px;\n  height: 8px;\n  flex: 0 0 8px;\n  display: inline-block;\n  border-radius: 50%;\n  color: var(--tertiary-med-or-tertiary, var(--tertiary));\n  background: currentColor;\n  opacity: 0.75;\n  vertical-align: middle;\n}\n.sfp-topic-item .sfp-unread-dot.sfp-unread-dot--hidden {\n  visibility: hidden;\n}\n\n/* 头像 + 用户信息行 */\n.sfp-topic-item .sfp-topic-header {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 5px;\n}\n.sfp-topic-item .sfp-topic-user-link {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  min-width: 0;\n  color: inherit;\n  text-decoration: none;\n  cursor: pointer;\n}\n/* 防止父级 topic 链接的 hover/focus 样式把用户入口改成普通文本。 */\n.sfp-topic-item .sfp-topic-user-link:hover,\n.sfp-topic-item .sfp-topic-user-link:focus {\n  color: inherit;\n  text-decoration: none;\n}\n.sfp-topic-item .sfp-topic-user-link:focus-visible {\n  outline: 2px solid var(--tertiary);\n  outline-offset: 2px;\n  border-radius: 4px;\n}\n.sfp-topic-item .sfp-topic-avatar {\n  width: 28px;\n  height: 28px;\n  border-radius: 50%;\n  flex-shrink: 0;\n  object-fit: cover;\n}\n.sfp-topic-item .sfp-topic-meta-col {\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n  flex: 1;\n}\n.sfp-topic-item .sfp-topic-user-info {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  flex-wrap: wrap;\n  overflow: hidden;\n}\n.sfp-topic-item .sfp-topic-username {\n  font-size: 13px;\n  color: var(--primary);\n  font-weight: 500;\n  cursor: pointer;\n  transition: color 0.2s;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.sfp-topic-item .sfp-topic-username:hover {\n  color: var(--tertiary);\n}\n.sfp-topic-item .sfp-topic-name {\n  font-size: 12px;\n  color: var(--primary-medium);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n/* 标题 */\n.sfp-topic-item .sfp-topic-title {\n  font-size: 14px;\n  font-weight: bold;\n  color: var(--primary);\n  line-height: 1.4;\n  margin: 0;\n  word-break: break-word;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  transition: color 0.2s;\n}\n.sfp-topic-item .sfp-topic-title:hover {\n  color: var(--tertiary);\n}\n.sfp-topic-item.sfp-read .sfp-topic-title {\n  color: var(--title-color--read, var(--primary-medium));\n}\n.sfp-topic-item .sfp-topic-title-line {\n  display: inline;\n}\n.sfp-topic-item .sfp-topic-status-badges {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  margin-left: 2px;\n  flex-shrink: 0;\n}\n.sfp-topic-item .topic-status-card {\n  --badge-accent: var(--primary-medium);\n  --badge-bg: var(--primary-very-low);\n  --badge-border: var(--primary-low);\n  display: inline-flex;\n  align-items: center;\n  gap: 3px;\n  padding: 1px 6px;\n  border: 1px solid var(--badge-border);\n  border-radius: var(--d-border-radius, 8px);\n  background: var(--badge-bg);\n  color: var(--badge-accent);\n  font-size: 11px;\n  font-weight: 700;\n  line-height: 1.45;\n  margin-right: 5px;\n  vertical-align: middle;\n  white-space: nowrap;\n  box-shadow: inset 0 0 0 1px\n    color-mix(in srgb, var(--badge-accent) 8%, transparent);\n}\n.sfp-topic-item .topic-status-card.--hot {\n  --badge-accent: var(--danger);\n  --badge-bg: var(--danger-low, var(--d-hover, var(--tertiary-low)));\n  --badge-border: color-mix(in srgb, var(--danger) 28%, transparent);\n}\n.sfp-topic-item .topic-status-card.--pinned {\n  --badge-accent: var(--primary-medium);\n  --badge-bg: var(--primary-very-low);\n  --badge-border: var(--primary-low);\n}\n.sfp-topic-item .topic-status-card.--unavailable {\n  --badge-accent: var(--danger);\n  --badge-bg: var(--danger-low, var(--d-hover, var(--tertiary-low)));\n  --badge-border: color-mix(in srgb, var(--danger) 28%, transparent);\n}\n.sfp-topic-item .topic-status-card__name {\n  color: var(--badge-accent);\n  font-size: inherit;\n  font-weight: inherit;\n  line-height: inherit;\n  margin: 0;\n}\n.sfp-topic-item .topic-status-card .d-icon {\n  color: var(--badge-accent);\n  width: 0.92em;\n  height: 0.92em;\n  flex-shrink: 0;\n}\n.sfp-topic-item .topic-statuses {\n  float: left;\n}\n.sfp-topic-item .topic-statuses .topic-status {\n  display: inline-flex;\n  align-items: center;\n  color: var(--primary-medium);\n  margin: 0 0.18em 0 0;\n  --icon-size: 0.86em;\n}\n.sfp-topic-item .topic-statuses .topic-status .d-icon {\n  width: var(--icon-size);\n  height: var(--icon-size);\n  color: currentColor;\n}\n\n/* 分类 + 标签行 */\n.sfp-topic-item .sfp-topic-category-tags {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 4px;\n  margin-top: 5px;\n}\n.sfp-topic-item .sfp-category-badge {\n  --badge-category-bg: light-dark(\n    oklch(from var(--category-badge-color) 97% calc(c * 0.3) h),\n    oklch(from var(--category-badge-color) 45% calc(c * 0.5) h)\n  );\n  --badge-category-text: light-dark(\n    oklch(from var(--category-badge-color) 35% calc(c * 0.6) h),\n    oklch(from var(--category-badge-color) 95% calc(c * 0.2) h)\n  );\n  display: inline-flex;\n  align-items: center;\n  gap: 0.33em;\n  font-size: 11px;\n  padding: 2px 6px;\n  border-radius: var(--d-border-radius, 4px);\n  background-color: var(--badge-category-bg, var(--primary-very-low));\n  color: var(--badge-category-text, var(--primary-medium));\n  flex-shrink: 0;\n  max-width: 120px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.sfp-topic-item .sfp-category-badge .badge-category {\n  min-width: 0;\n  align-items: center;\n}\n.sfp-topic-item .sfp-category-badge .badge-category__name {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  color: var(--badge-category-text, var(--primary-medium));\n}\n.sfp-topic-item .sfp-category-badge .d-icon {\n  width: 0.9em;\n  height: 0.9em;\n  flex-shrink: 0;\n}\n@supports not (color: light-dark(tan, tan)) {\n  .sfp-topic-item .sfp-category-badge {\n    --badge-category-bg: color-mix(\n      in srgb,\n      var(--category-badge-color) 16%,\n      transparent\n    );\n    --badge-category-text: var(--primary-high);\n  }\n}\n\n/* 标签 */\n.sfp-topic-item .sfp-topic-tags {\n  display: flex;\n  gap: 3px;\n  flex-wrap: wrap;\n}\n.sfp-topic-item .sfp-tag {\n  font-size: 11px;\n  padding: 2px 6px;\n  border-radius: var(--d-border-radius, 4px);\n  line-height: 1.4;\n  max-width: 96px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  flex-shrink: 1;\n}\n.sfp-topic-item .sfp-tag .tag-icon .d-icon {\n  width: 0.9em;\n  height: 0.9em;\n}\n\n/* 统计行 */\n.sfp-topic-item .sfp-topic-stats {\n  display: flex;\n  gap: 12px;\n  margin-top: 8px;\n  font-size: 12px;\n  color: var(--primary-medium);\n}\n.sfp-topic-item .sfp-topic-stat {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n.sfp-topic-item .sfp-topic-stat .d-icon {\n  width: 1em;\n  height: 1em;\n}\n\n/* ===== 加载状态 ===== */\n.sfp-loading {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  padding: 40px 20px;\n  color: var(--primary-medium);\n  font-size: 13px;\n  gap: 12px;\n}\n.sfp-spinner {\n  width: 28px;\n  height: 28px;\n  border: 3px solid var(--primary-low);\n  border-top-color: var(--tertiary);\n  border-radius: 50%;\n  animation: sfp-spin 0.8s linear infinite;\n}\n.sfp-empty {\n  text-align: center;\n  padding: 40px 10px;\n  color: var(--primary-medium);\n  font-size: 13px;\n}\n.sfp-load-more {\n  padding: 14px 10px;\n  text-align: center;\n  font-size: 12px;\n  color: var(--primary-medium);\n  cursor: pointer;\n  transition: color 0.2s;\n}\n.sfp-load-more-error {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: 8px;\n  cursor: default;\n}\n.sfp-load-more-error .sfp-load-more-retry {\n  padding: 4px 10px;\n  border: none;\n  border-radius: 4px;\n  background: var(--tertiary);\n  color: var(--secondary);\n  cursor: pointer;\n  font-size: 12px;\n}\n.sfp-load-more:hover {\n  color: var(--tertiary);\n}\n.sfp-load-more .sfp-load-more-spinner {\n  display: inline-block;\n  width: 14px;\n  height: 14px;\n  border: 2px solid var(--primary-low);\n  border-top-color: var(--tertiary);\n  border-radius: 50%;\n  animation: sfp-spin 0.8s linear infinite;\n  vertical-align: middle;\n  margin-right: 6px;\n}\n.sfp-no-more {\n  padding: 14px 10px;\n  text-align: center;\n  font-size: 11px;\n  color: var(--primary-low-mid);\n}\n.sfp-load-more-note {\n  padding: 10px 10px 0;\n  text-align: center;\n  font-size: 12px;\n  color: var(--primary-medium);\n}\n.sfp-error {\n  padding: 40px 20px;\n  text-align: center;\n  color: var(--danger);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 10px;\n}\n.sfp-error-icon {\n  font-size: 32px;\n}\n.sfp-error-msg {\n  font-size: 14px;\n  font-weight: 600;\n}\n.sfp-error-detail {\n  font-size: 12px;\n  color: var(--primary-medium);\n  word-break: break-word;\n}\n.sfp-error .sfp-retry-btn {\n  margin-top: 6px;\n  padding: 6px 16px;\n  background: var(--tertiary);\n  color: var(--secondary);\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  font-size: 12px;\n  transition: opacity 0.2s;\n}\n.sfp-error .sfp-retry-btn:hover {\n  opacity: 0.85;\n}\n";
	var instance = null;
	var menuRegistered = false;
	function startFeedPanel() {
		if (instance) return instance;
		const storage = createSiteStorage(location.origin, gm);
		storage.migrateLegacy();
		const discourse = createDiscourseBridge(gm.pageWindow());
		const prefs = new Preferences(storage);
		let controller;
		const site = createSiteData({
			storage,
			getCsrfToken: discourse.getCsrfToken,
			onChange: () => {
				controller?.normalizeSiteState();
			}
		});
		const tags = createTagStyles({
			storage,
			site
		});
		controller = createFeedController({
			storage,
			discourse,
			prefs,
			site,
			tags
		});
		const style = gm.addStyle(feed_default);
		const application = {
			clearCaches: controller.clearCaches,
			dispose() {
				if (instance !== application) return;
				instance = null;
				controller?.dispose();
				tags.dispose();
				site.dispose();
				discourse.dispose();
				style?.remove();
			}
		};
		instance = application;
		if (!menuRegistered) {
			gm.registerMenu("SFP: 清空分类和标签缓存", () => instance?.clearCaches({ reload: true }));
			menuRegistered = true;
		}
		try {
			const page = gm.pageWindow();
			page.SFPFeedPanel = Object.assign(page.SFPFeedPanel || {}, {
				clearCaches: () => instance?.clearCaches({ reload: true }),
				dispose: () => instance?.dispose(),
				start: () => {
					startFeedPanel();
				}
			});
		} catch (error) {
			console.warn("[SFP] setup cache controls failed:", error);
		}
		controller.start();
		return application;
	}
	if (window.top === window.self) startFeedPanel();
})();
