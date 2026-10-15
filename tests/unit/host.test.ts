import { expect, it, vi } from "vitest";
import {
  captureInlineValues,
  firstMatch,
  restoreInlineValues,
  SIDEBAR_HOST_SELECTORS,
  TOGGLE_ANCHOR_SELECTORS,
  WIDTH_VARIABLE,
  type InlineTarget,
} from "../../src/ui/host";

it("keeps the sidebar host chain specific first and free of unobserved selectors", () => {
  expect([...SIDEBAR_HOST_SELECTORS]).toEqual([
    "#d-sidebar",
    ".sidebar-container",
  ]);
});

it("keeps the toggle anchor chain specific first and never uses the removed header id", () => {
  expect([...TOGGLE_ANCHOR_SELECTORS]).toEqual([
    ".home-logo-wrapper-outlet .title",
    ".home-logo-wrapper-outlet",
    ".d-header .contents",
    ".d-header .panel",
  ]);
  for (const selector of TOGGLE_ANCHOR_SELECTORS) {
    expect(selector).not.toContain("#d-header");
  }
});

it("stops at the first candidate that resolves", () => {
  const lookup = vi.fn((selector: string) =>
    selector === ".b" ? "second" : null,
  );

  expect(firstMatch(["a", ".b", "c"], lookup)).toBe("second");
  expect(lookup.mock.calls.map(([selector]) => selector)).toEqual(["a", ".b"]);
});

it("falls back to the last candidate when only it resolves", () => {
  const lookup = (selector: string) => (selector === "c" ? "last" : null);

  expect(firstMatch(["a", ".b", "c"], lookup)).toBe("last");
});

it("reports no host when every candidate is absent", () => {
  const lookup = vi.fn(() => null);

  expect(firstMatch(SIDEBAR_HOST_SELECTORS, lookup)).toBeNull();
  expect(lookup).toHaveBeenCalledTimes(SIDEBAR_HOST_SELECTORS.length);
});

it("treats an undefined lookup result as a miss", () => {
  const lookup = (selector: string) =>
    selector === "a" ? undefined : "fallback";

  expect(firstMatch(["a", "b"], lookup)).toBe("fallback");
});

it("resolves the host chain against a fake root", () => {
  const host = { id: "d-sidebar" };
  const root = {
    querySelector: (selector: string) =>
      selector === ".sidebar-container" ? host : null,
  };

  expect(firstMatch(SIDEBAR_HOST_SELECTORS, (s) => root.querySelector(s))).toBe(
    host,
  );
});

/** Fake inline style surface that keeps values and priorities per property. */
function fakeTarget(initial?: { value: string; priority?: string }) {
  const values = new Map<string, { value: string; priority: string }>();
  if (initial) {
    values.set(WIDTH_VARIABLE, {
      value: initial.value,
      priority: initial.priority ?? "",
    });
  }
  return {
    isConnected: true,
    values,
    style: {
      getPropertyValue: (name: string) => values.get(name)?.value ?? "",
      getPropertyPriority: (name: string) => values.get(name)?.priority ?? "",
      setProperty: (name: string, value: string, priority = "") => {
        values.set(name, { value, priority });
      },
      removeProperty: (name: string) => {
        values.delete(name);
      },
    },
  } satisfies InlineTarget & { values: Map<string, unknown> };
}

it("records each target's inline value once, before the first write", () => {
  const root = fakeTarget({ value: "480px", priority: "important" });
  const body = fakeTarget();
  const saved = captureInlineValues<InlineTarget>(
    [],
    [root, body],
    WIDTH_VARIABLE,
  );

  expect(saved).toEqual([
    { el: root, value: "480px", priority: "important" },
    { el: body, value: "", priority: "" },
  ]);

  // A second capture must not overwrite the remembered originals.
  body.style.setProperty(WIDTH_VARIABLE, "300px");
  const again = captureInlineValues(saved, [root, body], WIDTH_VARIABLE);
  expect(again.map((entry) => entry.value)).toEqual(["480px", ""]);
  expect(again.map((entry) => entry.el)).toEqual([root, body]);
});

it("adds a target that appears after the first write", () => {
  const root = fakeTarget();
  const first = captureInlineValues<InlineTarget>([], [root], WIDTH_VARIABLE);
  const outlet = fakeTarget({ value: "240px" });
  const second = captureInlineValues(
    first,
    [root, outlet],
    WIDTH_VARIABLE,
  );

  expect(second).toHaveLength(2);
  expect(second[1]).toEqual({ el: outlet, value: "240px", priority: "" });
});

it("forgets targets that left the document", () => {
  const root = fakeTarget({ value: "480px" });
  const outlet = fakeTarget({ value: "240px" });
  const saved = captureInlineValues<InlineTarget>(
    [],
    [root, outlet],
    WIDTH_VARIABLE,
  );
  (outlet as { isConnected: boolean }).isConnected = false;

  expect(captureInlineValues(saved, [root, outlet], WIDTH_VARIABLE)).toEqual([
    { el: root, value: "480px", priority: "" },
  ]);
});

it("restores a remembered value and deletes one that was never set", () => {
  const root = fakeTarget({ value: "480px", priority: "important" });
  const body = fakeTarget();
  const saved = captureInlineValues<InlineTarget>(
    [],
    [root, body],
    WIDTH_VARIABLE,
  );
  for (const target of [root, body]) {
    target.style.setProperty(WIDTH_VARIABLE, "272px");
  }

  restoreInlineValues(saved, WIDTH_VARIABLE);

  expect(root.style.getPropertyValue(WIDTH_VARIABLE)).toBe("480px");
  expect(root.style.getPropertyPriority(WIDTH_VARIABLE)).toBe("important");
  expect(body.style.getPropertyValue(WIDTH_VARIABLE)).toBe("");
});

it("restores nothing when the panel never wrote", () => {
  const body = fakeTarget({ value: "777px" });

  restoreInlineValues([], WIDTH_VARIABLE);

  expect(body.style.getPropertyValue(WIDTH_VARIABLE)).toBe("777px");
});
