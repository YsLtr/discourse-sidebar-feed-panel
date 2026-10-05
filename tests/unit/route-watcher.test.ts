import { afterEach, expect, it, vi } from "vitest";
import { createRouteWatcher } from "../../src/platform/route-watcher";

afterEach(() => vi.unstubAllGlobals());

it("starts once, releases popstate/observer, and preserves later history wrappers", () => {
  const url = { href: "https://forum.example/" };
  const win = new EventTarget();
  const hist = {
    pushState: vi.fn((_data: unknown, _unused: string, path: string) => {
      url.href = path;
    }),
    replaceState: vi.fn((_data: unknown, _unused: string, path: string) => {
      url.href = path;
    }),
  };
  const disconnect = vi.fn();
  let mutation: () => void = () => {};
  vi.stubGlobal("location", url);
  vi.stubGlobal("window", win);
  vi.stubGlobal("history", hist);
  vi.stubGlobal("document", { body: {} });
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        mutation = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const callbacks = { onRouteChange: vi.fn(), onMutation: vi.fn() };
  const watcher = createRouteWatcher(callbacks);
  const originalReplace = hist.replaceState;
  watcher.start();
  const wrappedPush = hist.pushState;
  watcher.start();
  expect(hist.pushState).toBe(wrappedPush);
  hist.pushState(null, "", "https://forum.example/t/1");
  expect(callbacks.onRouteChange).toHaveBeenCalledOnce();
  mutation();
  expect(callbacks.onMutation).toHaveBeenCalledOnce();
  const laterWrapper = vi.fn((...args: Parameters<typeof wrappedPush>) =>
    wrappedPush(...args),
  );
  hist.pushState = laterWrapper;
  watcher.stop();
  watcher.stop();
  expect(hist.pushState).toBe(laterWrapper);
  expect(hist.replaceState).toBe(originalReplace);
  expect(disconnect).toHaveBeenCalledOnce();
  hist.pushState(null, "", "https://forum.example/t/2");
  win.dispatchEvent(new Event("popstate"));
  mutation();
  expect(callbacks.onRouteChange).toHaveBeenCalledOnce();
  expect(callbacks.onMutation).toHaveBeenCalledOnce();
});
