import { TOPIC_CONTENT_CACHE_LIMIT, TOPIC_CONTENT_POST_LIMIT } from "../constants";
import type { Topic, TopicContent, TopicContentPost } from "./types";

/**
 * 异常话题的内容缓存。纯逻辑，不碰 DOM、不发请求。
 *
 * 异常话题在点击时往往已经无法再请求，所以内容必须在标记产生的那一刻
 * 从手里已有的数据写进缓存：列表快照提供标题与 `excerpt`，此前成功的
 * TopicView 提供完整 `post_stream.posts[].cooked`。
 */

function textOf(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numOf(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** `/t/<id>.json`（TopicView）→ 弹窗视图。没有帖子内容时仍返回标题等元数据。 */
export function topicContentFromView(value: unknown): TopicContent | null {
  if (!value || typeof value !== "object") return null;
  const view = value as {
    id?: unknown;
    title?: unknown;
    category_id?: unknown;
    created_at?: unknown;
    excerpt?: unknown;
    post_stream?: { posts?: Array<Record<string, unknown>> };
  };
  const id = numOf(view.id);
  if (!id || id <= 0) return null;

  const posts: TopicContentPost[] = [];
  const rawPosts = Array.isArray(view.post_stream?.posts)
    ? view.post_stream?.posts
    : [];
  for (const raw of rawPosts || []) {
    if (!raw || typeof raw !== "object") continue;
    const cooked = textOf(raw.cooked);
    const username = textOf(raw.username);
    const name = textOf(raw.name);
    if (!cooked && !username && !name) continue;
    posts.push({
      postNumber: numOf(raw.post_number),
      username,
      name,
      createdAt: textOf(raw.created_at),
      cooked,
    });
    if (posts.length >= TOPIC_CONTENT_POST_LIMIT) break;
  }

  return {
    id,
    title: textOf(view.title),
    categoryId: numOf(view.category_id),
    createdAt: textOf(view.created_at),
    excerpt: textOf(view.excerpt),
    posts,
  };
}

/**
 * 列表快照的回退视图：主列表消失检测只有列表字段，没有正文，
 * 至少把标题、分类、发布时间与 `excerpt` 留给弹窗。
 */
export function topicContentFromList(
  topic: Topic | null | undefined,
): TopicContent | null {
  const id = numOf(topic?.id);
  if (!id || id <= 0) return null;
  return {
    id,
    title: textOf(topic?.title),
    categoryId: numOf(topic?.category_id),
    createdAt: textOf(topic?.created_at),
    excerpt: textOf(topic?.excerpt),
    posts: [],
  };
}

/** 是否已经缓存到真正的正文；有正文时不再被列表快照覆盖。 */
export function hasTopicContent(
  content: TopicContent | null | undefined,
): content is TopicContent {
  return !!content && content.posts.some((post) => !!post.cooked);
}

/**
 * 异常标记产生时立刻把当时的话题快照写进缓存。
 * 已有正文（来自此前成功的 TopicView）时不覆盖；只有摘要的旧快照则可以被
 * 新一轮列表快照更新——这样点击时读到的就是标记那一刻能拿到的内容。
 */
export function cacheUnavailableSnapshot(
  cache: TopicContentCache,
  topic: Topic | null | undefined,
) {
  const id = Number(topic?.id);
  if (!Number.isFinite(id) || id <= 0) return false;
  if (hasTopicContent(cache.get(id))) return false;
  const content = topicContentFromList(topic);
  if (!content) return false;
  cache.set(content);
  return true;
}

/** 页内 LRU：面板关闭再打开仍可复用，页面刷新即失效。 */
export class TopicContentCache {
  private entries = new Map<number, TopicContent>();

  constructor(private readonly limit = TOPIC_CONTENT_CACHE_LIMIT) {}

  get(id: number) {
    const content = this.entries.get(id);
    if (!content) return undefined;
    this.entries.delete(id);
    this.entries.set(id, content);
    return content;
  }

  set(content: TopicContent | null | undefined) {
    if (!content || !Number.isFinite(content.id) || content.id <= 0) return;
    this.entries.delete(content.id);
    this.entries.set(content.id, content);
    while (this.entries.size > Math.max(1, this.limit)) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear() {
    this.entries.clear();
  }
}
