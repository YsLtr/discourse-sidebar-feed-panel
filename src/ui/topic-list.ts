import type { ScrollAnchor, Topic } from "../feed/types";
import type { createI18n } from "../i18n";
import { errorMessage } from "../platform/json";
import type { Lifetime } from "../platform/lifetime";
import { escapeHtml } from "./html";
type HeadResult = "reached" | "interrupted" | "timeout";
interface TopicListDependencies {
  t: ReturnType<typeof createI18n>["t"];
  hasMore(): boolean;
  loadMore(): void;
  renderItem(topic: Topic, highlight?: boolean): HTMLElement;
  getScroll(): HTMLElement | null;
  getList(): HTMLElement | null;
  getScope(): Lifetime;
  syncHead(): void;
  atHead(): boolean;
}
export function createTopicList({
  getScroll,
  getList,
  getScope,
  syncHead,
  atHead,
  t,
  hasMore,
  loadMore,
  renderItem,
}: TopicListDependencies) {
  const requestAnimationFrame = (fn: FrameRequestCallback) =>
    getScope().frame(fn);
  function _captureFeedScrollAnchor(): ScrollAnchor | null {
    const feedScrollEl = getScroll();
    const feedListEl = getList();
    if (!feedScrollEl || !feedListEl) return null;
    if (feedScrollEl.scrollTop <= 1) return null;

    const scrollRect = feedScrollEl.getBoundingClientRect();
    const items = feedListEl.querySelectorAll<HTMLElement>(
      ".sfp-topic-item[data-topic-id]",
    );
    for (const item of items) {
      const itemRect = item.getBoundingClientRect();
      if (itemRect.bottom > scrollRect.top + 1) {
        return {
          topicId: item.dataset.topicId || null,
          offsetTop: itemRect.top - scrollRect.top,
          scrollTop: feedScrollEl.scrollTop,
          scrollHeight: feedScrollEl.scrollHeight,
        };
      }
    }

    return {
      topicId: null,
      offsetTop: 0,
      scrollTop: feedScrollEl.scrollTop,
      scrollHeight: feedScrollEl.scrollHeight,
    };
  }

  function _restoreFeedScrollAnchor(anchor: ScrollAnchor | null) {
    const feedScrollEl = getScroll();
    const feedListEl = getList();
    if (!anchor || !feedScrollEl || !feedListEl) return;

    const restore = () => {
      if (!feedScrollEl || !feedListEl) return;

      if (anchor.topicId) {
        const item = feedListEl.querySelector<HTMLElement>(
          `.sfp-topic-item[data-topic-id="${anchor.topicId}"]`,
        );
        if (item) {
          const scrollRect = feedScrollEl.getBoundingClientRect();
          const itemRect = item.getBoundingClientRect();
          feedScrollEl.scrollTop +=
            itemRect.top - scrollRect.top - anchor.offsetTop;
          syncHead();
          return;
        }
      }

      feedScrollEl.scrollTop =
        anchor.scrollTop + (feedScrollEl.scrollHeight - anchor.scrollHeight);
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
    return new Promise<HeadResult>((resolve) => {
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
      const finish = (result: HeadResult) => {
        if (done) return;
        forget();
        cleanup();
        resolve(result);
      };
      const onInterrupt = () => {
        if (feedScrollEl) {
          feedScrollEl.scrollTo({
            top: feedScrollEl.scrollTop,
            behavior: "auto",
          });
        }
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
        } else {
          settledFrames = 0;
        }
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
      scrollElement.addEventListener("pointerdown", onInterrupt, {
        passive: true,
      });
      scrollElement.addEventListener("touchstart", onInterrupt, {
        passive: true,
      });
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
    const list = getList();
    list
      ?.querySelectorAll<HTMLElement>(
        ".sfp-load-more, .sfp-no-more, .sfp-load-more-note",
      )
      .forEach((el) => el.remove());
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
  function _showLoadMoreError(error: unknown) {
    const list = getList();
    _removePaginationFooter();
    const el = document.createElement("div");
    el.className = "sfp-load-more sfp-load-more-error";
    el.innerHTML = `
      <span>${escapeHtml(t("requestFailed"))}</span>
      <button type="button" class="sfp-load-more-retry">${escapeHtml(t("retry"))}</button>
    `;
    el.querySelector<HTMLElement>(".sfp-load-more-retry")?.addEventListener(
      "click",
      () => {
        loadMore();
      },
    );
    if (list) list.appendChild(el);
    console.warn("[SFP] load more failed:", error);
  }
  function showMessage(message: string) {
    const list = getList();
    if (list)
      list.innerHTML = `<div class="sfp-empty">${escapeHtml(message)}</div>`;
  }
  function showLoading() {
    const list = getList();
    if (list)
      list.innerHTML = `<div class="sfp-loading"><div class="sfp-spinner"></div>${escapeHtml(t("loading"))}</div>`;
  }
  function showError(error: unknown, retry: () => void) {
    const list = getList();
    if (!list) return;
    list.innerHTML = `<div class="sfp-error"><div class="sfp-error-icon">!</div><div class="sfp-error-msg">${escapeHtml(t("loadFailed"))}</div><div class="sfp-error-detail">${escapeHtml(errorMessage(error))}</div><button class="sfp-retry-btn">${escapeHtml(t("retry"))}</button></div>`;
    list.querySelector(".sfp-retry-btn")?.addEventListener("click", retry);
  }
  function append(
    topics: readonly Topic[],
    highlights: readonly number[] = [],
  ) {
    const list = getList();
    if (list)
      for (const topic of topics)
        list.append(renderItem(topic, highlights.includes(topic.id)));
  }
  function render(
    topics: readonly Topic[],
    emptyMessage: string,
    highlights: readonly number[],
  ) {
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
    waitForHead: _waitForFeedScrollHead,
  };
}
