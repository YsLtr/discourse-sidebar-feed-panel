import {
  GM_addStyle,
  GM_deleteValue,
  GM_getValue,
  GM_registerMenuCommand,
  GM_setValue,
  unsafeWindow,
} from "$";

export const gm = {
  get: GM_getValue,
  set: GM_setValue,
  delete: (key: string) => {
    if (typeof GM_deleteValue === "function") GM_deleteValue(key);
  },
  addStyle: GM_addStyle,
  registerMenu: (label: string, callback: () => void) => {
    if (typeof GM_registerMenuCommand === "function")
      GM_registerMenuCommand(label, callback);
  },
  pageWindow: () =>
    typeof unsafeWindow !== "undefined" ? unsafeWindow : window,
};
