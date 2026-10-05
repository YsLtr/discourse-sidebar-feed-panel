export interface FeedScrollCallbacks {
  canLoadMore: () => boolean;
  onLoadMore: () => void;
  onReadingState: () => void;
}

/** CSS owns containment. These passive listeners only observe native scrolling. */
export function createFeedScroll(callbacks: FeedScrollCallbacks) {
  let release: (() => void) | undefined;

  function dispose() {
    release?.();
    release = undefined;
  }

  function bind(element: HTMLElement | null) {
    dispose();
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onLoadScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (!callbacks.canLoadMore()) return;
        const { scrollTop, scrollHeight, clientHeight } = element;
        if (scrollHeight - scrollTop - clientHeight < 200)
          callbacks.onLoadMore();
      }, 300);
    };
    element.addEventListener("scroll", callbacks.onReadingState, {
      passive: true,
    });
    element.addEventListener("scroll", onLoadScroll, { passive: true });
    release = () => {
      clearTimeout(timer);
      element.removeEventListener("scroll", callbacks.onReadingState);
      element.removeEventListener("scroll", onLoadScroll);
    };
  }

  return { bind, dispose };
}
