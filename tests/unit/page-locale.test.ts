import { afterEach, expect, it, vi } from "vitest";
import { createDiscourseBridge } from "../../src/platform/discourse";

afterEach(() => vi.unstubAllGlobals());

function setup(lang: string) {
  const attributes: Record<string, string> = { lang };
  const root = {
    getAttribute: (name: string) => attributes[name] ?? null,
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
  };
  const observers: Array<{ callback: () => void; filter: string[]; active: boolean }> = [];
  class FakeObserver {
    callback: () => void;
    filter: string[] = [];
    active = true;
    constructor(callback: () => void) {
      this.callback = callback;
      observers.push(this);
    }
    observe(_target: unknown, options: { attributeFilter?: string[] } = {}) {
      this.filter = options.attributeFilter || [];
    }
    disconnect() {
      this.active = false;
    }
  }
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("MutationObserver", FakeObserver);
  const bridge = createDiscourseBridge({} as unknown as Window);
  return {
    bridge,
    root,
    observers,
    mutated: (locale: string) => {
      root.setAttribute("lang", locale);
      observers.forEach((observer) => observer.active && observer.callback());
    },
  };
}

it("reports nothing while the page locale is unchanged", () => {
  const { bridge, observers, mutated } = setup("zh-CN");
  const onChange = vi.fn();
  bridge.observePageLocale(onChange);
  expect(observers[0].filter).toEqual(["lang", "xml:lang"]);
  mutated("zh-CN");
  mutated("zh_CN");
  expect(onChange).not.toHaveBeenCalled();
});

it("reports a locale change once, even if the attribute keeps changing", () => {
  const { bridge, mutated } = setup("zh-CN");
  const onChange = vi.fn();
  bridge.observePageLocale(onChange);
  mutated("ja");
  expect(onChange).toHaveBeenCalledTimes(1);
  mutated("de");
  expect(onChange).toHaveBeenCalledTimes(1);
});

it("stops observing after disposal", () => {
  const { bridge, observers, mutated } = setup("zh-CN");
  const onChange = vi.fn();
  bridge.observePageLocale(onChange);
  bridge.dispose();
  expect(observers[0].active).toBe(false);
  mutated("ja");
  expect(onChange).not.toHaveBeenCalled();
});
