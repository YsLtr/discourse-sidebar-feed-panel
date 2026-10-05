import { afterEach, describe, expect, it, vi } from "vitest";
import { createSiteData } from "../../src/site/site-data";
import { CATEGORY_DATA_CACHE_KEY } from "../../src/storage-keys";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const records = [
  { id: 1, slug: "parent", name: "Parent", color: "123456", topic_count: 20 },
  { id: 2, slug: "child", name: "Child", parent_category_id: 1 },
  { id: 3, slug: "other", name: "Other" },
];
function setup(
  sitePayload: object,
  navigation: object[] = [],
  cached?: object,
) {
  vi.stubGlobal("location", { origin: "https://forum.example" });
  vi.stubGlobal("document", { querySelectorAll: () => [] });
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url === "/site.json"
            ? sitePayload
            : { category_list: { categories: navigation } },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const saved = new Map<string, unknown>();
  if (cached) saved.set(CATEGORY_DATA_CACHE_KEY, cached);
  const storage = {
    get: <T>(key: string, fallback: T): T =>
      (saved.get(key) as T | undefined) ?? fallback,
    set: (key: string, value: unknown) => {
      saved.set(key, value);
    },
    delete: (key: string) => {
      saved.delete(key);
    },
  };
  const onChange = vi.fn();
  return {
    site: createSiteData({ storage, getCsrfToken: () => "csrf", onChange }),
    fetcher,
    saved,
    onChange,
  };
}

describe("site data service", () => {
  it("uses preloaded encoded site data without a site.json request", async () => {
    const { site, fetcher } = setup({});
    const raw = encodeURIComponent(JSON.stringify({ _site: { categories: records, navigation_menu_categories: [2] } }));
    vi.stubGlobal("document", { querySelectorAll: (selector: string) => selector === "[data-preloaded]" ? [{ getAttribute: () => raw }] : [] });
    await site.loadCategoryMetadata();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/categories_and_latest.json");
    expect(site.tabCategories.map(t => t.id)).toEqual([2]);
  });
  it("rejects an old cache version and falls back to categories when site.json fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { site, fetcher } = setup({}, [], { version: 0, source: { site: { categories: records }, navigationCategories: [records[2]] } });
    fetcher.mockImplementation(async url => url === "/site.json" ? new Response("unavailable", { status: 503 }) : new Response(JSON.stringify({ category_list: { categories: [records[0]] } })));
    await site.loadCategoryMetadata();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(site.tabCategories.map(t => t.id)).toEqual([1]);
    expect(site.loaded).toBe(true);
  });
  it("keeps site navigation when the secondary endpoint fails and degrades to All when both fail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { site, fetcher, saved } = setup({});
    fetcher.mockImplementation(async url => url === "/site.json" ? new Response(JSON.stringify({ categories: records, navigation_menu_categories: [2] })) : new Response("denied", { status: 403 }));
    await site.loadCategoryMetadata();
    expect(site.tabCategories.map(t => t.id)).toEqual([2]);
    site.reset();
    saved.clear();
    fetcher.mockRejectedValue(new Error("offline"));
    await site.loadCategoryMetadata();
    expect(site.tabCategories).toEqual([]);
    expect(site.loaded).toBe(true);
  });
  it("rejects a cleared cache's old responses even if fetch ignores abort", async () => {
    const { site, fetcher, saved } = setup({});
    const pending: Array<(response: Response) => void> = [];
    fetcher.mockImplementation(() => new Promise<Response>(resolve => pending.push(resolve)));
    const oldLoad = site.loadCategoryMetadata();
    site.reset();
    fetcher.mockImplementation(async url => new Response(JSON.stringify(url === '/site.json'
      ? { categories: [{ id: 7, name: 'Current' }], navigation_menu_categories: [7] }
      : { category_list: { categories: [] } })));
    await site.loadCategoryMetadata();
    pending.forEach(resolve => resolve(new Response(JSON.stringify({ categories: records, category_list: { categories: records } }))));
    await oldLoad;
    expect(site.tabCategories.map(t => t.id)).toEqual([7]);
    expect(JSON.stringify(saved.get(CATEGORY_DATA_CACHE_KEY))).toContain('Current');
    site.dispose();
  });
  it("coalesces requests, uses navigation categories only, and retains parent metadata", async () => {
    const { site, fetcher } = setup({
      categories: records,
      navigation_menu_categories: [2],
      filters: ["latest", "top", "unread"],
      periods: ["weekly"],
    });
    await Promise.all([
      site.loadCategoryMetadata(),
      site.loadCategoryMetadata(),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(site.tabCategories.map((cat) => cat.id)).toEqual([2]);
    expect(site._getCategoryMeta(2)).toMatchObject({
      parent_category_id: 1,
      parent_color: "123456",
    });
    expect(site.capabilities.orderValues.has("likes")).toBe(true);
    expect([...site.capabilities.periodValues]).toEqual(["weekly"]);
    expect([...site.capabilities.filterValues]).toEqual(["all", "unseen"]);
    await site.loadCategoryMetadata();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not substitute all top-level categories when navigation data is absent", async () => {
    const { site } = setup({ categories: records, filters: ["latest"] });
    await site.loadCategoryMetadata();
    expect(site.tabCategories).toEqual([]);
    expect(site._getCategoryMeta(3)?.name).toBe("Other");
  });
  it("reuses the versioned category cache and supports legacy slug tabs", async () => {
    const { site, fetcher, onChange } = setup({}, [], {
      version: 1,
      source: {
        site: { categories: records },
        navigationCategories: [records[0]],
      },
    });
    await site.loadCategoryMetadata();
    expect(fetcher).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledOnce();
    expect(site._findTabCategoryByTabId("parent")?.tabId).toBe("cat-1");
    site.reset();
    expect(site.loaded).toBe(false);
    expect(site.tabCategories).toEqual([]);
  });
});
