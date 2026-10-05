import { createFeedController } from "./feed/controller";
import { createDiscourseBridge } from "./platform/discourse";
import { gm } from "./platform/gm";
import { createSiteStorage, Preferences } from "./preferences";
import { createSiteData } from "./site/site-data";
import { createTagStyles } from "./site/tag-styles";
import cssText from "./styles/feed.css?inline";

let instance: {
  dispose(): void;
  clearCaches(options?: { reload?: boolean }): void;
} | null = null;
let menuRegistered = false;

export function startFeedPanel() {
  if (instance) return instance;
  const storage = createSiteStorage(location.origin, gm);
  storage.migrateLegacy();
  const discourse = createDiscourseBridge(gm.pageWindow());
  const prefs = new Preferences(storage);
  let controller: ReturnType<typeof createFeedController> | undefined;
  const site = createSiteData({
    storage,
    getCsrfToken: discourse.getCsrfToken,
    onChange: () => {
      controller?.normalizeSiteState();
    },
  });
  const tags = createTagStyles({ storage, site });
  controller = createFeedController({ storage, discourse, prefs, site, tags });
  const style = gm.addStyle(cssText);
  const application = {
    clearCaches: controller.clearCaches,
    dispose() {
      if (instance !== application) return;
      instance = null;
      controller?.dispose();
      tags.dispose();
      site.dispose();
      discourse.dispose();
      style?.remove();
    },
  };
  instance = application;
  if (!menuRegistered) {
    gm.registerMenu("SFP: 清空分类和标签缓存", () =>
      instance?.clearCaches({ reload: true }),
    );
    menuRegistered = true;
  }
  try {
    const page = gm.pageWindow();
    const api = Object.assign(page.SFPFeedPanel || {}, {
      clearCaches: () => instance?.clearCaches({ reload: true }),
      dispose: () => instance?.dispose(),
      start: () => {
        startFeedPanel();
      },
    });
    page.SFPFeedPanel = api;
  } catch (error) {
    // The optional page API must not prevent the feed or GM menu from starting.
    console.warn("[SFP] setup cache controls failed:", error);
  }
  controller.start();
  return application;
}
