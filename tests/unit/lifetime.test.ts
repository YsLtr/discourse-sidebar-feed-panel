import { afterEach, expect, it, vi } from "vitest";
import { Lifetime } from "../../src/platform/lifetime";
import { RefreshCountdown } from "../../src/feed/refresh";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("disposal removes pending effects, aborts requests and remains idempotent", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 16),
    cancelAnimationFrame: clearTimeout,
  });
  const target = new EventTarget();
  const scope = new Lifetime();
  const callback = vi.fn();
  scope.listen(target as HTMLElement, "click", callback);
  scope.frame(callback);
  scope.timeout(callback, 100);
  const cleanup = vi.fn();
  scope.defer(cleanup);
  scope.dispose();
  scope.dispose();
  target.dispatchEvent(new Event("click"));
  vi.runAllTimers();
  expect(callback).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(scope.signal.aborted).toBe(true);
  scope.timeout(callback, 100);
  expect(vi.getTimerCount()).toBe(0);
});

it("refresh timer restart never stacks clocks and stop removes the pending tick", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setInterval, clearInterval });
  const countdown = new RefreshCountdown();
  const refresh = vi.fn();
  countdown.start(2, refresh);
  countdown.start(2, refresh);
  vi.advanceTimersByTime(1000);
  expect(refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(refresh).toHaveBeenCalledTimes(1);
  countdown.reset(3);
  vi.advanceTimersByTime(2000);
  expect(refresh).toHaveBeenCalledTimes(1);
  countdown.stop();
  expect(vi.getTimerCount()).toBe(0);
});

it("forgets canceled and completed timers instead of retaining them until disposal", () => {
  vi.useFakeTimers();
  const cancelTimer = vi.fn(clearTimeout), cancelFrame = vi.fn(clearTimeout);
  vi.stubGlobal("window", { setTimeout, clearTimeout: cancelTimer,
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 16), cancelAnimationFrame: cancelFrame });
  const scope = new Lifetime(), callback = vi.fn();
  for (let i = 0; i < 500; i++) {
    scope.clearTimeout(scope.timeout(callback, 100));
    scope.cancelFrame(scope.frame(callback));
  }
  scope.timeout(callback, 1);
  vi.advanceTimersByTime(1);
  expect(callback).toHaveBeenCalledTimes(1);
  cancelTimer.mockClear(); cancelFrame.mockClear();
  scope.dispose();
  expect(cancelTimer).not.toHaveBeenCalled();
  expect(cancelFrame).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
