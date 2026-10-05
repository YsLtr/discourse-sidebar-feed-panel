import { describe, expect, it } from "vitest";
import {
  buildCategoryPath,
  buildFeedUrl,
  feedQueryKey,
} from "../../src/feed/query";
import type {
  CategoryPathEntry,
  FeedQuerySnapshot,
} from "../../src/feed/types";

const query: FeedQuerySnapshot = {
  tab: "all",
  categoryId: null,
  order: "activity",
  period: "all",
  filter: "all",
};
const categories = new Map<number, CategoryPathEntry>([
  [1, { id: 1, slug: "parent" }],
  [2, { id: 2, slug: "子分类", parent_category_id: 1 }],
]);
const category = (id: number) => categories.get(id) || null;

describe("Discourse query semantics", () => {
  it("uses local page numbers for latest and preserves ranked all-time ordering", () => {
    expect(buildFeedUrl(query, 3, category)).toBe(
      "/latest.json?order=activity&page=3",
    );
    expect(buildFeedUrl({ ...query, order: "likes" }, 0, category)).toBe(
      "/latest.json?order=likes&page=0",
    );
  });
  it("uses top only for period-scoped ranking", () => {
    expect(
      buildFeedUrl({ ...query, order: "views", period: "weekly" }, 2, category),
    ).toBe("/top.json?period=weekly&order=views&page=2");
    expect(
      buildFeedUrl(
        { ...query, order: "created", period: "weekly" },
        0,
        category,
      ),
    ).toBe("/latest.json?order=created&page=0");
  });
  it("builds parent slug paths and explicitly includes subcategories", () => {
    const q = { ...query, tab: "cat-2", categoryId: 2 };
    const path = `/c/parent/${encodeURIComponent("子分类")}/2`;
    expect(buildFeedUrl(q, 1, category)).toBe(
      `${path}/l/latest.json?page=1&include_subcategories=true&order=activity`,
    );
    expect(
      buildFeedUrl({ ...q, order: "likes", period: "daily" }, 0, category),
    ).toBe(
      `${path}/l/top.json?page=0&include_subcategories=true&period=daily&order=likes`,
    );
  });
  it("handles missing slugs and cyclic category parents", () => {
    expect(buildCategoryPath(9, () => null)).toBe("/c/category/9");
    const cyclic = (id: number) => ({
      id,
      slug: String(id),
      parent_category_id: id === 1 ? 2 : 1,
    });
    expect(buildCategoryPath(1, cyclic)).toBe("/c/2/1/1");
  });
  it("includes each query dimension in stale-response comparison", () => {
    for (const changed of [
      { tab: "cat-1" },
      { categoryId: 1 },
      { order: "created" },
      { period: "daily" },
      { filter: "read" },
    ])
      expect(feedQueryKey({ ...query, ...changed })).not.toBe(
        feedQueryKey(query),
      );
  });
});
