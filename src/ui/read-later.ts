import {
  READ_LATER_ITEM_FALLBACK_HEIGHT,
  READ_LATER_MIN_SECTION_HEIGHT,
  READ_LATER_ONBOX_GAP_MS,
  READ_LATER_ONBOX_RETRY_MS,
} from "../constants";
import type { Topic, TopicUser } from "../feed/types";
import type { createI18n } from "../i18n";
import type { createDiscourseBridge } from "../platform/discourse";
import type { Lifetime } from "../platform/lifetime";
import {
  extractPreview,
  parseReadLaterLink,
  type ParsedReadLaterLink,
  type ReadLaterItem,
  readLaterFallbackTitle,
} from "../read-later";
import type { createTopicRenderer } from "./topic-item";
import { escapeAttr, escapeHtml } from "./html";
import { _svgIcon } from "./icons";

interface ReadLaterViewDependencies {
  t: ReturnType<typeof createI18n>["t"];
  discourse: ReturnType<typeof createDiscourseBridge>;
  renderer: ReturnType<typeof createTopicRenderer>;
  items(): readonly ReadLaterItem[];
  savedHeight(): number | null;
  saveHeight(value: number | null): void;
  updateItems(next: readonly ReadLaterItem[]): readonly ReadLaterItem[];
  reloadItems(): readonly ReadLaterItem[];
  /** 别的标签页改了存储：重读后需要补齐话题快照。 */
  onExternalItems(): void;
  removeItem(url: string): readonly ReadLaterItem[];
  onAdd(link: ParsedReadLaterLink, title: string): void;
  /** 打开话题条目：把快照标记为已读并持久化（§一.3）。 */
  markRead(url: string): void;
  fetchOnebox(
    url: string,
    signal: AbortSignal,
  ): Promise<{ status: number; html: string }>;
  getFeedScroll(): HTMLElement | null;
  onLayoutChange(): void;
  getScope(): Lifetime;
}

export function createReadLaterView({
  t,
  discourse,
  renderer,
  items,
  savedHeight,
  saveHeight,
  updateItems,
  reloadItems,
  onExternalItems,
  removeItem,
  onAdd,
  markRead,
  fetchOnebox,
  getFeedScroll,
  onLayoutChange,
  getScope,
}: ReadLaterViewDependencies) {
  const { isLoggedIn, toAbsoluteSiteUrl } = discourse;

  let section: HTMLElement | null = null;
  let divider: HTMLElement | null = null;
  let list: HTMLElement | null = null;
  let feedScrollEl: HTMLElement | null = null;

  // 页内状态：随页面刷新消失，不进 localStorage、不跨标签页共享。
  let availability: "available" | "unavailable" = "unavailable";
  const failedUrls = new Set<string>();
  const requestedUrls = new Set<string>();
  const pendingUrls = new Set<string>();
  let previewQueue: string[] = [];
  let previewBusy = false;

  let dragActive = false;
  let dragHref = "";
  let dropActive = false;

  let dividerLocked = false;
  let dragging = false;

  function parsePreview(html: string) {
    return extractPreview(
      new DOMParser().parseFromString(html, "text/html"),
      location.origin,
    );
  }

  function wait(ms: number) {
    return new Promise<void>((resolve) => {
      getScope().timeout(resolve, ms);
    });
  }

  function pumpPreviewQueue() {
    if (previewBusy || previewQueue.length === 0) return;
    if (availability !== "available") {
      previewQueue = [];
      return;
    }
    previewBusy = true;
    const url = previewQueue.shift() as string;
    void (async () => {
      let html = "";
      let status = 0;
      try {
        let result = await fetchOnebox(url, getScope().signal);
        if (result.status === 429) {
          await wait(READ_LATER_ONBOX_RETRY_MS);
          result = await fetchOnebox(url, getScope().signal);
        }
        status = result.status;
        html = result.html;
      } catch {
        status = 0;
      }
      if (status === 403) {
        availability = "unavailable";
        previewQueue = [];
      } else if (status >= 200 && status < 300 && html) {
        const preview = parsePreview(html);
        if (preview.title || preview.excerpt || preview.imageUrl || preview.badge) {
          updateItems(
            items().map((item) =>
              item.url === url ? { ...item, preview } : item,
            ),
          );
        } else {
          failedUrls.add(url);
        }
      } else {
        failedUrls.add(url);
      }
      pendingUrls.delete(url);
      previewBusy = false;
      render();
      if (previewQueue.length && availability === "available") {
        getScope().timeout(() => pumpPreviewQueue(), READ_LATER_ONBOX_GAP_MS);
      }
    })();
  }

  function schedulePreview(item: ReadLaterItem) {
    if (availability !== "available") return;
    if (item.preview || requestedUrls.has(item.url) || failedUrls.has(item.url))
      return;
    requestedUrls.add(item.url);
    pendingUrls.add(item.url);
    previewQueue.push(item.url);
    pumpPreviewQueue();
  }

  function cardElement(item: ReadLaterItem) {
    const preview = item.preview || {};
    const title =
      preview.title ||
      item.title ||
      readLaterFallbackTitle(item.url) ||
      item.url;
    const href = toAbsoluteSiteUrl(item.url);

    if (preview.imageUrl || preview.excerpt || preview.badge) {
      const card = document.createElement("a");
      card.className = "sfp-rl-card";
      card.href = href;
      const imageHtml = preview.imageUrl
        ? `<img class="sfp-rl-card-image" src="${escapeAttr(preview.imageUrl)}" alt="" loading="lazy">`
        : `<span class="sfp-rl-fallback-icon">${_svgIcon("link")}</span>`;
      const badgeHtml = preview.badge
        ? `<span class="sfp-rl-card-badge">${escapeHtml(preview.badge)}</span>`
        : "";
      card.innerHTML = `${imageHtml}<span class="sfp-rl-card-body"><span class="sfp-rl-card-title" dir="auto">${escapeHtml(title)}</span>${preview.excerpt ? `<span class="sfp-rl-card-excerpt" dir="auto">${escapeHtml(preview.excerpt)}</span>` : ""}${badgeHtml}</span>`;
      return card;
    }

    // 匿名或预览失败：不加载 favicon，也不留空图位。
    const fallback = document.createElement("a");
    fallback.className = "sfp-rl-fallback";
    fallback.href = href;
    fallback.innerHTML = `<span class="sfp-rl-fallback-icon">${_svgIcon("link")}</span><span class="sfp-rl-fallback-body"><span class="sfp-rl-fallback-title" dir="auto">${escapeHtml(title)}</span><span class="sfp-rl-fallback-note">${escapeHtml(t("linkPreview"))}</span></span>`;
    return fallback;
  }

  function renderItem(item: ReadLaterItem) {
    const wrapper = document.createElement("div");
    wrapper.className = "sfp-rl-item";
    wrapper.dataset.url = item.url;

    if (item.kind === "topic" && item.topic) {
      const element = renderer.createTopicItem(item.topic, false, {
        href: item.url,
        user: item.user,
        onActivate: () => {
          markRead(item.url);
          renderer.markRead(element);
        },
      });
      wrapper.append(element);
    } else {
      wrapper.append(cardElement(item));
      schedulePreview(item);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "sfp-rl-remove";
    remove.setAttribute("aria-label", t("readLaterRemove"));
    remove.title = t("readLaterRemove");
    remove.innerHTML = _svgIcon("times");
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeItem(item.url);
      render();
    });
    wrapper.append(remove);
    return wrapper;
  }

  function firstItemHeight(root: HTMLElement | null) {
    if (!root) return null;
    const element = root.querySelector<HTMLElement>(
      ".sfp-rl-item, .sfp-topic-item",
    );
    const height = element?.offsetHeight || 0;
    return height > 0 ? height : null;
  }

  /**
   * 可分配的总高度不能从「当前 scroll + 当前 section」推算：section 溢出容器时
   * 那个和会跟着虚高。改为从容器净高减去 section 之上的固定部分（头部/标签/筛选），
   * 后者等于 `scroll.offsetTop`（`.sfp-feed-container` 是 offsetParent）。
   */
  function measureRoom() {
    const scroll = feedScrollEl;
    const container = section?.parentElement;
    if (!scroll || !container) return null;
    const available = container.clientHeight - scroll.offsetTop;
    if (available <= 0) return null;
    return {
      available,
      mainMin: firstItemHeight(scroll) ?? READ_LATER_ITEM_FALLBACK_HEIGHT,
      laterMin:
        (divider?.offsetHeight || 0) +
        (firstItemHeight(list) ?? READ_LATER_MIN_SECTION_HEIGHT),
    };
  }

  function applyHeight() {
    if (!section || section.hidden || !divider) return;
    const room = measureRoom();
    if (!room) return;
    const { available, mainMin, laterMin } = room;

    if (available < mainMin + laterMin) {
      // 两侧都放不下一个条目：固定在中间对半分，分隔线不可拖。
      dividerLocked = true;
      divider.setAttribute("aria-disabled", "true");
      divider.removeAttribute("aria-valuenow");
      section.style.height = `${Math.floor(available / 2)}px`;
      return;
    }

    dividerLocked = false;
    divider.removeAttribute("aria-disabled");
    const saved = savedHeight();
    const autoHeight =
      (firstItemHeight(list) ?? READ_LATER_ITEM_FALLBACK_HEIGHT) *
      Math.min(items().length || 1, 2);
    const desired = saved ?? autoHeight;
    const height = Math.min(Math.max(desired, laterMin), available - mainMin);
    section.style.height = `${height}px`;
    divider.setAttribute("aria-valuemin", String(Math.round(laterMin)));
    divider.setAttribute(
      "aria-valuemax",
      String(Math.round(available - mainMin)),
    );
    divider.setAttribute("aria-valuenow", String(Math.round(height)));
  }

  function dropPlaceholder() {
    const box = document.createElement("div");
    box.className = "sfp-rl-drop";
    box.textContent = t("readLaterDropHint");
    if (dropActive) box.classList.add("sfp-rl-drop-active");
    return box;
  }

  function render() {
    if (!section || !list) return;
    const current = items();
    const scroll = section.querySelector<HTMLElement>(".sfp-rl-scroll");
    const atBottom = scroll
      ? scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 4
      : true;
    // 先清空：空态时若直接 return，旧的条目节点会留在隐藏的容器里。
    list.replaceChildren();
    if (current.length === 0 && !dragActive) {
      section.hidden = true;
      section.style.height = "";
      onLayoutChange();
      return;
    }
    section.hidden = false;
    section.setAttribute("aria-label", t("readLaterTitle"));

    if (current.length === 0) {
      list.append(dropPlaceholder());
    } else {
      for (const item of current) list.append(renderItem(item));
      if (pendingUrls.size) {
        const pending = document.createElement("div");
        pending.className = "sfp-rl-pending";
        pending.textContent = t("loading");
        list.append(pending);
      }
    }

    applyHeight();
    if (scroll && atBottom) scroll.scrollTop = scroll.scrollHeight;
    onLayoutChange();
  }

  function setDropActive(active: boolean) {
    if (dropActive === active) return;
    dropActive = active;
    const box = list?.querySelector(".sfp-rl-drop");
    if (box) box.classList.toggle("sfp-rl-drop-active", active);
    section?.classList.toggle("sfp-rl-drop-active", active);
  }

  function beginDrag() {
    if (dragActive) return;
    dragActive = true;
    render();
  }

  function endDrag() {
    if (!dragActive) return;
    dragActive = false;
    dragHref = "";
    setDropActive(false);
    render();
  }

  function readDraggedHref(event: DragEvent) {
    const data = event.dataTransfer;
    if (!data) return dragHref;
    const uriList = data.getData("text/uri-list");
    const candidate = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    if (candidate) return candidate;
    const plain = data.getData("text/plain");
    return plain.trim() || dragHref;
  }

  /** 把目标高度钳进 [laterMin, available - mainMin]，返回 null 表示量不到布局。 */
  function clampHeight(next: number) {
    const room = measureRoom();
    if (!room) return null;
    const max = Math.max(room.laterMin, room.available - room.mainMin);
    return Math.round(Math.min(Math.max(next, room.laterMin), max));
  }

  function setSectionHeight(height: number) {
    if (!section) return;
    section.style.height = `${height}px`;
    divider?.setAttribute("aria-valuenow", String(height));
  }

  function setupHeightDrag() {
    if (!divider || !section) return;
    const scope = getScope();
    const start = (event: PointerEvent) => {
      if (dividerLocked) return;
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      divider?.classList.add("sfp-rl-dragging");
      const startY = event.clientY;
      const startHeight = section?.offsetHeight || 0;
      const removeMove = scope.listen(document, "pointermove", (move) => {
        if (!dragging) return;
        const height = clampHeight(startHeight - (move.clientY - startY));
        if (height !== null) setSectionHeight(height);
      });
      const removeUp = scope.listen(document, "pointerup", () => {
        if (!dragging) return;
        dragging = false;
        divider?.classList.remove("sfp-rl-dragging");
        const height = section?.offsetHeight || 0;
        if (height > 0) saveHeight(height);
        removeMove();
        removeUp();
        onLayoutChange();
      });
    };
    scope.listen(divider, "pointerdown", start);
    scope.listen(divider, "keydown", (event) => {
      if (dividerLocked || !section) return;
      const room = measureRoom();
      if (!room) return;
      const current = section.offsetHeight;
      let next: number;
      if (event.key === "ArrowUp") next = current + 16;
      else if (event.key === "ArrowDown") next = current - 16;
      else if (event.key === "Home") next = room.laterMin;
      else if (event.key === "End") next = room.available - room.mainMin;
      else return;
      event.preventDefault();
      const height = clampHeight(next);
      if (height === null) return;
      setSectionHeight(height);
      saveHeight(height);
      onLayoutChange();
    });
  }

  function setupDragAndDrop(container: HTMLElement) {
    const scope = getScope();

    // 拖拽期间 getData 返回空串，只能读 types；最终判定放在 drop。
    scope.listen(
      document,
      "dragstart",
      (event) => {
        const target =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>("a[href]")
            : null;
        if (!target) return;
        dragHref = target.getAttribute("href") || "";
        if (dragHref) beginDrag();
      },
      true,
    );

    scope.listen(container, "dragenter", (event) => {
      const types = Array.from(event.dataTransfer?.types || []);
      if (!dragActive && !types.includes("text/uri-list")) return;
      beginDrag();
    });

    scope.listen(container, "dragover", (event) => {
      const types = Array.from(event.dataTransfer?.types || []);
      if (!dragActive && !types.includes("text/uri-list")) return;
      // 一律拦下：链接丢进面板不应触发页面导航。
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDropActive(true);
    });

    scope.listen(container, "dragleave", (event) => {
      const next = event.relatedTarget;
      if (!next || !(next instanceof Node) || !container.contains(next)) {
        setDropActive(false);
      }
    });

    scope.listen(section as HTMLElement, "drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const raw = readDraggedHref(event);
      setDropActive(false);
      endDrag();
      if (!raw) return;
      const parsed = parseReadLaterLink(raw, location.origin);
      if (!parsed) return;
      const data = event.dataTransfer;
      const plain = data?.getData("text/plain") || "";
      const title = plain && !/^https?:\/\//i.test(plain) ? plain : "";
      onAdd(parsed, title);
    });
    scope.listen(document, "dragend", () => endDrag());
    scope.listen(window, "dragleave", (event) => {
      if (!event.relatedTarget) endDrag();
    });
    scope.listen(document, "drop", () => {
      setDropActive(false);
      endDrag();
    });
  }

  function mount(container: HTMLElement) {
    if (section && container.contains(section)) {
      ensure(container);
      return;
    }
    section?.remove();
    feedScrollEl = getFeedScroll();

    section = document.createElement("section");
    section.className = "sfp-read-later";
    section.hidden = true;

    divider = document.createElement("div");
    divider.className = "sfp-rl-divider";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", "horizontal");
    divider.setAttribute("aria-label", t("readLaterTitle"));
    divider.tabIndex = 0;

    const scroll = document.createElement("div");
    scroll.className = "sfp-rl-scroll";
    list = document.createElement("div");
    list.className = "sfp-rl-list";
    scroll.append(list);
    section.append(divider, scroll);
    container.append(section);

    availability = isLoggedIn() ? "available" : "unavailable";

    setupHeightDrag();
    setupDragAndDrop(container);

    getScope().listen(window, "resize", () => applyHeight());
    getScope().listen(window, "storage", (event) => {
      if (event.key === null || event.key.endsWith("sfp_read_later_v1")) {
        reloadItems();
        render();
        onExternalItems();
        return;
      }
      if (event.key.endsWith("sfp_read_later_height_v1")) {
        reloadItems();
        render();
      }
    });

    render();
  }

  function ensure(container: HTMLElement) {
    if (!section) {
      mount(container);
      return;
    }
    if (!container.contains(section)) container.append(section);
    feedScrollEl = getFeedScroll();
    render();
  }

  return {
    mount,
    ensure,
    render,
    destroy() {
      section?.remove();
      section = null;
      divider = null;
      list = null;
      feedScrollEl = null;
      previewQueue = [];
      pendingUrls.clear();
    },
    /** 主列表刷新后重渲染（话题快照已由控制器更新）。 */
    refresh: () => render(),
  };
}
