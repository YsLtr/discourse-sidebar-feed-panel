import { describe, expect, it } from "vitest";
import { TOPIC_CONTENT_POST_LIMIT } from "../../src/constants";
import {
  TopicContentCache,
  cacheUnavailableSnapshot,
  hasTopicContent,
  topicContentFromList,
  topicContentFromView,
} from "../../src/feed/topic-content";
import type { Topic } from "../../src/feed/types";

describe("topicContentFromView", () => {
  it("keeps the topic metadata and the post stream that a dialog can render", () => {
    expect(
      topicContentFromView({
        id: 42,
        title: "A topic",
        category_id: 7,
        created_at: "2026-10-05T00:00:00.000Z",
        post_stream: {
          posts: [
            {
              post_number: 1,
              username: "alice",
              name: "Alice",
              created_at: "2026-10-05T00:00:00.000Z",
              cooked: "<p>Hello</p>",
            },
            { post_number: 2, username: "bob", cooked: "<p>Reply</p>" },
          ],
        },
      }),
    ).toEqual({
      id: 42,
      title: "A topic",
      categoryId: 7,
      createdAt: "2026-10-05T00:00:00.000Z",
      excerpt: undefined,
      posts: [
        {
          postNumber: 1,
          username: "alice",
          name: "Alice",
          createdAt: "2026-10-05T00:00:00.000Z",
          cooked: "<p>Hello</p>",
        },
        {
          postNumber: 2,
          username: "bob",
          name: undefined,
          createdAt: undefined,
          cooked: "<p>Reply</p>",
        },
      ],
    });
  });

  it("caps the post stream and ignores malformed entries", () => {
    const posts = Array.from({ length: TOPIC_CONTENT_POST_LIMIT + 5 }, (_, i) => ({
      post_number: i + 1,
      username: `user-${i + 1}`,
      cooked: `<p>post ${i + 1}</p>`,
    }));
    const content = topicContentFromView({
      id: 5,
      post_stream: { posts: [null, {}, ...posts] },
    });
    expect(content?.posts).toHaveLength(TOPIC_CONTENT_POST_LIMIT);
    expect(content?.posts[0].postNumber).toBe(1);
    expect(content?.posts.at(-1)?.postNumber).toBe(TOPIC_CONTENT_POST_LIMIT);
  });

  it("returns null without a usable topic id", () => {
    expect(topicContentFromView(null)).toBeNull();
    expect(topicContentFromView({})).toBeNull();
    expect(topicContentFromView({ id: 0, post_stream: { posts: [] } })).toBeNull();
    expect(topicContentFromView({ id: "nope" })).toBeNull();
  });
});

describe("topicContentFromList", () => {
  it("keeps the list snapshot fields used by the fallback view", () => {
    const topic: Topic = {
      id: 9,
      title: "Vanished topic",
      excerpt: "first post excerpt",
      category_id: 3,
      created_at: "2026-10-01T00:00:00.000Z",
    };
    expect(topicContentFromList(topic)).toEqual({
      id: 9,
      title: "Vanished topic",
      categoryId: 3,
      createdAt: "2026-10-01T00:00:00.000Z",
      excerpt: "first post excerpt",
      posts: [],
    });
  });

  it("returns null for a missing topic", () => {
    expect(topicContentFromList(undefined)).toBeNull();
    expect(topicContentFromList({ id: Number.NaN } as Topic)).toBeNull();
  });
});

describe("TopicContentCache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new TopicContentCache(2);
    cache.set({ id: 1, posts: [] });
    cache.set({ id: 2, posts: [] });
    // Reading 1 makes 2 the oldest entry.
    expect(cache.get(1)?.id).toBe(1);
    cache.set({ id: 3, posts: [] });
    expect(cache.get(2)).toBeUndefined();
    expect(cache.get(1)?.id).toBe(1);
    expect(cache.get(3)?.id).toBe(3);
  });

  it("ignores invalid ids and clears on demand", () => {
    const cache = new TopicContentCache(2);
    cache.set({ id: 0, posts: [] });
    cache.set(null);
    expect(cache.get(0)).toBeUndefined();
    cache.set({ id: 4, posts: [] });
    cache.clear();
    expect(cache.get(4)).toBeUndefined();
  });
});

describe("hasTopicContent", () => {
  it("requires at least one post body", () => {
    expect(hasTopicContent({ id: 1, posts: [] })).toBe(false);
    expect(hasTopicContent({ id: 1, posts: [{ username: "alice" }] })).toBe(
      false,
    );
    expect(
      hasTopicContent({ id: 1, posts: [{ cooked: "<p>Hi</p>" }] }),
    ).toBe(true);
  });
});

describe("cacheUnavailableSnapshot", () => {
  it("captures the list snapshot when the anomaly is marked", () => {
    const cache = new TopicContentCache(4);
    expect(
      cacheUnavailableSnapshot(cache, {
        id: 7,
        title: "Gone",
        excerpt: "last words",
      }),
    ).toBe(true);
    expect(cache.get(7)).toEqual({
      id: 7,
      title: "Gone",
      categoryId: undefined,
      createdAt: undefined,
      excerpt: "last words",
      posts: [],
    });
  });

  it("never replaces cached post bodies with a list snapshot", () => {
    const cache = new TopicContentCache(4);
    cache.set({ id: 7, posts: [{ cooked: "<p>body</p>" }] });
    expect(cacheUnavailableSnapshot(cache, { id: 7, excerpt: "new" })).toBe(
      false,
    );
    expect(cache.get(7)?.posts).toHaveLength(1);
  });

  it("refreshes a thin snapshot but ignores invalid topics", () => {
    const cache = new TopicContentCache(4);
    cacheUnavailableSnapshot(cache, { id: 7, excerpt: "old" });
    cacheUnavailableSnapshot(cache, { id: 7, excerpt: "new" });
    expect(cache.get(7)?.excerpt).toBe("new");
    expect(cacheUnavailableSnapshot(cache, null)).toBe(false);
    expect(
      cacheUnavailableSnapshot(cache, { id: Number.NaN } as Topic),
    ).toBe(false);
  });
});
