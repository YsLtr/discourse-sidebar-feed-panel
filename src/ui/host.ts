import { DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH } from "../constants";
import type { createI18n } from "../i18n";
import type { Lifetime } from "../platform/lifetime";
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
    toggleBtn?.remove();

    const homeLogo = document.querySelector<HTMLElement>(
      ".home-logo-wrapper-outlet",
    );
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

    // 放入 .title 内部，logo 右边
    const titleEl = homeLogo.querySelector<HTMLElement>(".title");
    if (titleEl) {
      titleEl.appendChild(toggleBtn);
    } else {
      homeLogo.appendChild(toggleBtn);
    }
    return toggleBtn;
  }

  function getMinSidebarWidth() {
    return MIN_WIDTH;
  }

  function getSidebarElement() {
    return (
      document.querySelector<HTMLElement>("#d-sidebar") ||
      document.querySelector<HTMLElement>(".sidebar-container")
    );
  }

  function applySidebarWidth(width: number) {
    const clampedWidth = Math.min(
      MAX_WIDTH,
      Math.max(getMinSidebarWidth(), width),
    );
    const sidebar = getSidebarElement();
    if (sidebar) {
      sidebar.style.setProperty("width", clampedWidth + "px", "important");
    }
    document.documentElement.style.setProperty(
      "--d-sidebar-width",
      clampedWidth + "px",
    );
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
    sidebar.style.setProperty("width", clampedWidth + "px", "important");
    document.documentElement.style.setProperty(
      "--d-sidebar-width",
      clampedWidth + "px",
    );
  }

  function animateSidebarWidth(
    targetWidth: number,
    { cleanupAfter = false, enforceMin = true } = {},
  ) {
    const sidebar = getSidebarElement();
    if (!sidebar) return;

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
    const sidebar = getSidebarElement();
    if (sidebar) {
      sidebar.style.removeProperty("width");
      getSidebarWidthTransitionElements(sidebar).forEach((el) =>
        el.classList.remove("sfp-width-animating"),
      );
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

    resizerEl =
      sidebar.querySelector<HTMLElement>(":scope > .sfp-resizer") ||
      document.createElement("div");
    resizerEl.className = "sfp-resizer";
    if (!resizerEl.parentElement) {
      sidebar.appendChild(resizerEl);
    }

    resizerEl.addEventListener("mousedown", (e) => {
      if (isResizing) return;
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
  };
}
