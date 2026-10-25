import { describe, expect, it } from "vitest";
import {
  createReadLaterStore,
  extractOpenGraph,
  extractPreview,
  mergeTopicSnapshot,
  parseReadLaterLink,
  readLaterFallbackTitle,
  READ_LATER_HEIGHT_STORAGE_KEY,
  READ_LATER_STORAGE_KEY,
  topicFromView,
  type ReadLaterItem,
  type ReadLaterStorage,
} from "../../src/read-later";
import type { Topic } from "../../src/feed/types";

const ORIGIN = "https://forum.example";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: ReadLaterStorage & { map: Map<string, string> } = {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  return storage;
}

function item(url: string, overrides: Partial<ReadLaterItem> = {}): ReadLaterItem {
  return { url, title: url, kind: "link", addedAt: 1, ...overrides };
}

describe("parseReadLaterLink", () => {
  it("classifies same-site topic URLs in every shape", () => {
    expect(parseReadLaterLink("/t/123", ORIGIN)).toEqual({
      url: "/t/123",
      kind: "topic",
      topicId: 123,
    });
    expect(parseReadLaterLink(`${ORIGIN}/t/slug/123`, ORIGIN)).toEqual({
      url: "/t/slug/123",
      kind: "topic",
      topicId: 123,
    });
    expect(parseReadLaterLink("/t/slug/123/5", ORIGIN)).toEqual({
      url: "/t/slug/123/5",
      kind: "topic",
      topicId: 123,
    });
    expect(parseReadLaterLink("/t/123/5", ORIGIN)).toEqual({
      url: "/t/123/5",
      kind: "topic",
      topicId: 123,
    });
    expect(parseReadLaterLink("/t/123?u=name", ORIGIN)?.url).toBe("/t/123?u=name");
  });

  it("treats other same-site paths as plain links", () => {
    for (const path of ["/u/name", "/c/cat/3", "/about", "/t/slug/notanid"]) {
      expect(parseReadLaterLink(path, ORIGIN)).toEqual({ url: path, kind: "link" });
    }
  });

  it("rejects cross-origin, non-http and empty links", () => {
    expect(parseReadLaterLink("https://elsewhere.example/t/1", ORIGIN)).toBeNull();
    expect(parseReadLaterLink("javascript:alert(1)", ORIGIN)).toBeNull();
    expect(parseReadLaterLink("#fragment", ORIGIN)).toBeNull();
    expect(parseReadLaterLink("", ORIGIN)).toBeNull();
    expect(parseReadLaterLink("   ", ORIGIN)).toBeNull();
    expect(parseReadLaterLink("/", ORIGIN)).toBeNull();
    expect(parseReadLaterLink("http://[", ORIGIN)).toBeNull();
  });
});

describe("readLaterFallbackTitle", () => {
  it("uses the last path segment without query or hash", () => {
    expect(readLaterFallbackTitle("/t/slug/123/5?u=x#post")).toBe("5");
    expect(readLaterFallbackTitle("/u/name")).toBe("name");
    expect(readLaterFallbackTitle("/a%20b")).toBe("a b");
  });
});

describe("createReadLaterStore", () => {
  it("keeps the newest entry first and moves a duplicate to the front", () => {
    const storage = fakeStorage();
    const store = createReadLaterStore({ storage, origin: ORIGIN });
    store.add(item("/a", { preview: { title: "A preview" } }));
    store.add(item("/b"));
    expect(store.items().map((entry) => entry.url)).toEqual(["/b", "/a"]);
    // 再拖一次 = 移到最新位置；新记录没带 preview，必须保留旧的。
    store.add(item("/a", { title: "again" }));
    expect(store.items().map((entry) => entry.url)).toEqual(["/a", "/b"]);
    expect(store.items()[0].title).toBe("again");
    expect(store.items()[0].preview?.title).toBe("A preview");
  });

  it("drops the oldest entry past the limit", () => {
    const storage = fakeStorage();
    const store = createReadLaterStore({ storage, origin: ORIGIN, limit: 2 });
    store.add(item("/a"));
    store.add(item("/b"));
    store.add(item("/c"));
    expect(store.items().map((entry) => entry.url)).toEqual(["/c", "/b"]);
  });

  it("reorders items and persists the new order", () => {
    const storage = fakeStorage();
    const store = createReadLaterStore({ storage, origin: ORIGIN });
    store.add(item("/a"));
    store.add(item("/b"));
    store.add(item("/c"));
    expect(store.items().map((entry) => entry.url)).toEqual(["/c", "/b", "/a"]);
    store.move("/a", 0);
    expect(store.items().map((entry) => entry.url)).toEqual(["/a", "/c", "/b"]);
    expect(
      createReadLaterStore({ storage, origin: ORIGIN }).items().map((entry) => entry.url),
    ).toEqual(["/a", "/c", "/b"]);
    // 越界下标被钳住，未知 url 不动。
    store.move("/b", 99);
    expect(store.items().map((entry) => entry.url)).toEqual(["/a", "/c", "/b"]);
    store.move("/nope", 0);
    expect(store.items().map((entry) => entry.url)).toEqual(["/a", "/c", "/b"]);
  });

  it("removes items and persists the rest", () => {
    const storage = fakeStorage();
    const store = createReadLaterStore({ storage, origin: ORIGIN });
    store.add(item("/a"));
    store.add(item("/b"));
    store.remove("/a");
    expect(store.items().map((entry) => entry.url)).toEqual(["/b"]);
    const reloaded = createReadLaterStore({ storage, origin: ORIGIN });
    expect(reloaded.items().map((entry) => entry.url)).toEqual(["/b"]);
  });

  it("drops corrupt payloads and unknown versions", () => {
    for (const raw of ["not json", "{}", '{"version":3,"items":[]}', '{"version":1}']) {
      const store = createReadLaterStore({
        storage: fakeStorage({ [READ_LATER_STORAGE_KEY]: raw }),
        origin: ORIGIN,
      });
      expect(store.items()).toEqual([]);
    }
  });

  it("reads v1 payloads oldest-first and flips them to newest-first", () => {
    const payload = JSON.stringify({
      version: 1,
      items: [
        { url: "/old", kind: "link", addedAt: 1 },
        { url: "/new", kind: "link", addedAt: 2 },
      ],
    });
    const store = createReadLaterStore({
      storage: fakeStorage({ [READ_LATER_STORAGE_KEY]: payload }),
      origin: ORIGIN,
    });
    expect(store.items().map((entry) => entry.url)).toEqual(["/new", "/old"]);
  });

  it("drops entries that are cross-origin or malformed", () => {
    const payload = JSON.stringify({
      version: 2,
      items: [
        { url: "/keep", title: "keep", kind: "link", addedAt: 1 },
        { url: "https://elsewhere.example/x", title: "x", kind: "link", addedAt: 1 },
        { url: "javascript:alert(1)", title: "x", kind: "link", addedAt: 1 },
        { url: "/no-date", title: "x", kind: "link" },
        { url: "/no-title", kind: "link", addedAt: 2 },
        { url: "/bad-preview", kind: "link", addedAt: 3, preview: { imageUrl: "javascript:alert(1)" } },
      ],
    });
    const store = createReadLaterStore({
      storage: fakeStorage({ [READ_LATER_STORAGE_KEY]: payload }),
      origin: ORIGIN,
    });
    expect(store.items().map((entry) => entry.url)).toEqual([
      "/keep",
      "/no-title",
      "/bad-preview",
    ]);
    expect(store.items()[2].preview).toBeUndefined();
  });

  it("persists the height and treats a missing value as never dragged", () => {
    const storage = fakeStorage();
    const store = createReadLaterStore({ storage, origin: ORIGIN });
    expect(store.height()).toBeNull();
    store.setHeight(180);
    expect(storage.getItem(READ_LATER_HEIGHT_STORAGE_KEY)).toBe("180");
    expect(createReadLaterStore({ storage, origin: ORIGIN }).height()).toBe(180);
    store.setHeight(null);
    expect(storage.getItem(READ_LATER_HEIGHT_STORAGE_KEY)).toBeNull();
  });

  it("keeps working in memory when the quota rejects the write", () => {
    const storage = fakeStorage();
    let calls = 0;
    const original = storage.setItem;
    storage.setItem = (key, value) => {
      calls += 1;
      if (calls <= 2) throw new Error("QuotaExceededError");
      original(key, value);
    };
    const store = createReadLaterStore({ storage, origin: ORIGIN });
    store.add(item("/a"));
    store.add(item("/b"));
    expect(store.items().length).toBeGreaterThan(0);
  });
});

describe("mergeTopicSnapshot", () => {
  const title = (topic: Topic) => topic.fancy_title || topic.title || "";

  it("overwrites only the topics present in the response", () => {
    const items = [
      item("/t/a/1", { kind: "topic", topicId: 1, topic: { id: 1, title: "old" } }),
      item("/t/b/2", { kind: "topic", topicId: 2, topic: { id: 2, title: "keep" } }),
    ];
    const next = mergeTopicSnapshot(
      items,
      [{ id: 1, title: "new", unread_posts: 3, posters: [{ user_id: 7 }] }],
      [{ id: 7, username: "poster" }],
      title,
    );
    expect(next).not.toBeNull();
    expect(next?.[0].title).toBe("new");
    expect(next?.[0].topic?.unread_posts).toBe(3);
    expect(next?.[0].user?.username).toBe("poster");
    // 这一轮没取到的话题保持原样，连对象引用都不换。
    expect(next?.[1]).toBe(items[1]);
  });

  it("returns null when nothing matched or the batch is empty", () => {
    const items = [item("/t/a/1", { kind: "topic", topicId: 1 })];
    expect(mergeTopicSnapshot(items, [{ id: 9 }], [], title)).toBeNull();
    expect(mergeTopicSnapshot(items, [], [], title)).toBeNull();
    expect(mergeTopicSnapshot([], [{ id: 1 }], [], title)).toBeNull();
  });
});

// 用最小的假节点树代替 DOMParser：所有节点共用一张选择器表，// 这样 `box.querySelector("img")` 与 `root.querySelector("aside")` 都能命中。
type Stub = {
  textContent: string;
  getAttribute(name: string): string | null;
  querySelector(selector: string): Stub | null;
};

describe("extractPreview", () => {
  function makeRoot(table: Record<string, { text?: string; src?: string }>) {
    const nodes = new Map<string, Stub>();
    const lookup = (selector: string) => nodes.get(selector) ?? null;
    for (const [selector, spec] of Object.entries(table)) {
      nodes.set(selector, {
        textContent: spec.text ?? "",
        getAttribute: (name) => (name === "src" ? (spec.src ?? null) : null),
        querySelector: lookup,
      });
    }
    return { querySelector: lookup } as unknown as ParentNode;
  }

  it("reads the topic onebox card", () => {
    const preview = extractPreview(
      makeRoot({
        "aside, .onebox": {},
        ".quote-title__text-content a": { text: "  A   title  " },
        blockquote: { text: "first post excerpt" },
      }),
      ORIGIN,
    );
    expect(preview).toEqual({
      title: "A title",
      excerpt: "first post excerpt",
      imageUrl: undefined,
    });
  });

  it("reads a category card without repeating its name as a badge", () => {
    // 分类卡片的标题就是分类名（`discourse_category_onebox.mustache:6-11`），
    // 所以 `.badge-category__name` 不取，否则同一行会显示两遍。
    const preview = extractPreview(
      makeRoot({
        "aside, .onebox": {},
        ".onebox-body h3 a": { text: "运营反馈" },
        ".badge-category__name": { text: "运营反馈" },
        ".description p": { text: "有关此网站、其组织、运作方式以及如何改进的讨论。" },
      }),
      ORIGIN,
    );
    expect(preview).toEqual({
      title: "运营反馈",
      name: undefined,
      excerpt: "有关此网站、其组织、运作方式以及如何改进的讨论。",
      imageUrl: undefined,
    });
  });

  it("reads the image and resolves it against the origin", () => {
    const preview = extractPreview(
      makeRoot({
        "aside, .onebox": {},
        img: { src: "/uploads/a.png" },
        a: { text: "T" },
      }),
      ORIGIN,
    );
    expect(preview.imageUrl).toBe(`${ORIGIN}/uploads/a.png`);
  });

  it("rejects the bare-anchor fallback even though it arrives as 200", () => {
    // `lib/oneboxer.rb:328` 的兜底：`<a href='url'>url</a>`。编辑器同样把它当失败。
    const preview = extractPreview(
      makeRoot({
        a: { text: "https://forum.example/about" },
        img: { src: "javascript:alert(1)" },
      }),
      ORIGIN,
    );
    expect(preview).toEqual({});
  });

  it("keeps the user full name as its own field ahead of the title", () => {
    // 真站用户卡片（`lib/onebox/templates/discourse_user_onebox.mustache`）：
    // 标题只有 `@username`，姓名是 `span.full-name`，简介才是 `<p>`。
    const preview = extractPreview(
      makeRoot({
        "aside, .onebox": {},
        img: { src: "/user_avatar/forum.example/x/1_2.png" },
        ".onebox-body h3 a": { text: "@Cunningham520" },
        ".full-name": { text: " Reverse1999 " },
      }),
      ORIGIN,
    );
    expect(preview).toEqual({
      title: "@Cunningham520",
      name: "Reverse1999",
      excerpt: undefined,
      imageUrl: `${ORIGIN}/user_avatar/forum.example/x/1_2.png`,
    });
  });

  it("keeps the bio in the excerpt slot when the user has one", () => {
    const preview = extractPreview(
      makeRoot({
        "aside, .onebox": {},
        ".onebox-body h3 a": { text: "@x" },
        ".full-name": { text: "Full Name" },
        ".onebox-body p": { text: "just a bio" },
      }),
      ORIGIN,
    );
    expect(preview.name).toBe("Full Name");
    expect(preview.title).toBe("@x");
    expect(preview.excerpt).toBe("just a bio");
  });

  it("truncates long excerpts", () => {
    const preview = extractPreview(
      makeRoot({
        "aside, .onebox": {},
        a: { text: "T" },
        blockquote: { text: "x".repeat(400) },
      }),
      ORIGIN,
    );
    expect(preview.excerpt?.length).toBe(200);
    expect(preview.excerpt?.endsWith("…")).toBe(true);
  });

  it("returns nothing when the payload has no usable card", () => {
    expect(extractPreview(makeRoot({}), ORIGIN)).toEqual({});
  });
});

describe("extractOpenGraph", () => {
  // 同样用假节点树：`extractOpenGraph` 只查 `meta[property=...]` 与 `title`。
  function head(table: Record<string, { content?: string; text?: string }>) {
    const nodes = new Map<string, Stub>();
    const lookup = (selector: string) => nodes.get(selector) ?? null;
    for (const [selector, spec] of Object.entries(table)) {
      nodes.set(selector, {
        textContent: spec.text ?? "",
        getAttribute: (name) => (name === "content" ? (spec.content ?? null) : null),
        querySelector: lookup,
      });
    }
    return { querySelector: lookup } as unknown as ParentNode;
  }

  it("reads title, description and image from Open Graph tags", () => {
    const preview = extractOpenGraph(
      head({
        'meta[property="og:title"]': { content: "OG Title" },
        'meta[property="og:description"]': { content: "OG description" },
        'meta[property="og:image"]': { content: "/uploads/og.png" },
      }),
      ORIGIN,
    );
    expect(preview.title).toBe("OG Title");
    expect(preview.excerpt).toBe("OG description");
    expect(preview.imageUrl).toBe(`${ORIGIN}/uploads/og.png`);
  });

  it("falls back to the title element and truncates a long description", () => {
    const preview = extractOpenGraph(
      head({
        title: { text: "Plain Title" },
        'meta[property="og:description"]': { content: "x".repeat(300) },
      }),
      ORIGIN,
    );
    expect(preview.title).toBe("Plain Title");
    expect(preview.excerpt?.length).toBe(200);
  });

  it("drops non-http images and returns nothing when there is no metadata", () => {
    expect(
      extractOpenGraph(
        head({ 'meta[property="og:image"]': { content: "javascript:alert(1)" } }),
        ORIGIN,
      ),
    ).toEqual({});
    expect(extractOpenGraph(head({}), ORIGIN)).toEqual({});
  });
});

describe("topicFromView", () => {
  // `/t/<id>.json` 的真实形状（linux.do 实测）：没有 posters/bumped_at/
  // unread_posts，创建者与首楼在 details.created_by / post_stream.posts[0]。
  const view = {
    id: 3071354,
    slug: "topic",
    title: "想问个问题",
    fancy_title: "想问个问题",
    category_id: 45,
    archetype: "regular",
    closed: true,
    created_at: "2026-10-25T02:36:36.084Z",
    last_posted_at: "2026-10-25T02:36:36.221Z",
    views: 45,
    posts_count: 1,
    like_count: 1,
    last_read_post_number: 1,
    highest_post_number: 1,
    tags: [{ id: 1461, name: "纯水", slug: "1461-tag" }],
    details: {
      notification_level: 1,
      created_by: {
        id: 301746,
        username: "NTU17",
        name: "一只不会飞的猪",
        avatar_template: "/user_avatar/linux.do/ntu17/{size}/2237123_2.png",
      },
    },
    post_stream: { posts: [{ user_id: 301746, username: "NTU17" }] },
  };

  it("builds a list-item snapshot and its first poster", () => {
    const parsed = topicFromView(view);
    expect(parsed?.topic).toMatchObject({
      id: 3071354,
      slug: "topic",
      title: "想问个问题",
      category_id: 45,
      closed: true,
      views: 45,
      posts_count: 1,
      like_count: 1,
      last_read_post_number: 1,
      highest_post_number: 1,
      posters: [{ user_id: 301746 }],
    });
    expect(parsed?.user).toEqual({
      id: 301746,
      username: "NTU17",
      name: "一只不会飞的猪",
      avatar_template: "/user_avatar/linux.do/ntu17/{size}/2237123_2.png",
    });
    // 视图里没有 bumped_at，交给渲染器退到 last_posted_at；计数不猜。
    expect(parsed?.topic.bumped_at).toBeUndefined();
    expect(parsed?.topic.unread_posts).toBeUndefined();
    expect(parsed?.topic.notification_level).toBeUndefined();
  });

  it("falls back to the first post when details are missing", () => {
    const parsed = topicFromView({
      id: 7,
      post_stream: {
        posts: [
          {
            user_id: 5,
            username: "bob",
            avatar_template: "/user_avatar/x/bob/{size}/1.png",
          },
        ],
      },
    });
    expect(parsed?.user).toMatchObject({ id: 5, username: "bob" });
    expect(parsed?.topic.posters).toEqual([{ user_id: 5 }]);
  });

  it("rejects payloads without a usable id", () => {
    // 404 的响应体是 `{errors, error_type}`，不该被当成话题。
    expect(topicFromView({ errors: ["not found"] })).toBeNull();
    expect(topicFromView({ id: 0 })).toBeNull();
    expect(topicFromView({ id: "abc" })).toBeNull();
    expect(topicFromView(null)).toBeNull();
  });
});

