import { READ_LATER_EXCERPT_MAX, READ_LATER_LIMIT } from "./constants";
import type { Topic, TopicTag, TopicUser } from "./feed/types";

/**
 * 稍后再读的纯数据层：链接解析、持久化与预览字段抽取。
 * 这里不碰 DOM 之外的东西（`extractPreview` 只读传入的节点树），也不发请求。
 */

export const READ_LATER_STORAGE_KEY = "sfp_read_later_v1";
export const READ_LATER_HEIGHT_STORAGE_KEY = "sfp_read_later_height_v1";
/**
 * 2 = 最新条目排在最前（`items[0]` 是最新加入的）。
 * v1 存的是加入顺序（旧 → 新），读取时整体反转一次，索引与视觉顺序从此一致。
 */
export const READ_LATER_VERSION = 2;

export interface ReadLaterPreview {
  title?: string;
  excerpt?: string;
  imageUrl?: string;
  badge?: string;
}

export interface ReadLaterItem {
  /** pathname + search + hash，同源相对地址。 */
  url: string;
  title: string;
  kind: "topic" | "link";
  topicId?: number;
  addedAt: number;
  topic?: Topic;
  user?: TopicUser;
  preview?: ReadLaterPreview;
}

export interface ParsedReadLaterLink {
  url: string;
  kind: "topic" | "link";
  topicId?: number;
}

function collapse(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value: string, max: number) {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}

/**
 * 只接受同源 http(s) 链接；`/t/<id>`、`/t/<slug>/<id>`、`/t/<id>/<post>`
 * 都归为话题，其余本站路径按普通链接处理。存储值统一成 pathname + search + hash。
 */
export function parseReadLaterLink(
  raw: string,
  origin: string,
): ParsedReadLaterLink | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value, `${origin}/`);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (!/^https?:$/.test(url.protocol)) return null;

  const path = url.pathname;
  // 首页（含纯锚点）不当作可保存的链接；带查询的首页（搜索结果）仍允许。
  if (path === "/" && !url.search) return null;

  let topicId: number | undefined;
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "t" && segments.length >= 2) {
    const first = Number(segments[1]);
    if (Number.isInteger(first) && first > 0) {
      topicId = first;
    } else {
      const second = Number(segments[2]);
      if (Number.isInteger(second) && second > 0) topicId = second;
    }
  }

  const relative = `${path}${url.search}${url.hash}`;
  return topicId
    ? { url: relative, kind: "topic", topicId }
    : { url: relative, kind: "link" };
}

/** 拖拽拿不到标题时的兜底：用路径最后一段。 */
export function readLaterFallbackTitle(url: string) {
  const path = String(url || "").split(/[?#]/)[0];
  const segments = path.split("/").filter(Boolean);
  return segments.length ? decodeURIComponent(segments[segments.length - 1]) : url;
}

function validTopic(value: unknown): Topic | undefined {
  if (!value || typeof value !== "object") return undefined;
  const topic = value as Topic;
  return Number.isFinite(topic.id) ? topic : undefined;
}

function validUser(value: unknown): TopicUser | undefined {
  if (!value || typeof value !== "object") return undefined;
  const user = value as TopicUser;
  return Number.isFinite(user.id) ? user : undefined;
}

function validPreview(value: unknown): ReadLaterPreview | undefined {
  if (!value || typeof value !== "object") return undefined;
  const preview = value as ReadLaterPreview;
  const result: ReadLaterPreview = {};
  if (typeof preview.title === "string" && preview.title) {
    result.title = preview.title;
  }
  if (typeof preview.excerpt === "string" && preview.excerpt) {
    result.excerpt = preview.excerpt;
  }
  if (typeof preview.badge === "string" && preview.badge) {
    result.badge = preview.badge;
  }
  // 图片地址在写入时已解析成绝对地址；这里再挡一次 javascript:/data:。
  if (typeof preview.imageUrl === "string" && /^https?:\/\//i.test(preview.imageUrl)) {
    result.imageUrl = preview.imageUrl;
  }
  return Object.keys(result).length ? result : undefined;
}

function normalizeItem(value: unknown, origin: string): ReadLaterItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ReadLaterItem>;
  if (typeof raw.url !== "string") return null;
  const parsed = parseReadLaterLink(raw.url, origin);
  if (!parsed) return null;
  const addedAt = Number(raw.addedAt);
  if (!Number.isFinite(addedAt)) return null;

  return {
    url: parsed.url,
    kind: parsed.kind,
    topicId: parsed.topicId,
    addedAt,
    title: typeof raw.title === "string" ? raw.title : "",
    topic: validTopic(raw.topic),
    user: validUser(raw.user),
    preview: validPreview(raw.preview),
  };
}

export interface ReadLaterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 隐私模式或配额耗尽时 `localStorage` 会直接抛错；退化成内存实现，本次会话仍可用。 */
export function resolveReadLaterStorage(): ReadLaterStorage {
  try {
    const probe = "__sfp_read_later_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
}

export function createReadLaterStore({
  storage,
  origin,
  now = () => Date.now(),
  limit = READ_LATER_LIMIT,
}: {
  storage: ReadLaterStorage;
  origin: string;
  now?: () => number;
  limit?: number;
}) {
  let memoryOnly = false;
  let items: ReadLaterItem[] = [];
  let height: number | null = null;

  function readItems(): ReadLaterItem[] {
    let raw: string | null = null;
    try {
      raw = storage.getItem(READ_LATER_STORAGE_KEY);
    } catch {
      memoryOnly = true;
      return [];
    }
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    const file = parsed as { version?: number; items?: unknown };
    if (!file || typeof file !== "object") return [];
    const legacy = file.version === 1;
    if (!legacy && file.version !== READ_LATER_VERSION) return [];
    if (!Array.isArray(file.items)) return [];
    const result: ReadLaterItem[] = [];
    for (const entry of file.items) {
      const item = normalizeItem(entry, origin);
      if (item) result.push(item);
    }
    // v1 是「旧 → 新」，v2 是「新 → 旧」。
    if (legacy) result.reverse();
    return result.slice(0, limit);
  }

  function readHeight(): number | null {
    try {
      const raw = storage.getItem(READ_LATER_HEIGHT_STORAGE_KEY);
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  function writeItems(next: readonly ReadLaterItem[]) {
    if (memoryOnly) return next;
    const write = (list: readonly ReadLaterItem[]) =>
      storage.setItem(
        READ_LATER_STORAGE_KEY,
        JSON.stringify({ version: READ_LATER_VERSION, items: list }),
      );
    try {
      write(next);
      return next;
    } catch (error) {
      // 配额或隐私模式：丢最旧的一半重试一次，仍失败就只保留内存态。
      const trimmed = next.slice(0, Math.ceil(next.length / 2));
      try {
        write(trimmed);
        return trimmed;
      } catch {
        memoryOnly = true;
        console.warn("[SFP] read later storage unavailable:", error);
        return next;
      }
    }
  }

  items = readItems();
  height = readHeight();

  return {
    items: () => items,
    height: () => height,
    setHeight(value: number | null) {
      height = value;
      try {
        if (value === null) storage.removeItem(READ_LATER_HEIGHT_STORAGE_KEY);
        else storage.setItem(READ_LATER_HEIGHT_STORAGE_KEY, String(value));
      } catch (error) {
        console.warn("[SFP] read later height not persisted:", error);
      }
    },
    /**
     * 加入一条。已经存在的 URL 移到最新位置（用户再拖一次就是「再要一次」），
     * 但**合并**而不是覆盖：新记录缺 `preview`/`topic`/`user` 时保留旧值。
     * 覆盖会顺手把预览和话题快照抹掉，而这次拖动并不携带它们。
     */
    add(item: Omit<ReadLaterItem, "addedAt"> & { addedAt?: number }) {
      const existing = items.find((entry) => entry.url === item.url);
      const entry: ReadLaterItem = {
        ...existing,
        ...item,
        addedAt: item.addedAt ?? now(),
        preview: item.preview ?? existing?.preview,
        topic: item.topic ?? existing?.topic,
        user: item.user ?? existing?.user,
      };
      const rest = items.filter((other) => other.url !== item.url);
      items = writeItems([entry, ...rest].slice(0, limit)) as ReadLaterItem[];
      return items;
    },
    /** 把某条移到 `toIndex`（结果数组里的下标），用于拖动排序。 */
    move(url: string, toIndex: number) {
      const from = items.findIndex((item) => item.url === url);
      if (from < 0) return items;
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      const target = Math.max(0, Math.min(toIndex, next.length));
      next.splice(target, 0, moved);
      items = writeItems(next) as ReadLaterItem[];
      return items;
    },
    remove(url: string) {
      items = writeItems(items.filter((item) => item.url !== url)) as ReadLaterItem[];
      return items;
    },
    update(next: readonly ReadLaterItem[]) {
      items = writeItems(next.slice(0, limit)) as ReadLaterItem[];
      return items;
    },
    reload() {
      items = readItems();
      height = readHeight();
      return items;
    },
  };
}

/**
 * 用一轮**已经取到**的话题覆盖条目快照：不发请求，也不动预览。
 * 响应里没有的话题原样保留（静默刷新没取到的内容无从更新）；
 * 一条都没命中时返回 `null`，让调用方跳过写入与重渲染。
 */
export function mergeTopicSnapshot(
  items: readonly ReadLaterItem[],
  topics: readonly Topic[],
  users: readonly TopicUser[],
  selectTitle: (topic: Topic) => string,
): ReadLaterItem[] | null {
  if (!items.length || !topics.length) return null;
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const userById = new Map(users.map((user) => [user.id, user]));
  let changed = false;
  const next = items.map((item) => {
    const fresh = item.topicId === undefined ? undefined : byId.get(item.topicId);
    if (!fresh) return item;
    changed = true;
    const posterId = fresh.posters?.[0]?.user_id;
    return {
      ...item,
      topic: fresh,
      user: (posterId === undefined ? undefined : userById.get(posterId)) || item.user,
      title: selectTitle(fresh) || item.title,
    };
  });
  return changed ? next : null;
}

function cleanText(value: string | null | undefined) {
  return collapse(value);
}

function textOf(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numOf(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * `/t/<id>.json`（TopicView）→ 列表项用的紧凑快照。
 *
 * 稍后再读里的话题可能落在静音分类、未列出或私密范围：`/latest.json?topic_ids=`
 * 永远拿不回来（`TopicQuery#remove_muted_categories` 在 `topic_ids` 过滤之后
 * 又剔了一遍，见 `lib/topic_query.rb:1029`），而用户既然把它拖进来就是要看到它，
 * 所以这一条按 id 直接取。
 *
 * TopicView 比列表项多得多（整段 `post_stream`），这里只挑渲染用得到的字段，
 * 不保存原始 JSON。视图里没有 `bumped_at`/`posters`/`unread_posts`：
 * 时间退到 `last_posted_at`（渲染器本来就这么兜底），首个 poster 从
 * `details.created_by` 重建，未读计数不猜——拿不到就继续显示圆点。
 */
export function topicFromView(
  value: unknown,
): { topic: Topic; user?: TopicUser } | null {
  if (!value || typeof value !== "object") return null;
  const view = value as {
    id?: unknown;
    slug?: unknown;
    title?: unknown;
    fancy_title?: unknown;
    category_id?: unknown;
    archetype?: unknown;
    closed?: unknown;
    pinned?: unknown;
    pinned_globally?: unknown;
    created_at?: unknown;
    last_posted_at?: unknown;
    views?: unknown;
    posts_count?: unknown;
    like_count?: unknown;
    last_read_post_number?: unknown;
    highest_post_number?: unknown;
    tags?: unknown;
    details?: { created_by?: Record<string, unknown> };
    post_stream?: { posts?: Array<Record<string, unknown>> };
  };
  const id = numOf(view.id);
  if (!id || id <= 0) return null;

  const createdBy = view.details?.created_by;
  const firstPost = view.post_stream?.posts?.[0];
  const rawUser = createdBy || firstPost;
  const userId = numOf(createdBy?.id ?? firstPost?.user_id);
  const user: TopicUser | undefined =
    userId === undefined
      ? undefined
      : {
          id: userId,
          username: textOf(rawUser?.username),
          name: textOf(rawUser?.name),
          avatar_template: textOf(rawUser?.avatar_template),
        };

  const topic: Topic = {
    id,
    slug: textOf(view.slug),
    title: textOf(view.title),
    fancy_title: textOf(view.fancy_title),
    category_id: numOf(view.category_id),
    archetype: textOf(view.archetype),
    created_at: textOf(view.created_at),
    last_posted_at: textOf(view.last_posted_at),
    views: numOf(view.views),
    posts_count: numOf(view.posts_count),
    like_count: numOf(view.like_count),
    last_read_post_number: numOf(view.last_read_post_number) ?? null,
    highest_post_number: numOf(view.highest_post_number),
    closed: view.closed === true || undefined,
    pinned: view.pinned === true || undefined,
    pinned_globally: view.pinned_globally === true || undefined,
    tags: Array.isArray(view.tags)
      ? (view.tags as Array<string | TopicTag>).filter(
          (tag) => typeof tag === "string" || (!!tag && typeof tag === "object"),
        )
      : undefined,
    // 让既有的合并逻辑能从 posters 找回首个 poster，不必为这条路径另写一套。
    posters: user ? [{ user_id: user.id }] : undefined,
  };
  return { topic, user };
}

/**
 * 从 `/onebox` 返回的片段里抽字段。只读不写，也不保存 HTML。
 * `origin` 用于把相对图片地址解析成绝对地址（DOMParser 的 baseURI 不可靠）。
 *
 * **200 不等于成功**：`Oneboxer.local_onebox` 在本地模板拿不到内容时返回
 * `<a href='url'>url</a>`（`lib/oneboxer.rb:328`），控制器只判 `preview.blank?`，
 * 所以这种兜底也是 200。编辑器把它当作失败（`prosemirror/extensions/onebox.js:694`
 * 的正则），提示「无法加载预览」。我们照同一条线判：拿不到 onebox 容器就算失败。
 */
export function extractPreview(
  root: ParentNode,
  origin: string,
): ReadLaterPreview {
  // 本站模板给 `aside.onebox` / `aside.quote`，外站给 `div.onebox`；
  // 只有纯 `<a href="url">url</a>` 兜底时两个都命中不了。
  const box = root.querySelector("aside, .onebox");
  if (!box) return {};

  const image = box.querySelector("img");
  const rawImage = image?.getAttribute("src") || "";
  let imageUrl: string | undefined;
  if (rawImage) {
    try {
      const absolute = new URL(rawImage, `${origin}/`).href;
      if (/^https?:\/\//i.test(absolute)) imageUrl = absolute;
    } catch {
      imageUrl = undefined;
    }
  }

  const titleEl =
    box.querySelector(".quote-title__text-content a") ||
    box.querySelector(".onebox-body h3 a") ||
    box.querySelector("a");
  const excerptEl =
    box.querySelector("blockquote") ||
    box.querySelector(".onebox-body p") ||
    box.querySelector(".description p");
  const badgeEl = box.querySelector(".badge-category__name");

  const preview: ReadLaterPreview = {
    title: cleanText(titleEl?.textContent) || undefined,
    excerpt:
      truncateText(cleanText(excerptEl?.textContent), READ_LATER_EXCERPT_MAX) ||
      undefined,
    imageUrl,
    badge: cleanText(badgeEl?.textContent) || undefined,
  };
  if (!preview.title && !preview.excerpt && !preview.imageUrl && !preview.badge) {
    return {};
  }
  return preview;
}

/**
 * `/onebox` 失败后的回退：读目标页自己的 OG 标签。
 *
 * 只在同站链接上用——Discourse 的 `<head>` 由服务端渲染，`og:title`、
 * `og:description`、`og:image` 都在里面（`meta-tag-updater.js` 只是在前端
 * 路由切换时更新它们）。实测 linux.do：head 约 53 KB、整页约 795 KB，
 * 只解析 head 约 1 ms，所以真正的代价是那一次网络请求，不是解析。
 */
export function extractOpenGraph(
  root: ParentNode,
  origin: string,
): ReadLaterPreview {
  const meta = (property: string) => {
    const node = root.querySelector(`meta[property="${property}"]`);
    return cleanText(node?.getAttribute("content"));
  };

  const rawImage = meta("og:image");
  let imageUrl: string | undefined;
  if (rawImage) {
    try {
      const absolute = new URL(rawImage, `${origin}/`).href;
      if (/^https?:\/\//i.test(absolute)) imageUrl = absolute;
    } catch {
      imageUrl = undefined;
    }
  }

  const preview: ReadLaterPreview = {
    title: meta("og:title") || cleanText(root.querySelector("title")?.textContent) || undefined,
    excerpt: truncateText(meta("og:description"), READ_LATER_EXCERPT_MAX) || undefined,
    imageUrl,
  };
  if (!preview.title && !preview.excerpt && !preview.imageUrl) return {};
  return preview;
}
