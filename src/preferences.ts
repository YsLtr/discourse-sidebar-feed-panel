import {
  LEGACY_LINUXDO_ORIGIN,
  SITE_SCOPED_STORAGE_KEYS,
  SITE_STORAGE_PREFIX,
  STORAGE_MISSING,
} from "./storage-keys";

export interface ValueStore {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

/** Keep published keys and synchronous GM storage semantics during migration. */
export function createSiteStorage(origin: string, values: ValueStore) {
  const keyFor = (key: string) =>
    `${SITE_STORAGE_PREFIX}:${encodeURIComponent(origin)}:${key}`;
  return {
    get: <T>(key: string, fallback: T): T => values.get(keyFor(key), fallback),
    set: (key: string, value: unknown) => values.set(keyFor(key), value),
    delete: (key: string) => values.delete(keyFor(key)),
    migrateLegacy() {
      if (origin !== LEGACY_LINUXDO_ORIGIN) return;
      for (const key of SITE_SCOPED_STORAGE_KEYS) {
        const legacy = values.get<unknown>(key, STORAGE_MISSING);
        if (legacy === STORAGE_MISSING) continue;
        if (values.get(keyFor(key), STORAGE_MISSING) === STORAGE_MISSING) {
          values.set(keyFor(key), legacy);
        }
        values.delete(key);
      }
    },
  };
}

import {
  DEFAULT_AUTO_REFRESH_INTERVAL,
  DEFAULT_AUTO_SILENT_REFRESH_INTERVAL,
  DEFAULT_WIDTH,
} from "./constants";
import * as keys from "./storage-keys";

export class Preferences {
  private _feedModeEnabled: boolean;
  private _currentOrder: string;
  private _currentPeriod: string;
  private _sfpSidebarWidth: number;
  private _currentTab: string;
  private _currentFilter: string;
  private _hidePinned: boolean;
  private _showIncomingHint: boolean;
  private _autoSilentRefreshEnabled: boolean;
  private _autoSilentRefreshInterval: number;
  private _autoRefreshEnabled: boolean;
  private _autoRefreshInterval: number;
  constructor(private storage: ValueStore) {
    this._feedModeEnabled = storage.get(keys.STATE_KEY, false);
    this._currentOrder = storage.get(keys.ORDER_KEY, "activity");
    if (this._currentOrder === "default") {
      this._currentOrder = "activity";
      storage.set(keys.ORDER_KEY, this._currentOrder);
    }
    this._currentPeriod = storage.get(keys.PERIOD_KEY, "all");
    this._sfpSidebarWidth = storage.get(keys.WIDTH_KEY, DEFAULT_WIDTH);
    this._currentTab = storage.get(keys.TAB_KEY, "all");
    this._currentFilter = storage.get(keys.FILTER_KEY, "all");
    this._hidePinned = storage.get(keys.HIDE_PINNED_KEY, false);
    this._showIncomingHint = storage.get(keys.SHOW_INCOMING_HINT_KEY, true);
    this._autoSilentRefreshEnabled = storage.get(
      keys.AUTO_SILENT_REFRESH_KEY,
      false,
    );
    this._autoSilentRefreshInterval = Math.max(
      0,
      Number(
        storage.get(
          keys.AUTO_SILENT_REFRESH_INTERVAL_KEY,
          DEFAULT_AUTO_SILENT_REFRESH_INTERVAL,
        ),
      ) || DEFAULT_AUTO_SILENT_REFRESH_INTERVAL,
    );
    this._autoRefreshEnabled = storage.get(
      keys.AUTO_REFRESH_ENABLED_KEY,
      false,
    );
    this._autoRefreshInterval = Math.max(
      1,
      Number(
        storage.get(
          keys.AUTO_REFRESH_INTERVAL_KEY,
          DEFAULT_AUTO_REFRESH_INTERVAL,
        ),
      ) || DEFAULT_AUTO_REFRESH_INTERVAL,
    );
  }
  get feedModeEnabled() {
    return this._feedModeEnabled;
  }
  set feedModeEnabled(value: boolean) {
    this._feedModeEnabled = value;
    this.storage.set(keys.STATE_KEY, value);
  }
  get currentOrder() {
    return this._currentOrder;
  }
  set currentOrder(value: string) {
    this._currentOrder = value;
    this.storage.set(keys.ORDER_KEY, value);
  }
  get currentPeriod() {
    return this._currentPeriod;
  }
  set currentPeriod(value: string) {
    this._currentPeriod = value;
    this.storage.set(keys.PERIOD_KEY, value);
  }
  get sfpSidebarWidth() {
    return this._sfpSidebarWidth;
  }
  set sfpSidebarWidth(value: number) {
    this._sfpSidebarWidth = value;
    this.storage.set(keys.WIDTH_KEY, value);
  }
  get currentTab() {
    return this._currentTab;
  }
  set currentTab(value: string) {
    this._currentTab = value;
    this.storage.set(keys.TAB_KEY, value);
  }
  get currentFilter() {
    return this._currentFilter;
  }
  set currentFilter(value: string) {
    this._currentFilter = value;
    this.storage.set(keys.FILTER_KEY, value);
  }
  get hidePinned() {
    return this._hidePinned;
  }
  set hidePinned(value: boolean) {
    this._hidePinned = value;
    this.storage.set(keys.HIDE_PINNED_KEY, value);
  }
  get showIncomingHint() {
    return this._showIncomingHint;
  }
  set showIncomingHint(value: boolean) {
    this._showIncomingHint = value;
    this.storage.set(keys.SHOW_INCOMING_HINT_KEY, value);
  }
  get autoSilentRefreshEnabled() {
    return this._autoSilentRefreshEnabled;
  }
  set autoSilentRefreshEnabled(value: boolean) {
    this._autoSilentRefreshEnabled = value;
    this.storage.set(keys.AUTO_SILENT_REFRESH_KEY, value);
  }
  get autoSilentRefreshInterval() {
    return this._autoSilentRefreshInterval;
  }
  set autoSilentRefreshInterval(value: number) {
    this._autoSilentRefreshInterval = value;
    this.storage.set(keys.AUTO_SILENT_REFRESH_INTERVAL_KEY, value);
  }
  get autoRefreshEnabled() {
    return this._autoRefreshEnabled;
  }
  set autoRefreshEnabled(value: boolean) {
    this._autoRefreshEnabled = value;
    this.storage.set(keys.AUTO_REFRESH_ENABLED_KEY, value);
  }
  get autoRefreshInterval() {
    return this._autoRefreshInterval;
  }
  set autoRefreshInterval(value: number) {
    this._autoRefreshInterval = value;
    this.storage.set(keys.AUTO_REFRESH_INTERVAL_KEY, value);
  }
  saveTabOrder(ids: number[]) {
    this.storage.set(keys.TAB_ORDER_KEY, ids);
  }
}
