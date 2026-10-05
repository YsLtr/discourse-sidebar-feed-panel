import { CATEGORY_DATA_CACHE_VERSION } from "../constants";
import { objectPayload } from "../platform/json";
import { Lifetime } from "../platform/lifetime";
import type { ValueStore } from "../preferences";
import { CATEGORY_DATA_CACHE_KEY, TAB_ORDER_KEY } from "../storage-keys";
import {
  _normalizeHexColor,
  _safeCategoryStyleType,
  _safeIconName,
} from "./appearance";
import type {
  CategoryCache,
  CategoryListPayload,
  CategoryRecord,
  CategorySource,
  CategoryTab,
  NavigationEntry,
  SitePayload,
} from "./types";
export const ORDER_OPTION_DEFS = [
  { labelKey: "orderActivity", value: "activity", capability: "latest" },
  { labelKey: "orderCreated", value: "created", capability: "new" },
  { labelKey: "orderViews", value: "views", capability: "top" },
  { labelKey: "orderPosts", value: "posts", capability: "top" },
  { labelKey: "orderLikes", value: "likes", capability: "top" },
  { labelKey: "orderOpLikes", value: "op_likes", capability: "top" },
];
export const PERIOD_OPTION_DEFS = [
  { labelKey: "periodAll", value: "all" },
  { labelKey: "periodDaily", value: "daily" },
  { labelKey: "periodWeekly", value: "weekly" },
  { labelKey: "periodMonthly", value: "monthly" },
  { labelKey: "periodQuarterly", value: "quarterly" },
  { labelKey: "periodYearly", value: "yearly" },
];
export const FILTER_OPTION_DEFS = [
  { labelKey: "filterAll", value: "all" },
  { labelKey: "filterUnseen", value: "unseen" },
  { labelKey: "filterRead", value: "read" },
];

export function createSiteData({
  storage,
  getCsrfToken,
  onChange,
}: {
  storage: ValueStore;
  getCsrfToken: () => string;
  onChange: () => void;
}) {
  let scope = new Lifetime();
  const _getSiteValue = storage.get;
  const _setSiteValue = storage.set;
  const categoryMetaById = new Map<
    number,
    ReturnType<typeof _normalizeCategoryMeta>
  >();
  let tabCategories: CategoryTab[] = [];
  let siteCapabilities = _createDefaultSiteCapabilities();
  let categoryMetaPromise: Promise<void> | null = null;
  let categoryMetaLoaded = false;
  let siteDataPromise: Promise<SitePayload | null> | null = null;
  let siteDataLoaded = false;
  let siteDataCache: SitePayload | null = null;
  let categoriesAndLatestPromise: Promise<CategoryListPayload | null> | null =
    null;
  let categoriesAndLatestLoaded = false;
  let categoriesAndLatestCache: CategoryListPayload | null = null;
  function _createDefaultSiteCapabilities() {
    return {
      orderValues: new Set(ORDER_OPTION_DEFS.map((option) => option.value)),
      periodValues: new Set(PERIOD_OPTION_DEFS.map((option) => option.value)),
      filterValues: new Set(FILTER_OPTION_DEFS.map((option) => option.value)),
      rawFilters: new Set<string>(),
      rawTopMenuItems: new Set<string>(),
    };
  }

  function _stringSet(values: unknown) {
    return new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    );
  }

  function _updateSiteCapabilities(site: SitePayload) {
    const rawFilters = _stringSet(site?.filters);
    const rawTopMenuItems = _stringSet(site?.top_menu_items);
    _stringSet(site?.anonymous_top_menu_items).forEach((item) =>
      rawTopMenuItems.add(item),
    );
    rawTopMenuItems.forEach((item) => rawFilters.add(item));

    const supportsLatest = rawFilters.size === 0 || rawFilters.has("latest");
    const supportsNew = rawFilters.has("new");
    const supportsTop = rawFilters.has("top");
    const orderValues = new Set<string>();
    if (supportsLatest) orderValues.add("activity");
    if (supportsNew || supportsLatest) orderValues.add("created");
    if (supportsTop) {
      ["views", "posts", "likes", "op_likes"].forEach((order) =>
        orderValues.add(order),
      );
    }
    if (orderValues.size === 0) orderValues.add("activity");

    const sitePeriods = _stringSet(site?.periods);
    const periodValues =
      sitePeriods.size > 0
        ? new Set(
            PERIOD_OPTION_DEFS.map((option) => option.value).filter((value) =>
              sitePeriods.has(value),
            ),
          )
        : new Set(PERIOD_OPTION_DEFS.map((option) => option.value));
    if (periodValues.size === 0) periodValues.add("all");

    const filterValues = new Set(["all"]);
    if (
      rawFilters.has("unseen") ||
      rawFilters.has("unread") ||
      rawFilters.has("new")
    ) {
      filterValues.add("unseen");
    }
    if (rawFilters.has("read")) filterValues.add("read");

    siteCapabilities = {
      orderValues,
      periodValues,
      filterValues,
      rawFilters,
      rawTopMenuItems,
    };
  }

  function _categoryTabId(id: number) {
    return `cat-${Number(id)}`;
  }

  function _findTabCategoryByTabId(tabId: string) {
    return (
      tabCategories.find((cat) => {
        return cat.tabId === tabId || cat.legacyTabIds?.includes(tabId);
      }) || null
    );
  }

  function _categoryIdFromPath(value: unknown) {
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

  function _categoryListCategories(data: CategoryListPayload | null) {
    return Array.isArray(data?.category_list?.categories)
      ? data.category_list.categories
      : [];
  }

  function _mergeCategoryRecords(
    ...categoryLists: Array<CategoryRecord[] | undefined>
  ) {
    const rawById = new Map<number, CategoryRecord>();
    categoryLists.forEach((categoryList) => {
      if (!Array.isArray(categoryList)) return;
      categoryList.forEach((cat) => {
        const id = Number(cat?.id);
        if (!Number.isFinite(id)) return;
        rawById.set(id, {
          ...(rawById.get(id) || {}),
          ...cat,
          id,
        });
      });
    });
    return Array.from(rawById.values());
  }

  function _collectNavigationCategoryIds(
    site: SitePayload,
    rawById: Map<number, CategoryRecord>,
    categoryListCategories: CategoryRecord[] = [],
  ) {
    const ids: number[] = [];
    const seen = new Set();
    const addId = (value: unknown) => {
      const id = Number(value);
      if (!Number.isInteger(id) || id <= 0 || !rawById.has(id) || seen.has(id))
        return;
      seen.add(id);
      ids.push(id);
    };
    const addRecord = (record: NavigationEntry) => {
      if (!record) return;
      if (typeof record === "number" || typeof record === "string") {
        addId(record);
        const pathId = _categoryIdFromPath(String(record));
        if (pathId) addId(pathId);
        return;
      }
      if (typeof record !== "object") return;
      addId(record.category_id ?? record.categoryId ?? record.category?.id);
      const recordType = String(
        record.type || record.section_type || "",
      ).toLowerCase();
      const isCategoryRecord =
        recordType === "category" ||
        record.topic_count !== undefined ||
        record.parent_category_id !== undefined ||
        record.read_restricted !== undefined;
      if (isCategoryRecord && record.id !== undefined) {
        addId(record.id);
      }
      [
        record.value,
        record.url,
        record.href,
        record.path,
        record.link,
        record.route,
      ].forEach((path) => {
        const pathId = _categoryIdFromPath(path);
        if (pathId) addId(pathId);
      });
    };
    const addRecords = (records: NavigationEntry[] | undefined) => {
      if (!Array.isArray(records)) return;
      records.forEach(addRecord);
    };

    [
      site?.navigation_menu_categories,
      site?.navigation_menu_site_categories,
      site?.default_navigation_menu_categories,
      site?.anonymous_default_navigation_menu_categories,
    ].forEach(addRecords);

    [
      site?.anonymous_sidebar_sections,
      site?.sidebar_sections,
      site?.navigation_menu_sections,
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

  function _buildTabCategories(
    site: SitePayload,
    navigationCategories: CategoryRecord[],
    rawById: Map<number, CategoryRecord>,
  ) {
    return _collectNavigationCategoryIds(site, rawById, navigationCategories)
      .map((id) => _getCategoryMeta(id))
      .filter((meta): meta is NonNullable<typeof meta> => !!meta?.name)
      .map((meta) => ({
        id: meta.id,
        tabId: _categoryTabId(meta.id),
        legacyTabIds: [meta.slug].filter(Boolean),
        name: meta.name,
        icon: meta.icon,
        color: `#${meta.color}`,
        slug: meta.slug,
      }));
  }

  function _normalizeCategoryMeta(
    raw: CategoryRecord = {},
    parent: CategoryRecord | null = null,
  ) {
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
      parent_text_color: parent
        ? _normalizeHexColor(parent.text_color, "FFFFFF")
        : null,
      read_restricted: !!raw.read_restricted,
      description_text:
        raw.description_text ||
        raw.description_excerpt ||
        raw.description ||
        "",
      description_excerpt:
        raw.description_excerpt ||
        raw.description_text ||
        raw.description ||
        "",
    };
  }

  function _getCategoryMeta(id: unknown) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    return categoryMetaById.get(numericId) || null;
  }

  function _cloneJsonArray<T>(value: T[] | undefined): T[] {
    if (!Array.isArray(value)) return [];
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return [];
    }
  }

  function _createCategoryDataCacheSource(
    site: SitePayload = {},
    navigationCategories: CategoryRecord[] = [],
  ) {
    return {
      site: {
        categories: _cloneJsonArray(site?.categories),
        filters: _cloneJsonArray(site?.filters),
        periods: _cloneJsonArray(site?.periods),
        top_menu_items: _cloneJsonArray(site?.top_menu_items),
        anonymous_top_menu_items: _cloneJsonArray(
          site?.anonymous_top_menu_items,
        ),
        top_tags: _cloneJsonArray(site?.top_tags),
        can_tag_topics: site?.can_tag_topics,
        navigation_menu_categories: _cloneJsonArray(
          site?.navigation_menu_categories,
        ),
        navigation_menu_site_categories: _cloneJsonArray(
          site?.navigation_menu_site_categories,
        ),
        default_navigation_menu_categories: _cloneJsonArray(
          site?.default_navigation_menu_categories,
        ),
        anonymous_default_navigation_menu_categories: _cloneJsonArray(
          site?.anonymous_default_navigation_menu_categories,
        ),
        anonymous_sidebar_sections: _cloneJsonArray(
          site?.anonymous_sidebar_sections,
        ),
        sidebar_sections: _cloneJsonArray(site?.sidebar_sections),
        navigation_menu_sections: _cloneJsonArray(
          site?.navigation_menu_sections,
        ),
      },
      navigationCategories: _cloneJsonArray(navigationCategories),
    };
  }

  function _applyCategoryDataSource(
    source: CategorySource,
    { primeSiteData = false } = {},
  ) {
    const site = source?.site || {};
    const navigationCategories = Array.isArray(source?.navigationCategories)
      ? source.navigationCategories
      : [];
    const categories = _mergeCategoryRecords(
      site?.categories,
      navigationCategories,
    );
    const rawById = new Map(categories.map((cat) => [Number(cat.id), cat]));

    _updateSiteCapabilities(site);
    categoryMetaById.clear();

    categories.forEach((cat) => {
      const id = Number(cat.id);
      if (!Number.isFinite(id)) return;
      const parent = cat.parent_category_id
        ? rawById.get(Number(cat.parent_category_id))
        : null;
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
      const cache = _getSiteValue<CategoryCache | null>(
        CATEGORY_DATA_CACHE_KEY,
        null,
      );
      if (
        !cache ||
        cache.version !== CATEGORY_DATA_CACHE_VERSION ||
        !cache.source
      )
        return null;

      const source = cache.source;
      if (
        !source.site ||
        !Array.isArray(source.site.categories) ||
        !Array.isArray(source.navigationCategories)
      ) {
        return null;
      }
      return source;
    } catch (e) {
      console.warn("[SFP] load category data cache failed:", e);
      return null;
    }
  }

  function _saveCategoryDataCache(source: CategorySource) {
    try {
      _setSiteValue(CATEGORY_DATA_CACHE_KEY, {
        version: CATEGORY_DATA_CACHE_VERSION,
        savedAt: Date.now(),
        source,
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

  function getCategoryTabMeta(cat: CategoryTab) {
    const meta = _getCategoryMeta(cat.id);
    return {
      ...cat,
      name: meta?.name || cat.name,
      icon: meta?.icon || cat.icon,
      color: meta?.color ? `#${meta.color}` : cat.color,
    };
  }

  function _getSavedTabOrder() {
    const savedOrder = _getSiteValue<number[]>(TAB_ORDER_KEY, []);
    if (!Array.isArray(savedOrder)) return [];
    return savedOrder
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
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

  function _parsePreloadedPayload(raw: string) {
    if (!raw) return null;
    try {
      const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
      return objectPayload<
        SitePayload & { _site?: SitePayload; site?: SitePayload }
      >(JSON.parse(decoded));
    } catch (e) {
      return null;
    }
  }

  function _extractPreloadedSiteData() {
    const candidates = [
      ...document.querySelectorAll("[data-preloaded]"),
      ...document.querySelectorAll("script[type='application/json']"),
    ];
    for (const el of candidates) {
      const payload = _parsePreloadedPayload(
        el.getAttribute("data-preloaded") || el.textContent || "",
      );
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
        headers: { "X-CSRF-Token": getCsrfToken() },
      });
      if (!resp.ok) throw new Error(`site.json ${resp.status}`);
      const data = await resp.json();
      loadScope.signal.throwIfAborted();
      siteDataCache = objectPayload<SitePayload>(data);
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
        headers: { "X-CSRF-Token": getCsrfToken() },
      });
      if (!resp.ok)
        throw new Error(`categories_and_latest.json ${resp.status}`);
      const data = await resp.json();
      loadScope.signal.throwIfAborted();
      categoriesAndLatestCache = objectPayload<CategoryListPayload>(data);
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

        const [siteResult, categoriesAndLatestResult] =
          await Promise.allSettled([
            loadSiteData(),
            loadCategoriesAndLatestData(),
          ]);
        loadScope.signal.throwIfAborted();
        const site =
          siteResult.status === "fulfilled" ? siteResult.value : null;
        const categoriesAndLatest =
          categoriesAndLatestResult.status === "fulfilled"
            ? categoriesAndLatestResult.value
            : null;
        if (siteResult.status === "rejected")
          console.warn("[SFP] load site data failed:", siteResult.reason);
        if (categoriesAndLatestResult.status === "rejected")
          console.warn(
            "[SFP] load categories_and_latest failed:",
            categoriesAndLatestResult.reason,
          );
        if (!site && !categoriesAndLatest)
          throw new Error("site category metadata unavailable");

        const navigationCategories =
          _categoryListCategories(categoriesAndLatest);
        const source = _createCategoryDataCacheSource(
          site || {},
          navigationCategories,
        );
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
    dispose: () => scope.dispose(),
  };
}
