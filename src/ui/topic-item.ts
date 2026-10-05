import {
  _hasUnreadMarker,
  _isTopicRead,
  _topicListUrl,
} from "../feed/read-state";
import type { Topic, TopicTag, TopicUser } from "../feed/types";
import type { createI18n } from "../i18n";
import type { createDiscourseBridge } from "../platform/discourse";
import type { Lifetime } from "../platform/lifetime";
import { _normalizeHexColor, _safeCategoryStyleType } from "../site/appearance";
import type { createSiteData } from "../site/site-data";
import type { createTagStyles } from "../site/tag-styles";
import { closestTarget } from "./dom";
import { escapeAttr, escapeHtml } from "./html";
import { _svgIcon } from "./icons";
interface TopicRendererDependencies {
  t: ReturnType<typeof createI18n>["t"];
  formatRelativeTime: ReturnType<typeof createI18n>["formatRelativeTime"];
  site: ReturnType<typeof createSiteData>;
  tags: ReturnType<typeof createTagStyles>;
  discourse: ReturnType<typeof createDiscourseBridge>;
  getUser(id: number): TopicUser | undefined;
  markTopicAsRead(topic: Topic, item: HTMLElement): void;
  getScope(): Lifetime;
}

export function createTopicRenderer({
  t,
  formatRelativeTime,
  site,
  tags,
  discourse,
  getUser,
  markTopicAsRead,
  getScope,
}: TopicRendererDependencies) {
  const { _getCategoryMeta } = site;
  const { _tagDisplayName, _getTagStyle } = tags;
  const {
    toAbsoluteSiteUrl,
    getAvatarUrl,
    getUserProfileUrl,
    handlePointerNavigation,
  } = discourse;
  const topicHighlightTimers = new WeakMap<HTMLElement, number>();
  const setTimeout = (fn: () => void, delay: number) =>
    getScope().timeout(fn, delay);
  function _triggerTopicHighlight(item: HTMLElement) {
    if (!item) return;

    const oldTimer = topicHighlightTimers.get(item);
    if (oldTimer) getScope().clearTimeout(oldTimer);

    item.classList.remove("sfp-new-highlight");
    void item.offsetWidth;
    item.classList.add("sfp-new-highlight");

    const timer = setTimeout(() => {
      item.classList.remove("sfp-new-highlight");
      topicHighlightTimers.delete(item);
    }, 10000);
    topicHighlightTimers.set(item, timer);
  }

  function _topicStatsHtml(topic: Topic) {
    const replies = Math.max(0, (topic.posts_count || 1) - 1);
    const views =
      (topic.views || 0) >= 1000
        ? ((topic.views || 0) / 1000).toFixed(1) + "k"
        : topic.views || 0;
    const likes = topic.like_count || 0;
    return `
        <span class="sfp-topic-stat">${_svgIcon("comment")} ${replies}</span>
        <span class="sfp-topic-stat">${_svgIcon("far-eye")} ${views}</span>
        <span class="sfp-topic-stat">${_svgIcon("heart")} ${likes}</span>
      `;
  }

  function _topicStatusBadgesHtml(topic: Topic) {
    const statusBadges = [];
    if (topic.is_hot) {
      statusBadges.push(
        `<span class="topic-status-card --hot"><svg class="fa d-icon d-icon-fire svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire"></use></svg><p class="topic-status-card__name">${escapeHtml(t("hot"))}</p></span>`,
      );
    }
    if (topic.pinned || topic.pinned_globally) {
      statusBadges.push(
        `<span class="topic-status-card --pinned"><svg class="fa d-icon d-icon-thumbtack svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#thumbtack"></use></svg><p class="topic-status-card__name">${escapeHtml(t("pinned"))}</p></span>`,
      );
    }
    if (_isTopicUnavailable(topic)) {
      statusBadges.push(
        `<span class="topic-status-card --unavailable" title="${escapeAttr(t("topicUnavailableTip"))}">${_svgIcon("far-eye-slash")}<p class="topic-status-card__name">${escapeHtml(t("topicUnavailable"))}</p></span>`,
      );
    }
    return statusBadges.length
      ? `<span class="sfp-topic-status-badges">${statusBadges.join("")}</span>`
      : "";
  }

  function _topicTimeHtml(topic: Topic) {
    const timeStr = formatRelativeTime(
      topic.bumped_at || topic.last_posted_at || topic.created_at,
    );
    const unreadDotClass = _hasUnreadMarker(topic)
      ? "sfp-unread-dot"
      : "sfp-unread-dot sfp-unread-dot--hidden";
    const unreadDotHtml = `<span class="${unreadDotClass}" aria-hidden="true"></span>`;
    return `${timeStr}${unreadDotHtml}`;
  }

  function _isTopicUnavailable(topic: Topic) {
    return !!topic?.sfpUnavailable;
  }

  function _buildCategoryBadge(categoryId: number | undefined) {
    const meta = _getCategoryMeta(categoryId);
    if (!meta?.name) return "";

    const styleParts = [
      `--category-badge-color: #${_normalizeHexColor(meta.color, "888")}`,
      `--category-badge-text-color: #${_normalizeHexColor(meta.text_color, "FFFFFF")}`,
    ];
    if (meta.parent_category_id && meta.parent_color) {
      styleParts.push(
        `--parent-category-badge-color: #${_normalizeHexColor(meta.parent_color, "888")}`,
      );
      styleParts.push(
        `--parent-category-badge-text-color: #${_normalizeHexColor(meta.parent_text_color, "FFFFFF")}`,
      );
    }

    const styleType = _safeCategoryStyleType(meta.style_type, !!meta.icon);
    const categoryClasses = ["badge-category"];
    if (meta.read_restricted) categoryClasses.push("restricted");
    if (meta.parent_category_id) categoryClasses.push("--has-parent");
    categoryClasses.push(`--style-${styleType}`);

    const dataParent = meta.parent_category_id
      ? ` data-parent-category-id="${Number(meta.parent_category_id)}"`
      : "";
    const title = meta.description_text || meta.description_excerpt || "";
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    const iconHtml =
      styleType === "icon" && meta.icon ? _svgIcon(meta.icon) : "";
    const lockHtml = meta.read_restricted ? _svgIcon("lock") : "";

    return `<span class="badge-category__wrapper sfp-category-badge" style="${styleParts.join("; ")}"><span data-category-id="${Number(meta.id)}"${dataParent} data-drop-close="true" class="${categoryClasses.join(" ")}"${titleAttr}>${iconHtml}${lockHtml}<span class="badge-category__name" dir="auto">${escapeHtml(meta.name)}</span></span></span>`;
  }

  function _buildTagBadge(tag: string | TopicTag) {
    const tagName = _tagDisplayName(tag);
    if (!tagName) return "";

    const tagStyle = _getTagStyle(tag);
    const classes = ["discourse-tag", "box", "sfp-tag"];
    if (tagStyle?.hasIcon) classes.push("discourse-tag--tag-icons-style");
    const styleAttr = tagStyle?.cssText ? ` style="${tagStyle.cssText}"` : "";
    const iconHtml = tagStyle?.hasIcon
      ? `<span class="tag-icon">${_svgIcon(tagStyle.icon)}</span>`
      : "";

    return `<span class="${classes.join(" ")}"${styleAttr}>${iconHtml}${escapeHtml(tagName)}</span>`;
  }

  function createTopicItem(topic: Topic, isNew = false) {
    const item = document.createElement("a");
    const targetUrl = _topicListUrl(topic);
    item.className = "sfp-topic-item";
    item.href = toAbsoluteSiteUrl(targetUrl);
    item.dataset.topicId = String(topic.id);
    if (topic.pinned || topic.pinned_globally) {
      item.classList.add("sfp-pinned");
    }
    if (_isTopicRead(topic)) {
      item.classList.add("sfp-read");
    }
    if (_isTopicUnavailable(topic)) {
      item.classList.add("sfp-topic-unavailable");
    }
    if (isNew) {
      _triggerTopicHighlight(item);
    }

    // 获取用户信息
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
        if (user.avatar_template) {
          avatarUrl = getAvatarUrl(user.avatar_template, 45);
        }
      }
    }

    // 头像 HTML
    const avatarHtml =
      userProfileUrl && avatarUrl
        ? `<span class="sfp-topic-user-link sfp-topic-avatar-link" data-user-profile-url="${escapeAttr(userProfileUrl)}" data-user-profile-link="true"><img class="sfp-topic-avatar" src="${avatarUrl}" alt="${escapeHtml(username)}" loading="lazy"></span>`
        : avatarUrl
          ? `<img class="sfp-topic-avatar" src="${avatarUrl}" alt="${escapeHtml(username)}" loading="lazy">`
          : "";

    // 显示名称
    const displayName =
      name && name !== username
        ? userProfileUrl
          ? `<span class="sfp-topic-user-link sfp-topic-name" data-user-profile-url="${escapeAttr(userProfileUrl)}" data-user-profile-link="true">${escapeHtml(name)}</span>`
          : `<span class="sfp-topic-name">${escapeHtml(name)}</span>`
        : "";
    const usernameHtml = userProfileUrl
      ? `<span class="sfp-topic-user-link sfp-topic-username" data-user-profile-url="${escapeAttr(userProfileUrl)}" data-user-profile-link="true">${escapeHtml(username)}</span>`
      : `<span class="sfp-topic-username">${escapeHtml(username)}</span>`;

    const statusBadgesHtml = _topicStatusBadgesHtml(topic);

    // 标题
    const closedHtml = topic.closed
      ? `<span class="topic-statuses"><span title="${escapeAttr(t("closedTitle"))}" class="topic-status --closed"><svg class="fa d-icon d-icon-lock svg-icon fa-width-auto svg-string" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#lock"></use></svg></span></span>`
      : "";

    // 分类
    const categoryHtml = _buildCategoryBadge(topic.category_id);

    // 标签
    let tagsHtml = "";
    if (topic.tags && topic.tags.length > 0) {
      const tagItems = topic.tags
        .slice(0, 3)
        .map((tag) => {
          return _buildTagBadge(tag);
        })
        .join("");
      tagsHtml = `<span class="sfp-topic-tags">${tagItems}</span>`;
    }

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

    // 点击跳转
    item.addEventListener("click", (e) => {
      const profileLink = closestTarget(e, "[data-user-profile-link='true']");
      if (profileLink) {
        const profileUrl =
          profileLink.getAttribute("data-user-profile-url") || "";
        handlePointerNavigation(e, profileUrl);
        return;
      }
      handlePointerNavigation(e, targetUrl, {
        onPrimaryActivate: () => markTopicAsRead(topic, item),
      });
    });

    // 中键使用原生链接打开新标签页，同时保持本地已读状态同步。
    item.addEventListener("auxclick", (e) => {
      const profileLink = closestTarget(e, "[data-user-profile-link='true']");
      if (profileLink) {
        const profileUrl =
          profileLink.getAttribute("data-user-profile-url") || "";
        handlePointerNavigation(e, profileUrl);
        return;
      }
      handlePointerNavigation(e, targetUrl, {
        onMiddleActivate: () => markTopicAsRead(topic, item),
      });
    });

    return item;
  }

  return {
    createTopicItem,
    markRead(item: HTMLElement) {
      item.classList.add("sfp-read");
      item
        .querySelector(".sfp-unread-dot")
        ?.classList.add("sfp-unread-dot--hidden");
    },
  };
}
