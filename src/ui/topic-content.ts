import type { Topic, TopicContent, TopicContentPost } from "../feed/types";
import type { createI18n } from "../i18n";
import type { Lifetime } from "../platform/lifetime";
import {
  decodeHtmlEntities,
  escapeAttr,
  escapeHtml,
  selectTopicTitle,
} from "./html";

interface TopicContentDialogDependencies {
  t: ReturnType<typeof createI18n>["t"];
  formatRelativeTime: ReturnType<typeof createI18n>["formatRelativeTime"];
  categoryName(id?: number): string | undefined;
  getScope(): Lifetime;
}

export interface TopicContentDialog {
  open(topic: Topic, content: TopicContent | null): void;
  close(): void;
}

const DROP_SELECTOR =
  "script,style,link,meta,base,iframe,frame,frameset,object,embed,form,input,button,select,textarea";

/**
 * `cooked` 由 Discourse 服务端消毒，但这段 HTML 要进入我们自己的弹窗，
 * 仍按最小代价再挡一层：去掉可执行节点、事件属性与 `javascript:` 地址。
 * 保留格式、代码块、图片与表格——弹窗的意义就是看真实正文。
 */
export function sanitizeCooked(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelectorAll(DROP_SELECTOR).forEach((node) => node.remove());
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      else if (attr.name === "srcdoc") el.removeAttribute(attr.name);
      else if (
        /^(href|src|xlink:href)$/i.test(attr.name) &&
        /^\s*javascript:/i.test(attr.value)
      )
        el.removeAttribute(attr.name);
    }
  }
  return doc.body.innerHTML;
}

function absoluteTime(value?: string) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function count(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * 异常话题的正文弹窗。只在点击异常标记时创建，关闭即从 DOM 移除；
 * 所有监听随本次打开创建、随关闭释放。
 */
export function createTopicContentDialog({
  t,
  formatRelativeTime,
  categoryName,
  getScope,
}: TopicContentDialogDependencies): TopicContentDialog {
  let overlay: HTMLElement | null = null;
  let body: HTMLElement | null = null;
  let titleEl: HTMLElement | null = null;
  let metaEl: HTMLElement | null = null;
  let noteEl: HTMLElement | null = null;
  let removeKeydown: (() => void) | null = null;
  let forgetScopeClose: (() => void) | null = null;
  let restoreFocus: HTMLElement | null = null;

  function close() {
    if (!overlay) return;
    removeKeydown?.();
    removeKeydown = null;
    forgetScopeClose?.();
    forgetScopeClose = null;
    overlay.remove();
    overlay = body = titleEl = metaEl = noteEl = null;
    document.documentElement.classList.remove("sfp-tc-open");
    const target = restoreFocus;
    restoreFocus = null;
    if (target?.isConnected) target.focus();
  }

  function ensureShell() {
    if (overlay) return;
    restoreFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    overlay = document.createElement("div");
    overlay.className = "sfp-tc-overlay";
    overlay.innerHTML = `
      <div class="sfp-tc-dialog" role="dialog" aria-modal="true" aria-labelledby="sfp-tc-title">
        <header class="sfp-tc-head">
          <div class="sfp-tc-heading">
            <div class="sfp-tc-title" id="sfp-tc-title" dir="auto"></div>
            <div class="sfp-tc-meta"></div>
          </div>
          <button type="button" class="sfp-tc-close" title="${escapeAttr(t("close"))}" aria-label="${escapeAttr(t("close"))}">×</button>
        </header>
        <div class="sfp-tc-body" tabindex="0"></div>
        <footer class="sfp-tc-note"></footer>
      </div>`;
    document.body.appendChild(overlay);
    document.documentElement.classList.add("sfp-tc-open");
    body = overlay.querySelector<HTMLElement>(".sfp-tc-body");
    titleEl = overlay.querySelector<HTMLElement>(".sfp-tc-title");
    metaEl = overlay.querySelector<HTMLElement>(".sfp-tc-meta");
    noteEl = overlay.querySelector<HTMLElement>(".sfp-tc-note");

    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) close();
    });
    overlay
      .querySelector(".sfp-tc-close")
      ?.addEventListener("click", () => close());
    removeKeydown = getScope().listen(document, "keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    });
    forgetScopeClose = getScope().defer(close);
    body?.focus();
  }

  function metaHtml(topic: Topic, content: TopicContent | null) {
    const parts: string[] = [];
    const category = categoryName(content?.categoryId ?? topic.category_id);
    if (category) parts.push(escapeHtml(category));
    const replies = Math.max(0, count(topic.posts_count) - 1);
    if (replies > 0)
      parts.push(escapeHtml(t("topicContentReplies", { count: replies })));
    if (topic.views)
      parts.push(
        escapeHtml(t("topicContentViews", { count: topic.views })),
      );
    const created = content?.createdAt || topic.created_at;
    const relative = created ? formatRelativeTime(created) : "";
    if (relative)
      parts.push(
        `<span title="${escapeAttr(absoluteTime(created))}">${escapeHtml(relative)}</span>`,
      );
    return parts.join('<span class="sfp-tc-sep">·</span>');
  }

  function postHtml(post: TopicContentPost) {
    const label = post.name && post.name !== post.username ? post.name : "";
    const username = post.username ? `@${post.username}` : "";
    const author = [label, username].filter(Boolean).join(" · ");
    const head: string[] = [];
    if (author)
      head.push(`<span class="sfp-tc-post-author">${escapeHtml(author)}</span>`);
    if (post.postNumber)
      head.push(
        `<span class="sfp-tc-post-number">#${Number(post.postNumber)}</span>`,
      );
    const relative = post.createdAt
      ? formatRelativeTime(post.createdAt)
      : "";
    if (relative)
      head.push(
        `<time title="${escapeAttr(absoluteTime(post.createdAt))}">${escapeHtml(relative)}</time>`,
      );
    const cooked = post.cooked ? sanitizeCooked(post.cooked) : "";
    const header = head.length
      ? `<header class="sfp-tc-post-head">${head.join("")}</header>`
      : "";
    const content = cooked
      ? `<div class="sfp-tc-cooked" dir="auto">${cooked}</div>`
      : "";
    return `<article class="sfp-tc-post">${header}${content}</article>`;
  }

  function render(topic: Topic, content: TopicContent | null) {
    if (!overlay || !body || !titleEl || !metaEl || !noteEl) return;
    const title = selectTopicTitle(topic) || content?.title || t("topicContentTitle");
    titleEl.textContent = decodeHtmlEntities(title);
    metaEl.innerHTML = metaHtml(topic, content);

    // 只渲染真正带正文的楼层；没有正文的条目停在快照/空态。
    const posts = (content?.posts || []).filter((post) => !!post.cooked);
    const chunks = posts.map(postHtml);
    if (chunks.length === 0 && content?.excerpt) {
      chunks.push(
        `<p class="sfp-tc-excerpt" dir="auto">${escapeHtml(content.excerpt)}</p>`,
      );
    }
    if (chunks.length === 0) {
      chunks.push(
        `<p class="sfp-tc-empty">${escapeHtml(t("topicContentEmpty"))}</p>`,
      );
    }
    body.innerHTML = chunks.join("");
    body.scrollTop = 0;
    noteEl.textContent =
      posts.length > 0
        ? t("topicContentSource")
        : content?.excerpt
          ? t("topicContentSnapshot")
          : t("topicContentNoBody");
  }

  return {
    open(topic, content) {
      ensureShell();
      render(topic, content);
    },
    close,
  };
}
