import { describe, expect, it } from "vitest";
import {
  createReadLaterStore,
  extractPreview,
  parseReadLaterLink,
  readLaterFallbackTitle,
  READ_LATER_HEIGHT_STORAGE_KEY,
  READ_LATER_STORAGE_KEY,
  type ReadLaterItem,
  type ReadLaterStorage,
} from "../../src/read-later";

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
  it("appends new items and moves duplicates to the end", () => {
    const storage = fakeStorage();
    const store = createReadLaterStore({ storage, origin: ORIGIN });
    store.add(item("/a"));
    store.add(item("/b"));
    store.add(item("/a", { title: "again" }));
    expect(store.items().map((entry) => entry.url)).toEqual(["/b", "/a"]);
    expect(store.items()[1].title).toBe("again");
  });

  it("drops the oldest entry past the limit", () => {
    const storage = fakeStorage();
    const store = createReadLaterStore({ storage, origin: ORIGIN, limit: 2 });
    store.add(item("/a"));
    store.add(item("/b"));
    store.add(item("/c"));
    expect(store.items().map((entry) => entry.url)).toEqual(["/b", "/c"]);
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
    for (const raw of ["not json", "{}", '{"version":2,"items":[]}', '{"version":1}']) {
      const store = createReadLaterStore({
        storage: fakeStorage({ [READ_LATER_STORAGE_KEY]: raw }),
        origin: ORIGIN,
      });
      expect(store.items()).toEqual([]);
    }
  });

  it("drops entries that are cross-origin or malformed", () => {
    const payload = JSON.stringify({
      version: 1,
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

describe("extractPreview", () => {
  // 用最小的假节点树代替 DOMParser：所有节点共用一张选择器表，
  // 这样 `box.querySelector("img")` 与 `root.querySelector("aside")` 都能命中。
  type Stub = {
    textContent: string;
    getAttribute(name: string): string | null;
    querySelector(selector: string): Stub | null;
  };
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
        aside: {},
        ".quote-title__text-content a": { text: "  A   title  " },
        blockquote: { text: "first post excerpt" },
        ".badge-category__name": { text: "Dev" },
      }),
      ORIGIN,
    );
    expect(preview).toEqual({
      title: "A title",
      excerpt: "first post excerpt",
      badge: "Dev",
      imageUrl: undefined,
    });
  });

  it("reads the image and resolves it against the origin", () => {
    const preview = extractPreview(
      makeRoot({ aside: {}, img: { src: "/uploads/a.png" }, a: { text: "T" } }),
      ORIGIN,
    );
    expect(preview.imageUrl).toBe(`${ORIGIN}/uploads/a.png`);
  });

  it("falls back to the plain anchor form and rejects javascript images", () => {
    const preview = extractPreview(
      makeRoot({
        a: { text: "https://forum.example/about" },
        img: { src: "javascript:alert(1)" },
      }),
      ORIGIN,
    );
    expect(preview.imageUrl).toBeUndefined();
    expect(preview.title).toBe("https://forum.example/about");
  });

  it("truncates long excerpts", () => {
    const preview = extractPreview(
      makeRoot({ aside: {}, a: { text: "T" }, blockquote: { text: "x".repeat(400) } }),
      ORIGIN,
    );
    expect(preview.excerpt?.length).toBe(200);
    expect(preview.excerpt?.endsWith("…")).toBe(true);
  });

  it("returns nothing when the payload has no usable card", () => {
    expect(extractPreview(makeRoot({}), ORIGIN)).toEqual({});
  });
});
