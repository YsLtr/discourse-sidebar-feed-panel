import { DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH } from "../constants";
import type { createI18n } from "../i18n";
import type { Lifetime } from "../platform/lifetime";

/**
 * Native Sidebar Host candidates, most specific first. A candidate may be
 * dropped only when another one already covers every element it can match, and
 * added only after being observed on a real forum.
 */
export const SIDEBAR_HOST_SELECTORS = [
  "#d-sidebar",
  ".sidebar-container",
] as const;

/**
 * Header candidates for the toggle button, most specific first. `#d-header`
 * must not be added: no supported forum has that id any more.
 */
export const TOGGLE_ANCHOR_SELECTORS = [
  ".home-logo-wrapper-outlet .title",
  ".home-logo-wrapper-outlet",
  ".d-header .contents",
  ".d-header .panel",
] as const;

/** First candidate that resolves wins. Taking a lookup keeps this DOM-free. */
export function firstMatch<T>(
  candidates: readonly string[],
  lookup: (selector: string) => T | null | undefined,
): T | null {
  for (const selector of candidates) {
    const found = lookup(selector);
    if (found) return found;
  }
  return null;
}

export const WIDTH_VARIABLE = "--d-sidebar-width";

/** The inline-style surface the width variable is written through. */
export interface InlineTarget {
  isConnected: boolean;
  style: {
    getPropertyValue(name: string): string;
    getPropertyPriority(name: string): string;
    setProperty(name: string, value: string, priority?: string): void;
    removeProperty(name: string): void;
  };
}

export interface SavedInlineValue<T extends InlineTarget> {
  el: T;
  value: string;
  priority: string;
}

/**
 * Record what each target held before the panel's first write, so restore can
 * put a value back instead of deleting one the panel never wrote. Targets that
 * left the document are dropped: their inline style no longer affects layout.
 */
export function captureInlineValues<T extends InlineTarget>(
  saved: readonly SavedInlineValue<T>[],
  targets: readonly T[],
  property: string,
): SavedInlineValue<T>[] {
  const kept = saved.filter(
    (entry) => entry.el.isConnected && targets.includes(entry.el),
  );
  for (const el of targets) {
    if (!el.isConnected) continue;
    if (kept.some((entry) => entry.el === el)) continue;
    kept.push({
      el,
      value: el.style.getPropertyValue(property),
      priority: el.style.getPropertyPriority(property),
    });
  }
  return kept;
}

export function restoreInlineValues<T extends InlineTarget>(
  saved: readonly SavedInlineValue<T>[],
  property: string,
): void {
  for (const entry of saved) {
    entry.el.style.removeProperty(property);
    if (entry.value) {
      entry.el.style.setProperty(property, entry.value, entry.priority);
    }
  }
}

interface HostDependencies {
  t: ReturnType<typeof createI18n>["t"];
  getEnabled(): boolean;
  getWidth(): number;
  onToggle(): void;
  onWidth(width: number): void;
  getScope(): Lifetime;
}
export function createFeedHost({
  t,
  getEnabled,
  getWidth,
  onToggle,
  onWidth,
  getScope,
}: HostDependencies) {
  let toggleBtn: HTMLButtonElement | null = null;
  let resizerEl: HTMLElement | null = null;
  let resizerGripEl: HTMLElement | null = null;
  let gripSyncQueued = false;
  let isResizing = false;
  let originalSidebarWidthBeforeFeed: number | null = null;
  let widthAnimationTimer: number | null = null;
  let feedContainer: HTMLElement | null = null;
  let feedHeaderEl: HTMLElement | null = null;
  let feedScrollEl: HTMLElement | null = null;
  let feedListEl: HTMLElement | null = null;
  const requestAnimationFrame = (fn: FrameRequestCallback) =>
    getScope().frame(fn);
  const setTimeout = (fn: () => void, ms: number) => getScope().timeout(fn, ms);
  function createToggle() {
    if (toggleBtn?.isConnected) return toggleBtn;

    const anchor = firstMatch(TOGGLE_ANCHOR_SELECTORS, (selector) =>
      document.querySelector<HTMLElement>(selector),
    );
    if (!anchor) return null;
    toggleBtn?.remove();
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

    // 放入页头锚点内部，logo 右边
    anchor.appendChild(toggleBtn);
    return toggleBtn;
  }

  function getMinSidebarWidth() {
    return MIN_WIDTH;
  }

  function getSidebarElement() {
    return firstMatch(SIDEBAR_HOST_SELECTORS, (selector) =>
      document.querySelector<HTMLElement>(selector),
    );
  }

  /** The grid element whose first track consumes `--d-sidebar-width`. */
  function getOutletElement() {
    return document.querySelector<HTMLElement>("#main-outlet-wrapper");
  }

  let savedWidthValues: SavedInlineValue<InlineTarget>[] = [];
  let savedSidebarWidths: SavedInlineValue<InlineTarget>[] = [];
  /** Bumped by every animation; frames from an earlier one bail out. */
  let widthAnimationEpoch = 0;

  function widthVariableTargets(): InlineTarget[] {
    const targets: InlineTarget[] = [document.documentElement, document.body];
    const outlet = getOutletElement();
    if (outlet) targets.push(outlet);
    return targets;
  }
  /**
   * The grid track reads the variable from its own element, while the
   * upcoming-change rule declares it on `body` and therefore shadows a
   * root-level value. Writing all three keeps the track following the panel on
   * either layout; the sidebar's own width above stays the cap. Each target
   * keeps whatever it held before the first write, so restore puts that back
   * instead of deleting a value the panel never wrote.
   */
  function setSidebarWidthVariable(width: number) {
    savedWidthValues = captureInlineValues(
      savedWidthValues,
      widthVariableTargets(),
      WIDTH_VARIABLE,
    );
    const value = width + "px";
    for (const target of widthVariableTargets()) {
      target.style.setProperty(WIDTH_VARIABLE, value);
    }
  }

  function clearSidebarWidthVariable() {
    restoreInlineValues(savedWidthValues, WIDTH_VARIABLE);
    savedWidthValues = [];
  }

  /** Remember the host's own inline width before the panel's first write. */
  function setSidebarWidth(sidebar: HTMLElement, width: number) {
    savedSidebarWidths = captureInlineValues(
      savedSidebarWidths,
      [sidebar],
      "width",
    );
    sidebar.style.setProperty("width", width + "px", "important");
  }

  function clearSidebarWidths() {
    restoreInlineValues(savedSidebarWidths, "width");
    savedSidebarWidths = [];
  }

  function applySidebarWidth(width: number) {
    const clampedWidth = Math.min(
      MAX_WIDTH,
      Math.max(getMinSidebarWidth(), width),
    );
    const sidebar = getSidebarElement();
    if (sidebar) {
      setSidebarWidth(sidebar, clampedWidth);
    }
    setSidebarWidthVariable(clampedWidth);
  }

  function getSidebarWidthTransitionElements(sidebar: HTMLElement | null) {
    const wrapper = sidebar?.classList?.contains("sidebar-wrapper")
      ? sidebar
      : sidebar?.closest<HTMLElement>(".sidebar-wrapper");
    return [sidebar, wrapper].filter((el): el is HTMLElement => !!el);
  }

  function setSidebarWidthForAnimation(
    sidebar: HTMLElement,
    width: number,
    { enforceMin = true } = {},
  ) {
    const minWidth = enforceMin ? getMinSidebarWidth() : 0;
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(minWidth, width));
    setSidebarWidth(sidebar, clampedWidth);
    setSidebarWidthVariable(clampedWidth);
  }

  function animateSidebarWidth(
    targetWidth: number,
    { cleanupAfter = false, enforceMin = true } = {},
  ) {
    const sidebar = getSidebarElement();
    if (!sidebar) {
      // Without a host there is no animation to run, but a requested cleanup
      // still has to happen or the width variables outlive the panel.
      if (cleanupAfter) restoreSidebarWidth();
      return;
    }
    // Supersede any earlier animation. The timer handle alone is not enough:
    // an animation that has not reached its frame yet has armed nothing, and
    // its cleanup (which restores the width) would still fire later.
    const epoch = ++widthAnimationEpoch;
    if (widthAnimationTimer) {
      getScope().clearTimeout(widthAnimationTimer);
      widthAnimationTimer = null;
    }

    const startWidth = sidebar.getBoundingClientRect().width || DEFAULT_WIDTH;
    const minWidth = enforceMin ? getMinSidebarWidth() : 0;
    const clampedTarget = Math.min(MAX_WIDTH, Math.max(minWidth, targetWidth));
    const transitionEls = getSidebarWidthTransitionElements(sidebar);

    setSidebarWidthForAnimation(sidebar, startWidth, { enforceMin: false });
    transitionEls.forEach((el) => el.classList.add("sfp-width-animating"));

    requestAnimationFrame(() => {
      if (epoch !== widthAnimationEpoch) return;
      setSidebarWidthForAnimation(sidebar, clampedTarget, { enforceMin });

      widthAnimationTimer = setTimeout(() => {
        widthAnimationTimer = null;
        transitionEls.forEach((el) =>
          el.classList.remove("sfp-width-animating"),
        );
        if (cleanupAfter) {
          restoreSidebarWidth();
        }
      }, 260);
    });
  }

  function restoreSidebarWidth() {
    clearSidebarWidths();
    const sidebar = getSidebarElement();
    if (sidebar) {
      getSidebarWidthTransitionElements(sidebar).forEach((el) =>
        el.classList.remove("sfp-width-animating"),
      );
    }
    clearSidebarWidthVariable();
  }

  /**
   * 宽度把手的命中区挂在 `body` 上、`position: fixed`，横跨侧边栏边界。
   *
   * 为什么不挂在把手里面：侧边栏是 `overflow-x: hidden`，而把手本身在
   * `right: -2px`——挂在里面的话，伸到边界外的那一截会被裁掉，看得见摸不着。
   * 只有离开侧边栏的裁剪上下文，外面那一半才点得到。
   */
  function syncResizerGrip() {
    const sidebar = getSidebarElement();
    const grip = resizerGripEl;
    if (!sidebar || !grip) return;
    const rect = sidebar.getBoundingClientRect();
    if (rect.height <= 0) {
      grip.hidden = true;
      return;
    }
    grip.hidden = false;
    grip.style.left = `${rect.right}px`;
    grip.style.top = `${rect.top + rect.height / 2}px`;
    grip.style.height = `${rect.height / 4}px`;
  }

  /** 滚动/resize 会连续触发，合并到下一帧再量一次。 */
  function queueGripSync() {
    if (gripSyncQueued) return;
    gripSyncQueued = true;
    requestAnimationFrame(() => {
      gripSyncQueued = false;
      syncResizerGrip();
    });
  }

  function setupResizer() {
    const sidebar = getSidebarElement();
    if (!sidebar) return;

    if (resizerEl && !sidebar.contains(resizerEl)) {
      resizerEl.remove();
      resizerEl = null;
    }

    if (resizerEl) return;

    resizerEl =
      sidebar.querySelector<HTMLElement>(":scope > .sfp-resizer") ||
      document.createElement("div");
    resizerEl.className = "sfp-resizer";
    if (!resizerEl.parentElement) {
      sidebar.appendChild(resizerEl);
    }

    if (!resizerGripEl || !resizerGripEl.isConnected) {
      resizerGripEl = document.createElement("div");
      resizerGripEl.className = "sfp-resizer-grip";
      resizerGripEl.addEventListener("mousedown", beginResize);
      document.body.appendChild(resizerGripEl);
      // 侧边栏会随滚动/窗口尺寸改变位置与高度，命中区必须跟着走。
      getScope().listen(window, "scroll", queueGripSync, {
        passive: true,
        capture: true,
      });
      getScope().listen(window, "resize", queueGripSync);
    }
    syncResizerGrip();

    resizerEl.addEventListener("mousedown", beginResize);
  }

  function beginResize(e: MouseEvent) {
    const sidebar = getSidebarElement();
    if (!sidebar || isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    const startX = e.clientX;
    const startWidth = sidebar.offsetWidth;
    let finalWidth = getWidth();
    resizerEl?.classList.add("sfp-resizing");
    getSidebarWidthTransitionElements(sidebar).forEach((el) =>
      el.classList.remove("sfp-width-animating"),
    );
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = e.clientX - startX;
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(getMinSidebarWidth(), startWidth + delta),
      );
      applySidebarWidth(newWidth);
      finalWidth = newWidth;
      syncResizerGrip();
    };

    const onMouseUp = () => {
      onWidth(finalWidth);
      cleanup();
      forget();
      syncResizerGrip();
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
  }

  function removeResizer() {
    if (resizerEl) {
      resizerEl.remove();
      resizerEl = null;
    }
    if (resizerGripEl) {
      resizerGripEl.remove();
      resizerGripEl = null;
    }

    const sidebar = getSidebarElement();
    sidebar
      ?.querySelectorAll<HTMLElement>(":scope > .sfp-resizer")
      .forEach((el) => el.remove());
  }

  function ensure() {
    const sidebar = getSidebarElement();
    if (!sidebar) return;
    if (
      !sidebar.classList.contains("sfp-feed-mode") ||
      originalSidebarWidthBeforeFeed === null
    ) {
      originalSidebarWidthBeforeFeed =
        sidebar.getBoundingClientRect().width || DEFAULT_WIDTH;
    }
    sidebar.classList.add("sfp-feed-mode");
    animateSidebarWidth(getWidth());
    setupResizer();
  }
  function mount(
    buildHeader: (header: HTMLElement) => void,
    buildTabs: () => HTMLElement,
    buildFilter: () => HTMLElement,
  ) {
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
    animateSidebarWidth(originalSidebarWidthBeforeFeed || DEFAULT_WIDTH, {
      cleanupAfter: true,
      enforceMin: false,
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
    },
    get toggleBtn() {
      return toggleBtn;
    },
  };
}
