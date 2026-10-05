import { Lifetime } from "./lifetime";
import type { MessageBus } from "./types";
export function createDiscourseBridge(pageWindow: Window) {
  let scope = new Lifetime();
  let cachedCsrfToken: string | null = null;
  function getCsrfToken() {
    if (cachedCsrfToken === null) {
      cachedCsrfToken =
        document
          .querySelector('meta[name="csrf-token"]')
          ?.getAttribute("content") || "";
    }
    return cachedCsrfToken;
  }

  function toAbsoluteSiteUrl(path: string) {
    if (!path) return "";
    return new URL(path, location.origin).href;
  }

  function navigateTo(path: string) {
    const script = document.createElement("script");
    script.textContent = `window.require("discourse/lib/url").default.routeTo(${JSON.stringify(path)});`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  function getDiscourse() {
    try {
      return (
        pageWindow?.Discourse ||
        (typeof window !== "undefined" && window.Discourse) ||
        (typeof Discourse !== "undefined" && Discourse) ||
        null
      );
    } catch (e) {
      return null;
    }
  }

  function getMessageBus(): MessageBus | null {
    try {
      return (
        (getDiscourse()?.__container__?.lookup("service:message-bus") as
          | MessageBus
          | undefined) || null
      );
    } catch (e) {
      return null;
    }
  }

  function getAvatarUrl(template: string, size: number) {
    if (!template) return "";
    let url = template.replace("{size}", String(size));
    if (!url.startsWith("http")) url = toAbsoluteSiteUrl(url);
    return url;
  }

  function getUserProfileUrl(username: string) {
    if (!username) return "";
    return `/u/${encodeURIComponent(username)}`;
  }

  function openPathInNewTab(path: string) {
    window.open(toAbsoluteSiteUrl(path), "_blank", "noopener,noreferrer");
  }

  function handlePointerNavigation(
    e: MouseEvent,
    path: string,
    {
      onPrimaryActivate,
      onMiddleActivate,
    }: { onPrimaryActivate?: () => void; onMiddleActivate?: () => void } = {},
  ) {
    if (!path) return false;
    const isPrimaryClick = e.type === "click" && e.button === 0;
    const isMiddleClick = e.type === "auxclick" && e.button === 1;
    if (!isPrimaryClick && !isMiddleClick) return false;

    e.preventDefault();
    e.stopPropagation();

    if (isPrimaryClick && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      onPrimaryActivate?.();
      openPathInNewTab(path);
      return true;
    }

    if (isPrimaryClick) {
      onPrimaryActivate?.();
      navigateTo(path);
      return true;
    }

    onMiddleActivate?.();
    openPathInNewTab(path);
    return true;
  }

  function waitForEmber(callback: () => void, maxWait = 15000) {
    const start = Date.now();
    function check() {
      if (scope.disposed) return;
      try {
        if (getDiscourse()?.__container__) {
          callback();
          return;
        }
      } catch (e) {
        /* not ready */
      }
      if (Date.now() - start < maxWait) {
        scope.timeout(check, 500);
      } else {
        console.warn("[SFP] Timed out waiting for Ember");
      }
    }
    check();
  }

  function waitForStableHeaderMount(callback: () => void) {
    waitForEmber(() => {
      const run = () => {
        scope.frame(() => {
          scope.frame(() => {
            callback();
          });
        });
      };

      if (document.readyState === "complete") {
        run();
        return;
      }

      scope.listen(window, "load", run, { once: true });
    });
  }
  return {
    dispose: () => scope.dispose(),
    getCsrfToken,
    toAbsoluteSiteUrl,
    navigateTo,
    getDiscourse,
    getMessageBus,
    getAvatarUrl,
    getUserProfileUrl,
    openPathInNewTab,
    handlePointerNavigation,
    waitForEmber,
    waitForStableHeaderMount,
  };
}
