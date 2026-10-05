import { createI18n } from "../i18n";
import type { createDiscourseBridge } from "../platform/discourse";
import { Lifetime } from "../platform/lifetime";
import { createRouteWatcher } from "../platform/route-watcher";
import type { MessageBus } from "../platform/types";
import type { ValueStore } from "../preferences";
import { Preferences } from "../preferences";
import { createSiteData } from "../site/site-data";
import { createTagStyles } from "../site/tag-styles";
import * as storageKeys from "../storage-keys";
import { createControls } from "../ui/controls";
import { createFeedHost } from "../ui/host";
import { createFeedScroll } from "../ui/scroll";
import { createTopicRenderer } from "../ui/topic-item";
import { createTopicList } from "../ui/topic-list";
import { createFeedApi } from "./api";
import { AutoLoadGate } from "./auto-load";
import { IncomingTopics } from "./incoming";
import { buildFeedUrl, feedQueryKey } from "./query";
import { _hasUnreadMarker, _isPinnedTopic } from "./read-state";
import { ReadingState } from "./reading";
import { PageActivity, RefreshCountdown } from "./refresh";
import type { MergeOptions } from "./resident";
import { ResidentTopics } from "./resident";
import type {
  FeedQuerySnapshot,
  Topic,
  TopicMessage,
  TopicResponse,
} from "./types";
interface ControllerDependencies {
  storage: ValueStore;
  discourse: ReturnType<typeof createDiscourseBridge>;
  prefs: Preferences;
  site: ReturnType<typeof createSiteData>;
  tags: ReturnType<typeof createTagStyles>;
}
interface RenderMergeOptions extends MergeOptions {
  incomingCandidateIds?: readonly number[];
  filterTopic?: ((topic: Topic) => boolean) | null;
  clearIncomingForQuery?: FeedQuerySnapshot | null;
}

/** Coordinates query snapshots, request generations, subscriptions and view actions. */
export function createFeedController({
  storage,
  discourse,
  prefs,
  site,
  tags,
}: ControllerDependencies) {
  const { CATEGORY_DATA_CACHE_KEY, TAG_STYLE_CACHE_KEY } = storageKeys;
  const { delete: _deleteSiteValue } = storage;
  const {
    getCsrfToken,
    getDiscourse,
    getMessageBus,
    waitForStableHeaderMount,
  } = discourse;
  const { t, getUiLocale, formatRelativeTime } = createI18n(getDiscourse);

  const { _getCategoryMeta, _findTabCategoryByTabId, loadCategoryMetadata } =
    site;

  const { loadTagStyleIndex } = tags;
  const scroll = createFeedScroll({
    canLoadMore: () => resident.hasMore && !isLoadingMore,
    onLoadMore: () => loadMoreTopics({ source: "auto" }),
    onReadingState: () => _scheduleHeadActionStateSync(),
  });
  const FeedQuery = {
    snapshot: (): FeedQuerySnapshot => ({
      tab: prefs.currentTab,
      categoryId: currentCategoryId,
      order: prefs.currentOrder,
      period: prefs.currentPeriod,
      filter: prefs.currentFilter,
    }),
    key: feedQueryKey,
    isCurrent: (query: FeedQuerySnapshot) =>
      feedQueryKey(query) === feedQueryKey(FeedQuery.snapshot()),
    buildUrl: (query: FeedQuerySnapshot, page: number) =>
      buildFeedUrl(query, page, _getCategoryMeta),
  };
  const api = createFeedApi({
    buildUrl: FeedQuery.buildUrl,
    getCsrfToken,
    getSignal: () => requests.signal,
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
      const resizerMissing =
        !host.resizerEl || !sidebar?.contains(host.resizerEl);
      if (
        sidebar &&
        (!host.feedContainer ||
          !sidebar.contains(host.feedContainer) ||
          !sidebar.classList.contains("sfp-feed-mode") ||
          resizerMissing)
      )
        activateFeed();
    },
  });
  // 查询和异步操作运行态。

  let currentCategoryId: number | null = null;

  const resident = new ResidentTopics();
  const autoLoad = new AutoLoadGate();
  let isLoading = false;
  let loadCycle: { pending: boolean } | null = null;
  let isLoadingMore = false;
  let isRefreshing = false;

  // 自动刷新相关计时器都只存运行态，不持久化剩余秒数。页面切换或脚本重载后
  // 重新按用户配置开始倒计时，比恢复旧倒计时更容易避免重复刷新。
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
  const setTimeout = (callback: () => void, delay: number) =>
    viewScope.timeout(callback, delay);
  const clearTimeout = (id: number) => viewScope.clearTimeout(id);
  const requestAnimationFrame = (callback: FrameRequestCallback) =>
    viewScope.frame(callback);
  function invalidateRequests() {
    viewEpoch++;
    // A retired microtask returns before clearing its flag. Release it here so
    // the next query can enqueue its own silent refresh in the same event turn.
    sidebarIncomingState.applyQueued = false;
    refreshBusyCount = 0;
    requests.abort();
    requests = new AbortController();
    activeLoadToken++;
    activeLoadMoreToken++;
    activeRefreshToken++;
    sidebarIncomingState.filterRefreshToken++;
  }

  // message-bus 只告诉我们“可能有变化的话题 id”。完整话题数据仍要从
  // /latest.json?topic_ids=... 拉取；本地 cache 只用于在显示提醒前做板块范围
  // 粗筛，避免每条推送都立即请求详情。topicIds 保留完整累计候选；
  // 每次详情请求只加载最新一页候选，不能截断提醒计数。
  const incoming = new IncomingTopics();
  const reading = new ReadingState();
  const sidebarIncomingState = {
    filterRefreshTimer: null as number | null,
    filterRefreshToken: 0,
    viewSettling: false,
    filterStable: false,
    applyQueued: false,
  };
  let sidebarMessageBus: MessageBus | null = null;
  let sidebarLatestMessageBusCallback: ((data: TopicMessage) => void) | null =
    null;
  let sidebarNewMessageBusCallback: ((data: TopicMessage) => void) | null =
    null;
  // 话题删除/恢复生命周期跟踪与 incoming 跟踪相互独立：incoming 只在最新活动
  // 视图启用，而 /delete 等事件对任何排序视图都值得即时标记。
  let sidebarLifecycleMessageBus: MessageBus | null = null;
  let sidebarLifecycleMessageBusCallback:
    | ((data: TopicMessage) => void)
    | null = null;
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
    getScope: () => viewScope,
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
    getScope: () => viewScope,
  });
  const {
    createToggle,
    getSidebarElement,
    removeResizer,
    restoreSidebarWidth,
  } = host;
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
      // Filters render locally, but changing them still retires in-flight snapshots.
      if (key === "currentFilter" && changed) {
        if (isLoading) void loadTopics();
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
    _isLatestActivityView,
  });
  const {
    _getOrderOptions,
    _getPeriodOptions,
    _getFilterOptions,
    _closeFloatingPanels,
    _buildHeaderControls,
    _buildTabBar,
    _rerenderTabBar,
    _buildFilterBar,
    _refreshCategoryTabs,
    _updateSettingsControl,
  } = controls;
  const topicList = createTopicList({
    t,
    hasMore: () => resident.hasMore,
    loadMore: () => loadMoreTopics(),
    renderItem: createTopicItem,
    getScroll: () => host.feedScrollEl,
    getList: () => host.feedListEl,
    getScope: () => viewScope,
    syncHead: _syncHeadActionState,
    atHead: _isAtFeedHead,
  });

  const {
    _renderPaginationFooter,
    _showLoadMoreSpinner,
    _showNoMore,
    _showLoadMoreError,
  } = topicList;

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
      prefs.currentPeriod = site.capabilities.periodValues.has("all")
        ? "all"
        : periodOptions[0]?.value || "all";
      changed = true;
    }
    if (!site.capabilities.filterValues.has(prefs.currentFilter)) {
      prefs.currentFilter = filterOptions[0]?.value || "all";
      changed = true;
    }

    if (prefs.currentTab === "all") {
      currentCategoryId = null;
    } else {
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
      tabs: site.tabCategories.map(
        (cat) => `${cat.id}:${cat.name}:${cat.icon}:${cat.color}`,
      ),
      currentTab: prefs.currentTab,
      currentOrder: prefs.currentOrder,
      currentPeriod: prefs.currentPeriod,
      currentFilter: prefs.currentFilter,
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

    const tabShell =
      host.feedContainer?.querySelector<HTMLElement>(".sfp-tab-shell");
    if (tabShell) _rerenderTabBar(tabShell);

    const filterBar =
      host.feedContainer?.querySelector<HTMLElement>(".sfp-filter-bar");
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
    if (!host.mount(_buildHeaderControls, _buildTabBar, _buildFilterBar))
      return;
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

    // 清除数据缓存，避免下次激活时显示旧数据
    resident.reset();
    _resetAutoLoadState();
  }

  function _beginRefreshButtonBusy() {
    refreshBusyCount++;
    _syncRefreshButtonBusy();

    let ended = false;
    const busyEpoch = viewEpoch;
    // Call the returned function exactly once when the async refresh path settles.
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

  // 点击页面其他地方关闭下拉

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
    } else {
      currentCategoryId = null;
    }
  }

  function _isAtFeedHead() {
    return reading.atHead(host.feedScrollEl?.scrollTop || 0);
  }

  function _getIncomingCountDisplayValue(query = FeedQuery.snapshot()) {
    if (!prefs.showIncomingHint || !_canShowSidebarIncomingHint(query))
      return 0;
    const isAway = reading.isAway(
      host.feedScrollEl?.scrollTop || 0,
      host.feedScrollEl?.clientHeight || 0,
    );
    if (!isAway && _isAutoSilentRefreshActive(query)) return 0;
    return sidebarIncomingState.filterStable ? incoming.matchingIds.length : 0;
  }

  function _restartAutomaticRefreshTimers() {
    if (isLoading || isLoadingMore || isRefreshing) return;
    _startAutoSilentRefresh();
    _startAutoRefresh();
    if (
      _isAtFeedHead() &&
      _isAutoSilentRefreshActive() &&
      prefs.autoSilentRefreshInterval === 0
    ) {
      _queueSidebarIncomingApply();
    }
  }

  function _isAutoSilentRefreshTimerExpected() {
    return _isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval > 0;
  }

  function _isAutoRefreshTimerExpected() {
    return (
      prefs.autoRefreshEnabled && !_isLatestActivityView() && _isAtFeedHead()
    );
  }

  function _restoreMissingAutomaticRefreshTimers() {
    if (isLoading || isLoadingMore || isRefreshing) return;
    if (_isAutoSilentRefreshTimerExpected() && !silentRefresh.running) {
      _startAutoSilentRefresh();
    }
    if (_isAutoRefreshTimerExpected() && !automaticRefresh.running) {
      _startAutoRefresh();
    }
  }

  function _syncHeadActionState({ restartAuto = true } = {}) {
    if (!controls.feedRefreshBtn) return;

    const isAtHead = _isAtFeedHead();
    const isAway = reading.isAway(
      host.feedScrollEl?.scrollTop || 0,
      host.feedScrollEl?.clientHeight || 0,
    );
    // 刷新旋转期间不切换成箭头形态，避免箭头跟着旋转；结束后由 busy 翻转触发的重同步再切换。
    const isBusy = refreshBusyCount > 0;
    const incomingCount = _getIncomingCountDisplayValue();
    controls.renderHeadAction(isAway, isBusy, incomingCount);
    _syncRefreshButtonBusy();

    if (reading.away !== isAway) {
      reading.away = isAway;
      if (isAway) {
        _stopAutoRefresh();
        _stopAutoSilentRefresh();
      } else if (restartAuto && isAtHead) {
        _restartAutomaticRefreshTimers();
      }
    } else if (!isAway && restartAuto && isAtHead) {
      _restoreMissingAutomaticRefreshTimers();
    }
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
      behavior: animated ? "smooth" : "auto",
    });
    if (!animated) {
      _syncHeadActionState({ restartAuto });
      return _isAtFeedHead();
    }

    const scrollResult = await topicList.waitForHead();
    if (scrollResult === "timeout" && host.feedScrollEl && !_isAtFeedHead()) {
      host.feedScrollEl.scrollTop = 0;
    }
    _syncHeadActionState({ restartAuto });
    return scrollResult !== "interrupted" && _isAtFeedHead();
  }

  async function _handleHeadActionClick(event: MouseEvent) {
    if (
      !controls.feedRefreshBtn ||
      controls.feedRefreshBtn.getAttribute("aria-busy") === "true"
    )
      return;
    const action = controls.feedRefreshBtn.dataset.action || "refresh";

    if (event?.detail >= 2 && action === "back-top") {
      if (!_isAtFeedHead()) {
        await _returnToHead({ animated: false });
      } else {
        _syncHeadActionState();
      }
      return;
    }

    if (action === "incoming") {
      if (!_isAtFeedHead()) {
        const reachedHead = await _returnToHead({
          animated: true,
          restartAuto: false,
        });
        if (!reachedHead) {
          _syncHeadActionState();
          return;
        }
      }
      await _applySidebarIncomingTopics({
        requireDefaultView: true,
        logPrefix: "head action incoming",
        queueIfBusy: false,
        resetFeedDepth: true,
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
    if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) {
      _queueSidebarIncomingApply();
    }
  }

  function _syncIncomingHeadAction({ skipIncomingFilterRefresh = false } = {}) {
    if (!skipIncomingFilterRefresh) {
      _scheduleSidebarIncomingFilterRefresh();
    }
    _syncHeadActionState();
  }

  function _isLatestActivityView(query = FeedQuery.snapshot()) {
    return query.order === "activity";
  }

  function _canUseSidebarIncomingRefresh(query = FeedQuery.snapshot()) {
    return _isLatestActivityView(query);
  }

  function _shouldUseSidebarIncomingQueue(query = FeedQuery.snapshot()) {
    return (
      _canUseSidebarIncomingRefresh(query) &&
      (prefs.showIncomingHint || prefs.autoSilentRefreshEnabled)
    );
  }

  function _canShowSidebarIncomingHint(query = FeedQuery.snapshot()) {
    return (
      prefs.showIncomingHint &&
      _canUseSidebarIncomingRefresh(query) &&
      query.filter === "all"
    );
  }

  function _isAutoSilentRefreshActive(query = FeedQuery.snapshot()) {
    return (
      active &&
      !disposed &&
      prefs.autoSilentRefreshEnabled &&
      _isAtFeedHead() &&
      _canUseSidebarIncomingRefresh(query)
    );
  }

  function _topicMatchesCategoryScope(
    topic: Topic,
    query = FeedQuery.snapshot(),
  ) {
    if (query.tab === "all" || !query.categoryId) return true;

    let categoryId = Number(topic?.category_id);
    const targetCategoryId = Number(query.categoryId);
    if (!Number.isFinite(categoryId) || !Number.isFinite(targetCategoryId))
      return false;

    while (Number.isFinite(categoryId)) {
      if (categoryId === targetCategoryId) return true;
      const parentId = Number(_getCategoryMeta(categoryId)?.parent_category_id);
      if (!Number.isFinite(parentId) || parentId === categoryId) break;
      categoryId = parentId;
    }
    return false;
  }

  function _topicMatchesLocalFilter(
    topic: Topic,
    query = FeedQuery.snapshot(),
  ) {
    if (query.filter === "unseen") return _hasUnreadMarker(topic);
    if (query.filter === "read") return !_hasUnreadMarker(topic);
    return true;
  }

  function _topicMatchesIncomingView(
    topic: Topic,
    query = FeedQuery.snapshot(),
  ) {
    return (
      _topicMatchesIncomingCandidate(topic, query) &&
      _topicMatchesLocalFilter(topic, query)
    );
  }

  function _topicMatchesIncomingCandidate(
    topic: Topic,
    query = FeedQuery.snapshot(),
  ) {
    return (
      _canUseSidebarIncomingRefresh(query) &&
      _topicMatchesCategoryScope(topic, query)
    );
  }

  function _recomputeSidebarIncomingFilteredTopicIds(
    query = FeedQuery.snapshot(),
  ) {
    const enabled = _canUseSidebarIncomingRefresh(query);
    if (!enabled) sidebarIncomingState.filterStable = false;
    return incoming.recompute(enabled, (topic) =>
      _topicMatchesIncomingCandidate(topic, query),
    );
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
    if (sidebarIncomingState.viewSettling || isLoading || isRefreshing) {
      return incoming.matchingIds;
    }
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
    if (
      token !== sidebarIncomingState.filterRefreshToken ||
      !FeedQuery.isCurrent(requestQuery)
    )
      return incoming.matchingIds;

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
    if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) {
      _queueSidebarIncomingApply();
    }
  }

  function _startSidebarIncomingTracking() {
    if (!_shouldUseSidebarIncomingQueue()) return;
    if (sidebarLatestMessageBusCallback || sidebarNewMessageBusCallback) return;

    const messageBus = getMessageBus();
    if (!messageBus?.subscribe) {
      console.warn(
        "[SFP] message-bus service unavailable; incoming topics will not auto-update",
      );
      return;
    }

    sidebarMessageBus = messageBus;
    sidebarLatestMessageBusCallback = (data) =>
      _handleSidebarIncomingMessage(data);
    sidebarNewMessageBusCallback = (data) =>
      _handleSidebarIncomingMessage(data);
    // 同时订阅 /latest 和 /new：Discourse 在不同列表和站点配置下可能通过
    // 其中任一频道广播新话题或最新活动。lastId 使用当前 bus 实例读取，
    // 避免重新订阅时误用已经清掉的全局 sidebarMessageBus。
    messageBus.subscribe(
      "/latest",
      sidebarLatestMessageBusCallback,
      _getMessageBusLastId(messageBus, "/latest"),
    );
    messageBus.subscribe(
      "/new",
      sidebarNewMessageBusCallback,
      _getMessageBusLastId(messageBus, "/new"),
    );
  }

  function _syncSidebarIncomingTracking() {
    // Message-bus tracking only maintains incoming candidates; auto silent
    // refresh uses a separate timer to decide when those candidates are applied.
    if (prefs.feedModeEnabled && _shouldUseSidebarIncomingQueue()) {
      _startSidebarIncomingTracking();
    } else {
      _stopSidebarIncomingTracking();
    }
  }

  function _getMessageBusLastId(messageBus: MessageBus, channel: string) {
    const candidates = [
      messageBus?.lastId?.(channel),
      messageBus?.lastIdForChannel?.(channel),
      messageBus?.lastIds?.[channel],
      messageBus?.last_ids?.[channel],
      messageBus?.channels?.[channel]?.lastId,
    ];

    for (const candidate of candidates) {
      const lastId = Number(candidate);
      if (Number.isFinite(lastId)) return lastId;
    }

    return -1;
  }

  function _stopSidebarIncomingTracking() {
    if (sidebarMessageBus?.unsubscribe) {
      if (sidebarLatestMessageBusCallback) {
        sidebarMessageBus.unsubscribe(
          "/latest",
          sidebarLatestMessageBusCallback,
        );
      }
      if (sidebarNewMessageBusCallback) {
        sidebarMessageBus.unsubscribe("/new", sidebarNewMessageBusCallback);
      }
    }

    sidebarMessageBus = null;
    sidebarLatestMessageBusCallback = null;
    sidebarNewMessageBusCallback = null;
    _clearSidebarIncomingCandidates();
  }

  // Discourse 的 /delete（软删除）、/destroy（彻底删除）无条件广播，
  // /recover 对应恢复；开启 experimental_topic_category_change_notification
  // 的站点还会对 unlist/relist 复用这两个频道。默认站点手动 unlist 和
  // 举报隐藏不广播，只能靠刷新时的凭空消失检测兜底，两条路径互补。
  function _startSidebarTopicLifecycleTracking() {
    if (!prefs.feedModeEnabled) return;
    if (sidebarLifecycleMessageBusCallback) return;

    const messageBus = getMessageBus();
    if (!messageBus?.subscribe) {
      // 无 message-bus 时静默降级：仅刷新检测仍可工作。
      return;
    }

    sidebarLifecycleMessageBus = messageBus;
    sidebarLifecycleMessageBusCallback = (data) =>
      _handleSidebarTopicLifecycleMessage(data);
    messageBus.subscribe(
      "/delete",
      sidebarLifecycleMessageBusCallback,
      _getMessageBusLastId(messageBus, "/delete"),
    );
    messageBus.subscribe(
      "/recover",
      sidebarLifecycleMessageBusCallback,
      _getMessageBusLastId(messageBus, "/recover"),
    );
    messageBus.subscribe(
      "/destroy",
      sidebarLifecycleMessageBusCallback,
      _getMessageBusLastId(messageBus, "/destroy"),
    );
  }

  function _stopSidebarTopicLifecycleTracking() {
    if (
      sidebarLifecycleMessageBus?.unsubscribe &&
      sidebarLifecycleMessageBusCallback
    ) {
      sidebarLifecycleMessageBus.unsubscribe(
        "/delete",
        sidebarLifecycleMessageBusCallback,
      );
      sidebarLifecycleMessageBus.unsubscribe(
        "/recover",
        sidebarLifecycleMessageBusCallback,
      );
      sidebarLifecycleMessageBus.unsubscribe(
        "/destroy",
        sidebarLifecycleMessageBusCallback,
      );
    }
    sidebarLifecycleMessageBus = null;
    sidebarLifecycleMessageBusCallback = null;
  }

  function _handleSidebarTopicLifecycleMessage(data: TopicMessage) {
    if (resident.lifecycle(data) && host.feedListEl) renderTopics();
  }

  function _handleSidebarIncomingMessage(data: TopicMessage) {
    if (!data || !["latest", "new_topic"].includes(data.message_type || ""))
      return;
    if (!data.topic_id) return;
    if (!_shouldUseSidebarIncomingQueue()) {
      _clearSidebarIncomingCandidates();
      return;
    }
    if (data.payload?.archetype && data.payload.archetype !== "regular") return;

    // 推送 payload 不一定包含完整话题字段，但通常足够判断 id、分类和 archetype。
    // 先记录候选，真正插入列表前再拉完整数据，避免把不完整 payload 直接渲染。
    incoming.touch(data.topic_id, data.payload);
    sidebarIncomingState.filterStable = false;

    if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval === 0) {
      _queueSidebarIncomingApply();
    } else {
      if (_canUseSidebarIncomingRefresh()) {
        _recomputeSidebarIncomingFilteredTopicIds();
        sidebarIncomingState.filterStable = true;
        _syncIncomingHeadAction({ skipIncomingFilterRefresh: true });
      }
    }
  }

  function _clearSidebarIncomingCandidates() {
    // Idempotent cleanup for disabled incoming tracking and stale callbacks.
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

  function _removeSidebarIncomingTopicIds(topicIds: readonly number[]) {
    incoming.remove(topicIds);
    _recomputeSidebarIncomingFilteredTopicIds();
  }

  function _removeSidebarIncomingTopicsForQuery(query = FeedQuery.snapshot()) {
    if (!incoming.ids.length) return;

    const topicIds = incoming.ids.filter((id) => {
      const topic = incoming.get(Number(id));
      return topic && _topicMatchesIncomingCandidate(topic, query);
    });
    _removeSidebarIncomingTopicIds(topicIds);
  }

  function _queueSidebarIncomingApply() {
    if (sidebarIncomingState.viewSettling) return;
    if (!_canUseSidebarIncomingRefresh()) return;
    if (!_isAutoSilentRefreshActive() || prefs.autoSilentRefreshInterval > 0)
      return;
    if (_shouldSkipAutomaticRefresh()) return;
    if (incoming.ids.length === 0) return;
    if (sidebarIncomingState.applyQueued) return;

    // 0 秒静默刷新表示“有 incoming 就尽快应用”。这里排入 microtask，
    // 让同一轮 message-bus 回调中的多个 topic id 先合并，再发起一次批量请求。
    sidebarIncomingState.applyQueued = true;
    const queuedEpoch = viewEpoch;
    Promise.resolve().then(async () => {
      if (disposed || queuedEpoch !== viewEpoch) return;
      sidebarIncomingState.applyQueued = false;
      if (!_isAutoSilentRefreshActive() || prefs.autoSilentRefreshInterval > 0)
        return;
      await _applySidebarIncomingTopics({
        requireDefaultView: true,
        logPrefix: "auto silent refresh",
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

  function _recordAutoLoadFilterResult(count: number) {
    autoLoad.recordResult(_getAutoLoadSessionKey(), count);
  }

  function _shouldExcludeTopReadPinnedTopics(
    query: FeedQuerySnapshot,
    page: number,
  ) {
    return prefs.hidePinned && page === 0 && _isLatestActivityView(query);
  }

  function _excludeTopReadPinnedTopics(
    topics: Topic[],
    query: FeedQuerySnapshot,
    page: number,
  ) {
    if (
      !_shouldExcludeTopReadPinnedTopics(query, page) ||
      !Array.isArray(topics)
    ) {
      return topics;
    }

    let firstNonPinnedIndex = 0;
    while (
      firstNonPinnedIndex < topics.length &&
      _isPinnedTopic(topics[firstNonPinnedIndex])
    ) {
      firstNonPinnedIndex++;
    }

    if (firstNonPinnedIndex === 0) return topics;

    const topPinnedTopics = topics.slice(0, firstNonPinnedIndex);
    const visibleTopPinnedTopics = topPinnedTopics.filter((topic) =>
      _hasUnreadMarker(topic),
    );
    if (visibleTopPinnedTopics.length === topPinnedTopics.length) return topics;

    return visibleTopPinnedTopics.concat(topics.slice(firstNonPinnedIndex));
  }

  function _startTagStyleIndexLoad() {
    if (tags.loaded || tags.loading) return;
    loadTagStyleIndex().then(() => {
      if (
        prefs.feedModeEnabled &&
        host.feedListEl &&
        resident.topics.length > 0
      ) {
        renderTopics();
      }
    });
  }

  async function loadTopics() {
    if (disposed || !prefs.feedModeEnabled || !host.feedListEl) return;
    // Retire the old snapshot immediately, but coalesce changes until its request
    // settles. Abort-ignoring transports must not create overlapping head loads.
    if (loadCycle) {
      loadCycle.pending = true;
      invalidateRequests();
      return;
    }
    const cycle = { pending: false };
    loadCycle = cycle;
    invalidateRequests();
    let requestQuery: FeedQuerySnapshot | null = null;
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
      if (
        requestToken !== activeLoadToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return;
      _refreshCategoryTabs();

      const data = await fetchFeedTopics(requestQuery, 0);
      if (
        requestToken !== activeLoadToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return;
      _processUsers(data);

      if (data?.topic_list?.topics) {
        const rawTopics = data.topic_list.topics;
        const topics = _excludeTopReadPinnedTopics(rawTopics, requestQuery, 0);
        resident.loadHead(
          topics,
          rawTopics.length,
          data.topic_list.more_topics_url,
        );
        renderTopics();
        _removeSidebarIncomingTopicIds(topics.map((topic) => topic.id));
        _syncIncomingHeadAction();
      } else {
        topicList.showMessage(t("emptyTopics"));
        resident.endPages();
      }
    } catch (e) {
      if (
        requestToken !== activeLoadToken ||
        (requestQuery && !FeedQuery.isCurrent(requestQuery))
      )
        return;
      console.error("[SFP] loadTopics error:", e);
      topicList.showError(e, () => {
        void loadTopics();
      });
    } finally {
      if (loadCycle === cycle) {
        loadCycle = null;
        isLoading = false;
        if (cycle.pending) void loadTopics();
        else {
          _flushQueuedSidebarIncomingApply();
          _finishSidebarIncomingViewSettling();
          _restartAutomaticRefreshTimers();
        }
      }
    }
  }

  async function loadMoreTopics({ source = "manual" } = {}) {
    if (
      disposed ||
      !prefs.feedModeEnabled ||
      isLoading ||
      isLoadingMore ||
      !resident.hasMore
    )
      return;
    const isAutoLoad = source === "auto";
    if (isAutoLoad && !_canRunAutoLoad()) return;

    const requestQuery = FeedQuery.snapshot();
    const requestToken = ++activeLoadMoreToken;
    isLoadingMore = true;
    if (isAutoLoad) _recordAutoLoadRequest();

    _showLoadMoreSpinner();

    try {
      await loadCategoryMetadata();
      if (
        requestToken !== activeLoadMoreToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return;
      const data = await fetchFeedTopics(requestQuery, resident.page + 1);
      if (
        requestToken !== activeLoadMoreToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return;
      _processUsers(data);

      if (data?.topic_list?.topics) {
        const topics = data.topic_list.topics;
        const newTopics = resident.append(
          topics,
          data.topic_list.more_topics_url,
        );
        if (newTopics.length === 0) {
          if (resident.hasMore) {
            _renderPaginationFooter({
              note: !isAutoLoad ? t("nextPageNoMatch") : "",
            });
          } else {
            _showNoMore();
          }
        } else {
          // 增量追加，应用当前筛选，保留滚动位置
          const filteredNew = _applyFilter(newTopics);
          topicList.append(filteredNew);

          if (isAutoLoad) _recordAutoLoadFilterResult(filteredNew.length);
          _renderPaginationFooter({
            note:
              !isAutoLoad && filteredNew.length === 0
                ? t("nextPageNoMatch")
                : "",
          });
        }
      } else {
        resident.endPages();
        _showNoMore();
      }
    } catch (e) {
      if (
        requestToken !== activeLoadMoreToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return;
      console.error("[SFP] loadMoreTopics error:", e);
      _showLoadMoreError(e);
    } finally {
      if (requestToken === activeLoadMoreToken) {
        isLoadingMore = false;
        _flushQueuedSidebarIncomingApply();
      }
    }
  }

  function _processUsers(data: TopicResponse) {
    resident.addUsers(data?.users);
  }

  async function refreshCurrentView() {
    return _refreshCurrentView({
      logPrefix: "manual refresh",
    });
  }

  function _mergeAndRenderTopics(
    fetchedTopics: readonly Topic[],
    {
      mode = "prepend",
      moreTopicsUrl = "",
      incomingCandidateIds = [],
      filterTopic = null,
      clearIncomingForQuery = null,
      resetFeedDepth = true,
      sortQuery = null,
    }: RenderMergeOptions = {},
  ) {
    const shouldFilterTopics =
      mode !== "replace-head" && typeof filterTopic === "function";
    const topics = shouldFilterTopics
      ? fetchedTopics.filter((topic) => filterTopic?.(topic))
      : fetchedTopics;

    if (topics.length === 0) {
      if (incomingCandidateIds.length)
        _removeSidebarIncomingTopicIds(incomingCandidateIds);
      _syncIncomingHeadAction();
      return false;
    }

    const highlightTopicIds =
      resident.merge(topics, {
        mode,
        moreTopicsUrl,
        resetFeedDepth,
        sortQuery,
      }) || [];

    const scrollAnchor = topicList.captureAnchor();
    renderTopics(highlightTopicIds);
    if (clearIncomingForQuery) {
      _removeSidebarIncomingTopicsForQuery(clearIncomingForQuery);
    } else if (incomingCandidateIds.length) {
      _removeSidebarIncomingTopicIds(incomingCandidateIds);
    }
    _syncIncomingHeadAction();
    topicList.restoreAnchor(scrollAnchor);
    _syncHeadActionState();
    return true;
  }

  async function _refreshCurrentView({
    requireDefaultView = false,
    logPrefix = "refresh",
  } = {}) {
    if (
      disposed ||
      !prefs.feedModeEnabled ||
      isLoading ||
      isLoadingMore ||
      isRefreshing
    )
      return false;
    if (requireDefaultView && !_canUseSidebarIncomingRefresh()) return false;
    if (!host.feedListEl) return false;

    const requestQuery = FeedQuery.snapshot();
    const requestToken = ++activeRefreshToken;
    const endRefreshBusy = _beginRefreshButtonBusy();
    isRefreshing = true;
    try {
      await loadCategoryMetadata();
      if (
        requestToken !== activeRefreshToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return false;
      const data = await fetchFeedTopics(requestQuery, 0);
      if (
        requestToken !== activeRefreshToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return false;
      _processUsers(data);

      if (!data?.topic_list?.topics) return false;
      // 先用未经本地处理的原始 page-0 与旧数据比对，标记凭空消失的话题，
      // 再走合并渲染；被标记的旧条目会在合并的 retained 尾部保留下来。
      resident.detectVanished(data.topic_list.topics, requestQuery);
      const topics = _excludeTopReadPinnedTopics(
        data.topic_list.topics,
        requestQuery,
        0,
      );

      return _mergeAndRenderTopics(topics, {
        mode: "replace-head",
        moreTopicsUrl: data.topic_list.more_topics_url,
        clearIncomingForQuery: requestQuery,
        resetFeedDepth: true,
        sortQuery: requestQuery,
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

  // 仅在 latest/latest category 语义可匹配的最新活动视图中按 incoming 事件启用。
  // 这条路径不重新拉整页，而是按 message-bus 收集到的 topic id 批量取详情，
  // 然后插入到当前列表顶部；这样能减少刷新时对阅读位置的扰动。
  async function _applySidebarIncomingTopics({
    requireDefaultView = false,
    logPrefix = "incoming",
    queueIfBusy = true,
    resetFeedDepth = true,
  } = {}) {
    if (
      sidebarIncomingState.viewSettling ||
      isLoading ||
      isLoadingMore ||
      isRefreshing
    ) {
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
      if (incomingTopicIds.length === 0) {
        return;
      }
      if (isLoading || isLoadingMore || isRefreshing) {
        if (queueIfBusy) sidebarIncomingState.applyQueued = true;
        return;
      }

      const requestQuery = FeedQuery.snapshot();
      requestToken = ++activeRefreshToken;
      isRefreshing = true;
      await loadCategoryMetadata();
      if (
        requestToken !== activeRefreshToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return;
      const data = await fetchFeedTopicsByIds(incomingTopicIds);
      if (
        requestToken !== activeRefreshToken ||
        !FeedQuery.isCurrent(requestQuery)
      )
        return;
      if (!data?.topic_list?.topics) return;
      _processUsers(data);

      _mergeAndRenderTopics(data.topic_list.topics, {
        mode: "prepend",
        incomingCandidateIds,
        filterTopic: (topic) => _topicMatchesIncomingView(topic, requestQuery),
        resetFeedDepth,
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

    // 大于 0 的静默刷新按倒计时批量应用 incoming。0 秒场景由
    // _queueSidebarIncomingApply 处理，避免同时存在 interval 和 microtask 两条触发链。
    _resetAutoSilentRefreshCountdown();
    silentRefresh.start(prefs.autoSilentRefreshInterval, () => {
      if (
        prefs.feedModeEnabled &&
        !isLoading &&
        !isLoadingMore &&
        !isRefreshing &&
        !_shouldSkipAutomaticRefresh()
      ) {
        if (_canUseSidebarIncomingRefresh()) {
          _applySidebarIncomingTopics({
            requireDefaultView: true,
            logPrefix: "auto silent refresh interval",
            queueIfBusy: false,
          });
        } else {
          _refreshCurrentView({
            logPrefix: "auto silent refresh interval",
          });
        }
      }
    });
  }

  function _resetAutoSilentRefreshCountdown() {
    if (_isAutoSilentRefreshActive() && prefs.autoSilentRefreshInterval > 0) {
      silentRefresh.reset(prefs.autoSilentRefreshInterval);
    }
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

    // 非最新活动排序没有可靠 incoming 增量，只能按当前查询重新拉取列表头部。
    // refreshCurrentView 会保存滚动锚点，尽量避免自动刷新把正在看的内容挤走。
    _resetAutoRefreshCountdown();
    automaticRefresh.start(prefs.autoRefreshInterval, () => {
      if (
        prefs.feedModeEnabled &&
        !isLoading &&
        !isLoadingMore &&
        !_shouldSkipAutomaticRefresh()
      ) {
        _refreshCurrentView({ logPrefix: "auto refresh" });
      }
    });
  }

  function _resetAutoRefreshCountdown() {
    if (prefs.autoRefreshEnabled) {
      automaticRefresh.reset(prefs.autoRefreshInterval);
    }
  }

  function _stopAutoRefresh() {
    automaticRefresh.stop();
  }

  function renderTopics(newTopicIds: readonly number[] = []) {
    const filtered = _applyFilter(resident.topics);
    let emptyMessage = t("emptyTopics");
    if (resident.topics.length) {
      emptyMessage =
        prefs.currentFilter === "unseen"
          ? t(prefs.currentTab !== "all" ? "noUnreadInCategory" : "noUnread")
          : t(prefs.currentFilter === "read" ? "noRead" : "noMatchingTopics");
      if (resident.hasMore && !isLoadingMore)
        emptyMessage = t("currentPagePrefix") + emptyMessage;
    }
    topicList.render(filtered, emptyMessage, newTopicIds);
    _syncHeadActionState();
  }

  // 以脚本实际跳转链接为准：不带楼层号是未读，带楼层号说明有阅读进度。
  // `unseen: false` 只表示这个话题不再是“新出现”，不能证明用户打开读过。

  function markTopicAsRead(topic: Topic, itemElement: HTMLElement) {
    if (resident.markRead(topic)) topicRenderer.markRead(itemElement);
  }

  // 未读/已读筛选复用 _isTopicRead，避免和渲染、点击后本地 patch 的语义分叉。
  function _applyFilter(topics: readonly Topic[]) {
    if (prefs.currentFilter === "all") return topics;

    let result = topics;
    if (prefs.currentFilter === "unseen") {
      result = result.filter((t) => _hasUnreadMarker(t));
    }
    if (prefs.currentFilter === "read") {
      result = result.filter((t) => !_hasUnreadMarker(t));
    }
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

      if (prefs.feedModeEnabled) {
        appScope.timeout(() => activateFeed(), 300);
      } else {
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
    normalizeSiteState: _normalizeCurrentSiteState,
  };
}
