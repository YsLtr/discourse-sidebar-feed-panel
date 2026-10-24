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
  /** 拖动排序：把 `url` 移到结果数组的第 `toIndex` 位。 */
  moveItem(url: string, toIndex: number): readonly ReadLaterItem[];
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
  moveItem,
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
  let overlay: HTMLElement | null = null;
  let feedScrollEl: HTMLElement | null = null;

  // 页内状态：随页面刷新消失，不进 localStorage、不跨标签页共享。
  let availability: "available" | "unavailable" = "unavailable";
  const failedUrls = new Set<string>();
  const requestedUrls = new Set<string>();
  let previewQueue: string[] = [];
  let previewBusy = false;

  let dragActive = false;
  let dragHref = "";
  let dragIsProfile = false;
  let dropActive = false;

  // 区域内部搬动：排序，或拖出区域即删除。
  let internalUrl: string | null = null;
  let internalHandled = false;
  let leftSection = false;
  let insertIndex: number | null = null;
  let insertEl: HTMLElement | null = null;

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
    // 删除是「拖出区域」：没有按钮，只能靠悬停提示告知（零布局成本）。
    wrapper.title = t("readLaterDragOut");

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
   * 可分配的高度不能从「当前 scroll + 当前 section」推算：section 溢出容器时
   * 那个和会跟着虚高。改为容器净高减去固定部分（头部/标签/筛选，等于
   * `scroll.offsetTop`）与分隔线；`.sfp-feed-container` 是 offsetParent。
   */
  function measureRoom() {
    const scroll = feedScrollEl;
    const container = section?.parentElement;
    if (!scroll || !container) return null;
    const available =
      container.clientHeight - scroll.offsetTop - (divider?.offsetHeight || 0);
    if (available <= 0) return null;
    return {
      available,
      mainMin: firstItemHeight(scroll) ?? READ_LATER_ITEM_FALLBACK_HEIGHT,
      laterMin: firstItemHeight(list) ?? READ_LATER_MIN_SECTION_HEIGHT,
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
      setSectionHeight(Math.floor(available / 2));
      divider.removeAttribute("aria-valuenow");
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
    divider.setAttribute("aria-valuemin", String(Math.round(laterMin)));
    divider.setAttribute(
      "aria-valuemax",
      String(Math.round(available - mainMin)),
    );
    setSectionHeight(height);
  }

  function createDropOverlay() {
    const box = document.createElement("div");
    box.className = "sfp-rl-drop";
    box.hidden = true;
    box.innerHTML = `<span>${escapeHtml(t("readLaterDropHint"))}</span>`;
    return box;
  }

  function readLaterScroll() {
    return section?.querySelector<HTMLElement>(".sfp-rl-scroll") || null;
  }

  function render() {
    if (!section || !list) return;
    const current = items();

    // 先清空：空态时若直接 return，旧的条目节点会留在隐藏的容器里。
    list.replaceChildren();
    if (current.length === 0) {
      section.hidden = true;
      section.style.height = "";
      if (divider) divider.hidden = true;
      setOverlay(false);
      onLayoutChange();
      return;
    }
    section.hidden = false;
    if (divider) divider.hidden = false;
    section.setAttribute("aria-label", t("readLaterTitle"));
    // `items()` 已经是最新在前，DOM 顺序就是视觉顺序；贴底由 `.sfp-rl-list`
    // 的 `margin-top: auto` 完成，不再用 JS 改 scrollTop（那会让内容乱跳）。
    for (const item of current) list.append(renderItem(item));

    applyHeight();
    onLayoutChange();
  }

  /** 指示框是覆盖整个区域的遮罩，不参与列表排版。 */
  function setOverlay(visible: boolean) {
    if (!overlay) return;
    overlay.hidden = !visible;
    overlay.classList.toggle("sfp-rl-drop-active", dropActive);
    overlayText(dropActive);
  }

  function overlayText(active: boolean) {
    const label = overlay?.firstElementChild;
    if (label) label.textContent = t(active ? "readLaterDropRelease" : "readLaterDropHint");
  }

  function setDropActive(active: boolean) {
    if (dropActive === active) return;
    dropActive = active;
    overlay?.classList.toggle("sfp-rl-drop-active", active);
    overlayText(active);
  }

  /** 内部排序的插入位置提示：只加边框，不动布局，避免拖动时列表抖动。 */
  function setInsertMark(index: number | null) {
    if (insertIndex === index && insertEl) return;
    insertEl?.classList.remove("sfp-rl-insert-before", "sfp-rl-insert-after");
    insertEl = null;
    insertIndex = index;
    const nodes = [...(list?.querySelectorAll<HTMLElement>(".sfp-rl-item") ?? [])];
    if (index === null || nodes.length === 0) return;
    const target = index < nodes.length ? nodes[index] : nodes[nodes.length - 1];
    insertEl = target;
    target.classList.add(
      index < nodes.length ? "sfp-rl-insert-before" : "sfp-rl-insert-after",
    );
  }

  function insertionIndexAt(clientY: number) {
    const nodes = [...(list?.querySelectorAll<HTMLElement>(".sfp-rl-item") ?? [])];
    for (let index = 0; index < nodes.length; index++) {
      const rect = nodes[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return nodes.length;
  }

  /**
   * 开始拖拽只切换可见性，**不能重渲染列表**：dragstart 期间把条目节点换掉，
   * 浏览器会取消这次拖拽（文本拖拽尤其如此，图片拖拽因为数据已抓取才幸存）。
   */
  function beginDrag() {
    if (dragActive) return;
    dragActive = true;
    if (!section) return;
    section.hidden = false;
    if (divider) divider.hidden = false;
    setOverlay(true);
    applyHeight();
    onLayoutChange();
  }

  /** 从区域内拖动条目：这是「搬动」，不是「加入」，所以不显示加入遮罩。 */
  function beginInternalDrag(url: string) {
    internalUrl = url;
    internalHandled = false;
    leftSection = false;
    list
      ?.querySelector(`.sfp-rl-item[data-url="${CSS.escape(url)}"]`)
      ?.classList.add("sfp-rl-dragging");
  }

  function endDrag() {
    if (!dragActive && internalUrl === null) return;
    const removedUrl =
      internalUrl && !internalHandled && leftSection ? internalUrl : null;
    dragActive = false;
    dragHref = "";
    dragIsProfile = false;
    dropActive = false;
    internalUrl = null;
    internalHandled = false;
    leftSection = false;
    setOverlay(false);
    setInsertMark(null);
    if (removedUrl) removeItem(removedUrl);
    render();
  }

  /**
   * 文本拖拽时 `dragstart.target` 会退到整张条目卡片（外层 `<a>`），
   * 于是从昵称、用户名拖出会被当成话题。两种兜底：
   * 先按指针位置取真正被抓住的元素（最准），再退到文本选区。
   */
  function profileAt(event: DragEvent) {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    return (
      (hit instanceof Element
        ? hit.closest<HTMLElement>("[data-user-profile-link]")
        : null) || null
    );
  }

  function selectionProfile() {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) return null;
    const anchor = selection.anchorNode;
    if (!anchor) return null;
    const element =
      anchor instanceof Element ? anchor : (anchor.parentElement ?? null);
    return element?.closest<HTMLElement>("[data-user-profile-link]") || null;
  }

  /**
   * 优先用 dragstart 记下的地址，但只限「从发布者链接拖出」这一种：
   * 浏览器给整张条目卡片（外层 `<a>`）准备的 `text/uri-list` 是话题链接，
   * 会盖掉发布者链接。其余情况仍以 `text/uri-list` 为准，跨文档拖入也走它。
   */
  function readDraggedHref(event: DragEvent) {
    if (dragIsProfile && dragHref) return dragHref;
    const data = event.dataTransfer;
    if (!data) return dragHref;
    const uriList = data.getData("text/uri-list");
    const candidate = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    if (candidate) return candidate;
    return data.getData("text/plain").trim() || dragHref;
  }

  /** 把目标高度钳进 [laterMin, available - mainMin]，返回 null 表示量不到布局。 */
  function clampHeight(next: number) {
    const room = measureRoom();
    if (!room) return null;
    const max = Math.max(room.laterMin, room.available - room.mainMin);
    return Math.round(Math.min(Math.max(next, room.laterMin), max));
  }

  /**
   * 改高度只改变可见窗口：底边钉在容器底部，内容不跟着分隔线走。
   * 变高时从上方多露出更早的条目，而不是把整摞内容往下推。
   */
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
        const origin = event.target instanceof Element ? event.target : null;
        if (!origin) return;

        // 区域内的条目：这是「搬动」，交给排序/拖出删除处理。
        const own = origin.closest<HTMLElement>(".sfp-rl-item");
        if (own && section?.contains(own)) {
          const url = own.dataset.url || "";
          if (url) {
            beginInternalDrag(url);
            // 带上私有类型：别的区域看到它就知道这是内部搬动，不该当成新链接。
            event.dataTransfer?.setData("application/x-sfp-read-later", url);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          }
          return;
        }

        // 条目本身是 `<a>`，头像/昵称/用户名是包在里面的 span：
        // 直接 closest("a[href]") 会拿到话题链接，所以先认发布者链接。
        // 指针位置最可靠（dragstart 的 target 有时会被重定向到外层卡片），
        // 文本拖拽则靠选区兜底。
        const profile =
          profileAt(event) ||
          origin.closest<HTMLElement>("[data-user-profile-link]") ||
          selectionProfile();
        dragHref =
          profile?.getAttribute("data-user-profile-url") ||
          origin.closest<HTMLElement>("a[href]")?.getAttribute("href") ||
          "";
        dragIsProfile = Boolean(profile);
        if (dragHref) beginDrag();
      },
      true,
    );

    scope.listen(container, "dragenter", (event) => {
      if (internalUrl) return;
      const types = Array.from(event.dataTransfer?.types || []);
      if (!dragActive && !types.includes("text/uri-list")) return;
      beginDrag();
    });

    scope.listen(container, "dragover", (event) => {
      if (internalUrl) {
        // 内部搬动：只认区域本身，给出插入位置提示。
        if (!section?.contains(event.target as Node)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        setInsertMark(insertionIndexAt(event.clientY));
        return;
      }
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
        if (internalUrl) {
          leftSection = true;
          setInsertMark(null);
        }
      }
    });

    scope.listen(section as HTMLElement, "drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (internalUrl) {
        const url = internalUrl;
        const from = items().findIndex((item) => item.url === url);
        const to = insertionIndexAt(event.clientY);
        internalHandled = true;
        setInsertMark(null);
        // 先移除自己再插入，所以目标下标要按移除后的数组修正。
        const target = to > from ? to - 1 : to;
        if (from >= 0 && target !== from) moveItem(url, target);
        endDrag();
        return;
      }
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
    divider?.remove();
    feedScrollEl = getFeedScroll();

    // 分隔线挂在容器上、区域之前：它不属于任何一侧，线上方就是主列表。
    divider = document.createElement("div");
    divider.className = "sfp-rl-divider";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", "horizontal");
    divider.setAttribute("aria-label", t("readLaterTitle"));
    divider.tabIndex = 0;
    divider.hidden = true;

    section = document.createElement("section");
    section.className = "sfp-read-later";
    section.hidden = true;

    const scroll = document.createElement("div");
    scroll.className = "sfp-rl-scroll";
    list = document.createElement("div");
    list.className = "sfp-rl-list";
    scroll.append(list);
    overlay = createDropOverlay();
    section.append(scroll, overlay);
    container.append(divider, section);

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
    if (!section || !divider) {
      mount(container);
      return;
    }
    if (!container.contains(section)) container.append(divider, section);
    feedScrollEl = getFeedScroll();
    render();
  }

  return {
    mount,
    ensure,
    render,
    destroy() {
      section?.remove();
      divider?.remove();
      section = null;
      divider = null;
      list = null;
      overlay = null;
      feedScrollEl = null;
      insertEl = null;
      insertIndex = null;
      internalUrl = null;
      previewQueue = [];
    },
    /** 主列表刷新后重渲染（话题快照已由控制器更新）。 */
    refresh: () => render(),
  };
}
