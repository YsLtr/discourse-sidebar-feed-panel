import { AUTO_REFRESH_IDLE_LIMIT_MS } from "../constants";
import type { Lifetime } from "../platform/lifetime";

export class RefreshCountdown {
  private timer: number | null = null;
  private remaining = 0;
  get running() {
    return this.timer !== null;
  }
  reset(seconds: number) {
    this.remaining = seconds;
  }
  start(seconds: number, tick: () => void) {
    this.stop();
    this.reset(seconds);
    this.timer = window.setInterval(() => {
      if (--this.remaining <= 0) {
        this.reset(seconds);
        tick();
      }
    }, 1000);
  }
  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

export class PageActivity {
  private lastActivity: number;
  constructor(private now: () => number = Date.now) {
    this.lastActivity = now();
  }
  record = () => {
    this.lastActivity = this.now();
  };
  idle(hidden: boolean) {
    return (
      hidden || this.now() - this.lastActivity > AUTO_REFRESH_IDLE_LIMIT_MS
    );
  }
  start(scope: Lifetime) {
    const events = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
      "scroll",
    ] as const;
    for (const event of events)
      scope.listen(window, event, this.record, { passive: true });
    scope.listen(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") this.record();
    });
  }
}
