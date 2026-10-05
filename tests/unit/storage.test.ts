import { describe, expect, it } from "vitest";
import { createSiteStorage, type ValueStore } from "../../src/preferences";
import {
  ORDER_KEY,
  WIDTH_KEY,
  CATEGORY_DATA_CACHE_KEY,
} from "../../src/storage-keys";

function memory() {
  const data = new Map<string, unknown>();
  const values: ValueStore = {
    get: <T>(key: string, fallback: T) =>
      data.has(key) ? (data.get(key) as T) : fallback,
    set: (key, value) => {
      data.set(key, value);
    },
    delete: (key) => {
      data.delete(key);
    },
  };
  return { data, values };
}

describe("published storage compatibility", () => {
  it("migrates LinuxDO legacy keys once without overwriting site preferences", () => {
    const { data, values } = memory();
    data.set(WIDTH_KEY, 350);
    data.set(ORDER_KEY, "default");
    const linux = createSiteStorage("https://linux.do", values);
    linux.set(WIDTH_KEY, 420);
    linux.migrateLegacy();
    expect(linux.get(WIDTH_KEY, 272)).toBe(420);
    expect(linux.get(ORDER_KEY, "activity")).toBe("default");
    expect(data.has(WIDTH_KEY)).toBe(false);
    expect(data.has(ORDER_KEY)).toBe(false);
    linux.migrateLegacy();
    expect(linux.get(WIDTH_KEY, 272)).toBe(420);
    expect(data.get("sfp_site:https%3A%2F%2Flinux.do:sfp_current_order")).toBe(
      "default",
    );
  });

  it("isolates origins and does not consume LinuxDO legacy keys on other forums", () => {
    const { data, values } = memory();
    data.set(WIDTH_KEY, 390);
    const other = createSiteStorage("https://www.nodeloc.com", values);
    other.migrateLegacy();
    expect(data.get(WIDTH_KEY)).toBe(390);
    other.set(CATEGORY_DATA_CACHE_KEY, { version: 1 });
    const linux = createSiteStorage("https://linux.do", values);
    expect(linux.get(CATEGORY_DATA_CACHE_KEY, null)).toBeNull();
    other.delete(CATEGORY_DATA_CACHE_KEY);
    expect(other.get(CATEGORY_DATA_CACHE_KEY, null)).toBeNull();
  });
});
