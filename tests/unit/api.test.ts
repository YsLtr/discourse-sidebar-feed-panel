import { afterEach, expect, it, vi } from "vitest";
import { createFeedApi } from "../../src/feed/api";

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const abort = new AbortController();
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ topic_list: { topics: [], more_topics_url: "/next" } })));
  vi.stubGlobal("fetch", fetcher);
  return { abort, fetcher, api: createFeedApi({ buildUrl: () => "/latest.json", getCsrfToken: () => "csrf", getSignal: () => abort.signal }) };
}
it("skips empty incoming requests, deduplicates IDs and passes CSRF and cancellation", async () => {
  const { api, abort, fetcher } = setup();
  expect(await api.byIds([])).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  await api.byIds([1, 1, 2, NaN]);
  expect(fetcher).toHaveBeenCalledWith("/latest.json?topic_ids=1,2", { headers: { "X-CSRF-Token": "csrf" }, signal: abort.signal });
});
it("keeps HTTP and invalid-JSON failures visible to the controller's retry path", async () => {
  const { api, fetcher } = setup();
  fetcher.mockResolvedValueOnce(new Response("denied", { status: 429 }));
  await expect(api.byIds([1])).rejects.toThrow("429");
  fetcher.mockResolvedValueOnce(new Response("<html>login</html>"));
  await expect(api.byIds([1])).rejects.toThrow();
});
it("rejects malformed rows without breaking valid topics or pagination", async () => {
  const { api, fetcher } = setup();
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ topic_list: { topics: [null, {}, { id: 4 }], more_topics_url: "/next" }, users: [null, {}, { id: 7, username: "user" }] })));
  expect(await api.byIds([4])).toEqual({ topic_list: { topics: [{ id: 4 }], more_topics_url: "/next" }, users: [{ id: 7, username: "user" }] });
});
