import {
  DEFAULT_AUTO_REFRESH_INTERVAL,
  DEFAULT_AUTO_SILENT_REFRESH_INTERVAL,
  SETTINGS_BUTTON_SIZE,
} from "../constants";
import { _needsPeriodForUrl } from "../feed/query";
import type { createI18n } from "../i18n";
import type { Lifetime } from "../platform/lifetime";
import type { Preferences } from "../preferences";
import type { createSiteData } from "../site/site-data";
import {
  FILTER_OPTION_DEFS,
  ORDER_OPTION_DEFS,
  PERIOD_OPTION_DEFS,
} from "../site/site-data";
import type { CategoryTab } from "../site/types";
import { closestTarget } from "./dom";
import type { createFeedHost } from "./host";
import { escapeAttr, escapeHtml } from "./html";
import { _categoryColorMarkerHtml, _svgIcon } from "./icons";
type PreferenceValues = Omit<Preferences, "saveTabOrder">;
interface SelectOption {
  label: string;
  value: string;
}
interface ControlsDependencies {
  t: ReturnType<typeof createI18n>["t"];
  prefs: Readonly<PreferenceValues>;
  site: ReturnType<typeof createSiteData>;
  host: ReturnType<typeof createFeedHost>;
  getScope: () => Lifetime;
  updatePreference: <K extends keyof PreferenceValues>(
    key: K,
    value: PreferenceValues[K],
  ) => void;
  saveTabOrder: (ids: number[]) => void;
  getCategoryId: () => number | null;
  setCategoryId: (id: number | null) => void;
  _resetAutoLoadState: () => void;
  loadTopics: () => void;
  _beginSidebarIncomingViewSettling: () => void;
  _syncDefaultViewControls: () => void;
  _syncRefreshButtonBusy: () => void;
  _handleHeadActionClick: (event: MouseEvent) => void;
  _syncSidebarIncomingTracking: () => void;
  _syncHeadActionState: () => void;
  _isAutoSilentRefreshActive: () => boolean;
  _queueSidebarIncomingApply: () => void;
  _startAutoSilentRefresh: () => void;
  _startAutoRefresh: () => void;
  _isLatestActivityView: () => boolean;
  renderTopics: () => void;
  _finishSidebarIncomingViewSettling: () => void;
}
export function createControls({
  t,
  prefs,
  site,
  host,
  getScope,
  updatePreference,
  saveTabOrder,
  getCategoryId,
  setCategoryId,
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
  renderTopics,
  _finishSidebarIncomingViewSettling,
}: ControlsDependencies) {
  const { getCategoryTabMeta, _getOrderedTabCategories } = site;
  let feedRefreshBtn: HTMLButtonElement | null = null;
  let globalHelpTooltip: HTMLDivElement | null = null;
  let pendingTabBarScrollTab: string | null = null;
  const requestAnimationFrame = (fn: FrameRequestCallback) =>
    getScope().frame(fn);
  const setTimeout = (fn: () => void, ms: number) => getScope().timeout(fn, ms);
  function clampNumber(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.round(numeric)));
  }

  function _getOrderOptions() {
    return ORDER_OPTION_DEFS.filter((option) =>
      site.capabilities.orderValues.has(option.value),
    ).map((option) => ({ label: t(option.labelKey), value: option.value }));
  }

  function _getPeriodOptions() {
    return PERIOD_OPTION_DEFS.filter((option) =>
      site.capabilities.periodValues.has(option.value),
    ).map((option) => ({ label: t(option.labelKey), value: option.value }));
  }

  function _getFilterOptions() {
    return FILTER_OPTION_DEFS.filter((option) =>
      site.capabilities.filterValues.has(option.value),
    ).map((option) => ({ label: t(option.labelKey), value: option.value }));
  }

  function _saveTabOrderFromGrid(grid: HTMLElement) {
    const order = Array.from(
      grid.querySelectorAll<HTMLElement>(
        ".sfp-tab-grid-item[data-category-id]",
      ),
    )
      .map((item) => Number(item.dataset.categoryId))
      .filter((id) => Number.isFinite(id));
    saveTabOrder(order);
  }

  function _buildCategoryTabContent(cat: CategoryTab) {
    const tabMeta = getCategoryTabMeta(cat);
    const iconHtml = tabMeta.icon
      ? _svgIcon(tabMeta.icon)
      : _categoryColorMarkerHtml(tabMeta.color);
    return `${iconHtml}<span>${escapeHtml(tabMeta.name)}</span>`;
  }

  function _cssEscape(value: string) {
    return typeof window.CSS?.escape === "function"
      ? CSS.escape(String(value))
      : String(value).replace(/["\\]/g, "\\$&");
  }

  function _closeFloatingPanels(exceptEl: HTMLElement | null = null) {
    document
      .querySelectorAll<HTMLElement>(
        ".sfp-custom-select.open, .sfp-settings-wrap.open, .sfp-tab-shell.open",
      )
      .forEach((el) => {
        if (el !== exceptEl) el.classList.remove("open");
      });
  }

  function _scrollTabIntoView(
    shell: HTMLElement | null,
    tabId = prefs.currentTab,
    behavior: ScrollBehavior = "auto",
  ) {
    const bar = shell?.querySelector<HTMLElement>(".sfp-tab-bar");
    const activeTab = shell?.querySelector<HTMLElement>(
      `.sfp-tab-bar .sfp-tab-item[data-tab="${_cssEscape(tabId)}"]`,
    );
    if (!bar || !activeTab) return;

    const maxScrollLeft = Math.max(0, bar.scrollWidth - bar.clientWidth);
    const targetLeft =
      activeTab.offsetLeft - (bar.clientWidth - activeTab.offsetWidth) / 2;
    const left = Math.min(maxScrollLeft, Math.max(0, targetLeft));

    bar.scrollTo({ left, behavior });
  }

  function _buildHeaderControls(header: HTMLElement) {
    const orderOptions = _getOrderOptions();
    const periodOptions = _getPeriodOptions();

    // Period 下拉（先创建，因为 order 切换时需要引用）
    const periodSelect = _buildCustomSelect(
      periodOptions,
      prefs.currentPeriod,
      (value) => {
        updatePreference("currentPeriod", value);
        _resetAutoLoadState();
        loadTopics();
      },
    );
    periodSelect.classList.add("sfp-period-select");
    _updatePeriodVisibility(periodSelect);

    // Order 下拉
    const orderSelect = _buildCustomSelect(
      orderOptions,
      prefs.currentOrder,
      (value) => {
        updatePreference("currentOrder", value);
        _updatePeriodVisibility(periodSelect);
        _beginSidebarIncomingViewSettling();
        _syncDefaultViewControls();
        _resetAutoLoadState();
        loadTopics();
      },
    );
    orderSelect.classList.add("sfp-order-select");

    function _updatePeriodVisibility(ps: HTMLElement) {
      ps.style.display =
        _needsPeriodForUrl(prefs.currentOrder) && periodOptions.length > 1
          ? ""
          : "none";
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

    // 设置项按当前排序视图分组，而不是一次性展示全部选项：
    // - 最新活动可以消费 message-bus 增量，因此提供“新活动提醒”和“静默刷新”；
    // - 浏览量/回复/点赞等排序没有同等可靠的增量通道，只提供普通自动刷新。
    // 这样可以减少用户误以为所有排序都能无请求地接收新话题。
    if (isLatestActivityView) {
      panel.innerHTML = `
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
    } else {
      panel.innerHTML = `
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
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shouldOpen = !wrapper.classList.contains("open");
      _closeFloatingPanels(wrapper);
      wrapper.classList.toggle("open", shouldOpen);
      _syncSettingsPanelState(wrapper);
    });

    panel.addEventListener("click", (e) => e.stopPropagation());
    panel
      .querySelectorAll<HTMLElement>(".sfp-setting-help")
      .forEach((helpBtn) => {
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
          if (left + tooltipWidth > window.innerWidth - 8) {
            left = Math.max(8, btnRect.right - tooltipWidth);
          }
          if (top + tooltipHeight > window.innerHeight - 8) {
            top = btnRect.top - tooltipHeight - gap;
          }
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

    const incomingHintInput = panel.querySelector<HTMLInputElement>(
      ".sfp-incoming-hint-input",
    );
    if (incomingHintInput) {
      _bindCheckboxSetting(incomingHintInput, (checked) => {
        updatePreference("showIncomingHint", checked);
        _syncSettingsPanelState(wrapper);
        _syncSidebarIncomingTracking();
        _syncHeadActionState();
        if (
          _isAutoSilentRefreshActive() &&
          prefs.autoSilentRefreshInterval === 0
        ) {
          _queueSidebarIncomingApply();
        }
      });
    }

    const hidePinnedInput = panel.querySelector<HTMLInputElement>(
      ".sfp-hide-pinned-input",
    );
    if (hidePinnedInput) {
      _bindCheckboxSetting(hidePinnedInput, (checked) => {
        updatePreference("hidePinned", checked);
        _syncSettingsPanelState(wrapper);
        _resetAutoLoadState();
        loadTopics();
      });
    }

    const autoSilentInput = panel.querySelector<HTMLInputElement>(
      ".sfp-auto-silent-input",
    );
    const silentIntervalInput = panel.querySelector<HTMLInputElement>(
      ".sfp-auto-silent-refresh-interval-input",
    );
    if (autoSilentInput) {
      _bindCheckboxSetting(autoSilentInput, (checked) => {
        updatePreference("autoSilentRefreshEnabled", checked);
        _syncSettingsPanelState(wrapper);
        _syncSidebarIncomingTracking();
        _startAutoSilentRefresh();
        _syncHeadActionState();
        if (
          _isAutoSilentRefreshActive() &&
          prefs.autoSilentRefreshInterval === 0
        ) {
          _queueSidebarIncomingApply();
        }
      });
    }

    _bindNumberSetting(
      silentIntervalInput,
      0,
      DEFAULT_AUTO_SILENT_REFRESH_INTERVAL,
      (seconds) => {
        updatePreference("autoSilentRefreshInterval", seconds);
        _startAutoSilentRefresh();
        _syncHeadActionState();
        if (
          _isAutoSilentRefreshActive() &&
          prefs.autoSilentRefreshInterval === 0
        ) {
          _queueSidebarIncomingApply();
        }
      },
    );

    const autoRefreshInput = panel.querySelector<HTMLInputElement>(
      ".sfp-auto-refresh-input",
    );
    const intervalRow = panel.querySelector<HTMLElement>(
      ".sfp-auto-refresh-interval",
    );
    const intervalInput = panel.querySelector<HTMLInputElement>(
      ".sfp-auto-refresh-interval-input",
    );
    if (autoRefreshInput) {
      _bindCheckboxSetting(autoRefreshInput, (checked) => {
        updatePreference("autoRefreshEnabled", checked);
        intervalRow?.classList.toggle("visible", prefs.autoRefreshEnabled);
        _syncSettingsPanelHeight(wrapper);
        _startAutoRefresh();
        _syncHeadActionState();
      });
    }

    _bindNumberSetting(
      intervalInput,
      1,
      DEFAULT_AUTO_REFRESH_INTERVAL,
      (seconds) => {
        updatePreference("autoRefreshInterval", seconds);
        _startAutoRefresh();
        _syncHeadActionState();
      },
    );

    shell.appendChild(btn);
    shell.appendChild(panel);
    wrapper.appendChild(shell);
    _syncSettingsPanelState(wrapper);
    return wrapper;
  }

  function _buildSettingLabelHtml(label: string, tooltip: string) {
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

  function _syncSettingsPanelState(wrapper: HTMLElement) {
    const panel = wrapper?.querySelector<HTMLElement>(".sfp-settings-panel");
    if (!panel) return;

    const incomingHintInput = panel.querySelector<HTMLInputElement>(
      ".sfp-incoming-hint-input",
    );
    const hidePinnedInput = panel.querySelector<HTMLInputElement>(
      ".sfp-hide-pinned-input",
    );
    const autoSilentInput = panel.querySelector<HTMLInputElement>(
      ".sfp-auto-silent-input",
    );
    const autoSilentRow = panel.querySelector<HTMLElement>(
      ".sfp-auto-silent-row",
    );
    const autoSilentIntervalRow = panel.querySelector<HTMLElement>(
      ".sfp-auto-silent-interval",
    );
    const autoRefreshInput = panel.querySelector<HTMLInputElement>(
      ".sfp-auto-refresh-input",
    );
    const autoRefreshIntervalRow = panel.querySelector<HTMLElement>(
      ".sfp-auto-refresh-interval",
    );

    if (incomingHintInput) incomingHintInput.checked = prefs.showIncomingHint;
    if (hidePinnedInput) hidePinnedInput.checked = prefs.hidePinned;
    if (autoSilentInput)
      autoSilentInput.checked = prefs.autoSilentRefreshEnabled;
    if (autoRefreshInput) autoRefreshInput.checked = prefs.autoRefreshEnabled;

    if (autoSilentRow) {
      autoSilentRow.classList.remove("hidden");
    }
    if (autoSilentIntervalRow) {
      autoSilentIntervalRow.classList.remove("hidden");
      autoSilentIntervalRow.classList.toggle(
        "visible",
        prefs.autoSilentRefreshEnabled,
      );
    }
    if (autoRefreshIntervalRow) {
      autoRefreshIntervalRow.classList.toggle(
        "visible",
        prefs.autoRefreshEnabled,
      );
    }

    _syncSettingsPanelHeight(wrapper);
  }

  function _syncSettingsPanelHeight(wrapper: HTMLElement) {
    const shell = wrapper?.querySelector<HTMLElement>(".sfp-settings-shell");
    const panel = wrapper?.querySelector<HTMLElement>(".sfp-settings-panel");
    if (!shell || !panel) return;

    // 设置面板是绝对定位浮层，但外层 shell 需要参与 header 布局。
    // 每次显示/隐藏行后重新测量实际可见内容高度，避免动画期间按钮区域被截断。
    requestAnimationFrame(() => {
      const visibleRows = Array.from(panel.children).filter(
        (child): child is HTMLElement => {
          return (
            child instanceof HTMLElement &&
            getComputedStyle(child).display !== "none"
          );
        },
      );
      const contentBottom = visibleRows.reduce((bottom, row) => {
        return Math.max(bottom, row.offsetTop + row.offsetHeight);
      }, SETTINGS_BUTTON_SIZE);
      const panelStyle = getComputedStyle(panel);
      const paddingBottom = Number.parseFloat(panelStyle.paddingBottom) || 0;
      const height = Math.max(
        SETTINGS_BUTTON_SIZE,
        Math.ceil(contentBottom + paddingBottom),
      );
      shell.style.setProperty("--sfp-settings-shell-height", `${height}px`);
    });
  }

  function _bindCheckboxSetting(
    input: HTMLInputElement | null,
    onChange: (checked: boolean) => void,
  ) {
    if (!input) return;
    input.addEventListener("change", () => onChange(input.checked));
  }

  function _bindNumberSetting(
    input: HTMLInputElement | null,
    min: number,
    fallback: number,
    onChange: (value: number) => void,
    max = Infinity,
  ) {
    if (!input) return;
    input.addEventListener("change", () => {
      const nextValue = clampNumber(input.value, min, max, fallback);
      input.value = String(nextValue);
      onChange(nextValue);
    });
  }

  function _buildCustomSelect(
    options: SelectOption[],
    selectedValue: string,
    onChange: (value: string) => void,
  ) {
    const safeOptions = options.length
      ? options
      : [{ label: "", value: selectedValue || "" }];
    const wrapper = document.createElement("span");
    wrapper.className = "sfp-custom-select";

    const btn = document.createElement("button");
    btn.className = "sfp-custom-select-btn";
    btn.type = "button";
    const selected =
      safeOptions.find((o) => o.value === selectedValue) || safeOptions[0];
    btn.textContent = selected.label;

    const dropdown = document.createElement("div");
    dropdown.className = "sfp-custom-select-dropdown";

    let _currentSelected = selectedValue;

    safeOptions.forEach((opt) => {
      const item = document.createElement("button");
      item.className =
        "sfp-custom-select-option" +
        (opt.value === selectedValue ? " selected" : "");
      item.type = "button";
      item.textContent = opt.label;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (opt.value === _currentSelected) {
          wrapper.classList.remove("open");
          return;
        }
        btn.textContent = opt.label;
        dropdown
          .querySelectorAll<HTMLElement>(".sfp-custom-select-option")
          .forEach((el) => el.classList.remove("selected"));
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
    const grid = panel.querySelector<HTMLElement>(".sfp-tab-grid")!;

    // "全部" 标签
    const allTab = document.createElement("span");
    allTab.className =
      "sfp-tab-item" + (prefs.currentTab === "all" ? " active" : "");
    allTab.dataset.tab = "all";
    allTab.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg><span>${escapeHtml(t("all"))}</span>`;
    bar.appendChild(allTab);

    const allGridItem = document.createElement("span");
    allGridItem.className =
      "sfp-tab-grid-item" + (prefs.currentTab === "all" ? " active" : "");
    allGridItem.dataset.tab = "all";
    allGridItem.innerHTML = allTab.innerHTML;
    grid.appendChild(allGridItem);

    // 各板块标签
    _getOrderedTabCategories().forEach((cat) => {
      const tab = document.createElement("span");
      tab.className =
        "sfp-tab-item" + (prefs.currentTab === cat.tabId ? " active" : "");
      tab.dataset.tab = cat.tabId;
      tab.dataset.categoryId = String(cat.id);
      tab.innerHTML = _buildCategoryTabContent(cat);
      bar.appendChild(tab);

      const gridItem = document.createElement("span");
      gridItem.className =
        "sfp-tab-grid-item" + (prefs.currentTab === cat.tabId ? " active" : "");
      gridItem.draggable = true;
      gridItem.dataset.tab = cat.tabId;
      gridItem.dataset.categoryId = String(cat.id);
      gridItem.title = getCategoryTabMeta(cat).name;
      gridItem.innerHTML = _buildCategoryTabContent(cat);
      grid.appendChild(gridItem);
    });

    // 事件代理 — 点击切换
    shell.addEventListener("click", (e) => {
      e.stopPropagation();
      _closeFloatingPanels(shell);
      const closeBtn = closestTarget(e, ".sfp-tab-panel-close");
      if (closeBtn) {
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
      const catId = tab.dataset.categoryId
        ? Number(tab.dataset.categoryId)
        : null;
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

      shell
        .querySelectorAll<HTMLElement>(".sfp-tab-item, .sfp-tab-grid-item")
        .forEach((t) => {
          t.classList.remove("active");
        });
      shell
        .querySelectorAll<HTMLElement>(`[data-tab="${_cssEscape(tabId)}"]`)
        .forEach((t) => t.classList.add("active"));
      if (fromGrid) {
        pendingTabBarScrollTab = tabId;
        shell.classList.remove("open");
        _scrollTabIntoView(shell, tabId, "smooth");
      }

      loadTopics();
    });

    moreBtn.addEventListener("mousedown", (e) => e.preventDefault());

    let dragItem: HTMLElement | null = null;
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
      grid
        .querySelectorAll<HTMLElement>(".drop-target")
        .forEach((el) => el.classList.remove("drop-target"));
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
      grid
        .querySelectorAll<HTMLElement>(".drop-target")
        .forEach((el) => el.classList.remove("drop-target"));
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

  function _rerenderTabBar(
    oldShell: HTMLElement,
    options: {
      keepOpen?: boolean;
      scrollTabId?: string | null;
      scrollBehavior?: ScrollBehavior;
    } = {},
  ) {
    if (!oldShell?.parentNode) return null;
    const oldBar = oldShell.querySelector<HTMLElement>(".sfp-tab-bar");
    const scrollLeft = oldBar?.scrollLeft || 0;
    const keepOpen = options.keepOpen ?? oldShell.classList.contains("open");
    const newShell = _buildTabBar();
    if (keepOpen) newShell.classList.add("open");
    oldShell.replaceWith(newShell);
    const newBar = newShell.querySelector<HTMLElement>(".sfp-tab-bar");
    if (options.scrollTabId) {
      requestAnimationFrame(() => {
        _scrollTabIntoView(
          newShell,
          options.scrollTabId || undefined,
          options.scrollBehavior || "auto",
        );
      });
    } else if (newBar) {
      newBar.scrollLeft = scrollLeft;
    }
    return newShell;
  }

  function _buildFilterBar() {
    const bar = document.createElement("div");
    bar.className = "sfp-filter-bar";

    const filters = _getFilterOptions();

    filters.forEach((f) => {
      const item = document.createElement("span");
      item.className =
        "sfp-filter-item" + (prefs.currentFilter === f.value ? " active" : "");
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
      bar
        .querySelectorAll<HTMLElement>(".sfp-filter-item[data-filter]")
        .forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      renderTopics();
      _finishSidebarIncomingViewSettling();
    });

    return bar;
  }

  function _refreshCategoryTabs() {
    const shell =
      host.feedContainer?.querySelector<HTMLElement>(".sfp-tab-shell");
    if (!shell) return;

    const scrollTabId = pendingTabBarScrollTab;
    pendingTabBarScrollTab = null;
    _rerenderTabBar(shell, {
      scrollTabId,
      scrollBehavior: scrollTabId ? "smooth" : "auto",
    });
  }

  function _updateSettingsControl() {
    if (!host.feedHeaderEl) return;

    const oldSettings =
      host.feedHeaderEl.querySelector<HTMLElement>(".sfp-settings-wrap");
    if (!oldSettings) return;

    const hasLatestActivityPanel = !!oldSettings.querySelector<HTMLElement>(
      ".sfp-incoming-hint-row",
    );
    if (hasLatestActivityPanel === _isLatestActivityView()) {
      _syncSettingsPanelState(oldSettings);
      return;
    }

    const isOpen = oldSettings.classList.contains("open");
    const nextSettings = _buildSettingsControl();
    if (isOpen) nextSettings.classList.add("open");
    oldSettings.replaceWith(nextSettings);
  }

  function _formatIncomingCount(count: number) {
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
  function renderHeadAction(
    isAway: boolean,
    isBusy: boolean,
    incomingCount: number,
  ) {
    if (!feedRefreshBtn) return;
    const showsCount = incomingCount > 0;
    const nextAction = showsCount
      ? "incoming"
      : isAway && !isBusy
        ? "back-top"
        : "refresh";
    const currentAction = feedRefreshBtn.dataset.action || "";
    const nextIncomingCount = showsCount ? String(incomingCount) : "";
    const shouldUpdateActionHtml =
      currentAction !== nextAction ||
      (showsCount &&
        feedRefreshBtn.dataset.incomingCount !== nextIncomingCount);
    const nextTitle = showsCount
      ? t("applyIncoming", { count: incomingCount })
      : nextAction === "back-top"
        ? t("backToTop")
        : t("refresh");
    const nextHtml = showsCount
      ? `<span class="sfp-refresh-count">${escapeHtml(_formatIncomingCount(incomingCount))}</span>`
      : nextAction === "back-top"
        ? _backTopIconHtml()
        : _refreshIconHtml();

    feedRefreshBtn.classList.toggle("sfp-away-from-head", isAway);
    feedRefreshBtn.classList.toggle("sfp-has-incoming-count", showsCount);
    if (currentAction !== nextAction) {
      feedRefreshBtn.dataset.action = nextAction;
    }
    if (nextIncomingCount) {
      feedRefreshBtn.dataset.incomingCount = nextIncomingCount;
    } else {
      delete feedRefreshBtn.dataset.incomingCount;
    }
    if (feedRefreshBtn.title !== nextTitle) {
      feedRefreshBtn.title = nextTitle;
      feedRefreshBtn.setAttribute("aria-label", nextTitle);
    }
    if (shouldUpdateActionHtml) {
      feedRefreshBtn.innerHTML = nextHtml;
      // 箭头实际显示时才播放入场动画；旋转期间被抑制的切换会在刷新结束后补播。
      if (nextAction === "back-top") {
        _playBackTopEnterAnimation();
      }
    }
    if (nextAction !== "back-top") {
      feedRefreshBtn.classList.remove("sfp-back-top-enter");
    }
  }
  function setBusy(isBusy: boolean) {
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
    _updateSettingsControl,
  };
}
