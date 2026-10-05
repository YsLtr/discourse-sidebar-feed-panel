export interface RouteCallbacks {
  onRouteChange: () => void;
  onMutation: () => void;
}

/** Observe body because Discourse may replace its sidebar outside main-outlet. */
export function createRouteWatcher(callbacks: RouteCallbacks) {
  let stopCurrent: (() => void) | undefined;

  function stop() {
    stopCurrent?.();
    stopCurrent = undefined;
  }

  function start() {
    if (stopCurrent) return;
    let lastUrl = location.href;
    let active = true;
    const checkUrl = () => {
      if (!active || location.href === lastUrl) return;
      lastUrl = location.href;
      callbacks.onRouteChange();
    };
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const push: History["pushState"] = function (this: History, ...args) {
      originalPush.apply(this, args);
      checkUrl();
    };
    const replace: History["replaceState"] = function (this: History, ...args) {
      originalReplace.apply(this, args);
      checkUrl();
    };
    history.pushState = push;
    history.replaceState = replace;
    window.addEventListener("popstate", checkUrl);
    const observer = new MutationObserver(() => {
      if (!active) return;
      checkUrl();
      callbacks.onMutation();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    stopCurrent = () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("popstate", checkUrl);
      // Another extension may have installed a newer wrapper. Never overwrite it.
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace)
        history.replaceState = originalReplace;
    };
  }

  return { start, stop };
}
