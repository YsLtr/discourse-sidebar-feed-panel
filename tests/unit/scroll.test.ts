import { afterEach, describe, expect, it, vi } from "vitest";
import { createFeedScroll } from "../../src/ui/scroll";

afterEach(() => vi.useRealTimers());
function element() {
  return Object.assign(new EventTarget(), {
    scrollTop: 700,
    scrollHeight: 1000,
    clientHeight: 300,
  }) as HTMLElement;
}

describe("scroll binding ownership", () => {
  it("cancels the old pending debounce when rebinding and calls the new binding once", () => {
    vi.useFakeTimers();
    const callbacks = {
      canLoadMore: () => true,
      onLoadMore: vi.fn(),
      onReadingState: vi.fn(),
    };
    const scroll = createFeedScroll(callbacks);
    const first = element(),
      second = element();
    scroll.bind(first);
    first.dispatchEvent(new Event("scroll"));
    scroll.bind(second);
    vi.advanceTimersByTime(400);
    expect(callbacks.onLoadMore).not.toHaveBeenCalled();
    first.dispatchEvent(new Event("scroll"));
    second.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(400);
    expect(callbacks.onLoadMore).toHaveBeenCalledTimes(1);
    expect(callbacks.onReadingState).toHaveBeenCalledTimes(2);
  });
  it("reads current loading state at dispatch and releases listeners and pending work", () => {
    vi.useFakeTimers();
    let canLoad = true;
    const onLoadMore = vi.fn(),
      onReadingState = vi.fn();
    const scroll = createFeedScroll({
      canLoadMore: () => canLoad,
      onLoadMore,
      onReadingState,
    });
    const el = element();
    scroll.bind(el);
    el.dispatchEvent(new Event("scroll"));
    canLoad = false;
    vi.advanceTimersByTime(400);
    expect(onLoadMore).not.toHaveBeenCalled();
    canLoad = true;
    el.dispatchEvent(new Event("scroll"));
    scroll.dispose();
    scroll.dispose();
    el.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(400);
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(onReadingState).toHaveBeenCalledTimes(2);
  });
});
