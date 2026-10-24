import { afterEach, expect, it, vi } from "vitest";
import { createDiscourseBridge } from "../../src/platform/discourse";

afterEach(() => vi.unstubAllGlobals());

function setup({
  lookup,
  preloaded,
}: {
  lookup?: (name: string) => unknown;
  preloaded?: string | null;
}) {
  const page = {
    Discourse: lookup
      ? { __container__: { lookup } }
      : (undefined as unknown as Record<string, unknown>),
  };
  const element = preloaded === undefined ? null : { textContent: preloaded };
  vi.stubGlobal("document", {
    documentElement: { getAttribute: () => null },
    getElementById: (id: string) => (id === "data-preloaded" ? element : null),
  });
  vi.stubGlobal("location", { origin: "https://forum.example" });
  return createDiscourseBridge(page as unknown as Window);
}

it("treats a registered current user as logged in", () => {
  const bridge = setup({ lookup: () => ({ id: 7, username: "u" }) });
  expect(bridge.isLoggedIn()).toBe(true);
});

it("treats an explicitly null current user as anonymous without reading preloads", () => {
  const bridge = setup({
    lookup: () => null,
    preloaded: '{"currentUser":{"id":7}}',
  });
  expect(bridge.isLoggedIn()).toBe(false);
});

it("falls back to the preloaded payload when the container is not ready", () => {
  const throwing = setup({
    lookup: () => {
      throw new Error("container not ready");
    },
    preloaded: '{"site":{}, "currentUser":{"id":7}}',
  });
  expect(throwing.isLoggedIn()).toBe(true);

  const anonymous = setup({
    lookup: () => {
      throw new Error("container not ready");
    },
    preloaded: '{"site":{}}',
  });
  expect(anonymous.isLoggedIn()).toBe(false);
});

it("stays conservative when nothing can be determined", () => {
  const bridge = setup({});
  expect(bridge.isLoggedIn()).toBe(false);
});
