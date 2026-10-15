import { expect, it, vi } from "vitest";
import {
  firstMatch,
  SIDEBAR_HOST_SELECTORS,
  TOGGLE_ANCHOR_SELECTORS,
} from "../../src/ui/host";

it("keeps the sidebar host chain specific first and free of unobserved selectors", () => {
  expect([...SIDEBAR_HOST_SELECTORS]).toEqual([
    "#d-sidebar",
    ".sidebar-container",
    ".sidebar-wrapper .sidebar-container",
  ]);
});

it("keeps the toggle anchor chain specific first and never uses the removed header id", () => {
  expect([...TOGGLE_ANCHOR_SELECTORS]).toEqual([
    ".home-logo-wrapper-outlet .title",
    ".home-logo-wrapper-outlet",
    "header.d-header .contents",
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
      selector === ".sidebar-wrapper .sidebar-container" ? host : null,
  };

  expect(firstMatch(SIDEBAR_HOST_SELECTORS, (s) => root.querySelector(s))).toBe(
    host,
  );
});
