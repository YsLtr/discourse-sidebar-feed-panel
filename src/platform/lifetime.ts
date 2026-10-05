/** Owns effects, including callbacks queued before disposal. No module-level effects. */
export class Lifetime {
  private cleanups = new Set<() => void>();
  private timeouts = new Set<number>();
  private frames = new Set<number>();
  private ended = false;
  private aborter = new AbortController();
  get disposed() {
    return this.ended;
  }
  get signal() {
    return this.aborter.signal;
  }
  defer(cleanup: () => void) {
    if (this.ended) {
      cleanup();
      return () => {};
    }
    this.cleanups.add(cleanup);
    return () => {
      this.cleanups.delete(cleanup);
    };
  }
  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void;
  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    fn: (event: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void;
  listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    fn: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void;
  listen(
    target: EventTarget,
    type: string,
    fn: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (this.ended) return () => {};
    target.addEventListener(type, fn, options);
    const cleanup = () => target.removeEventListener(type, fn, options);
    const forget = this.defer(cleanup);
    return () => {
      cleanup();
      forget();
    };
  }
  timeout(fn: () => void, ms: number) {
    if (this.ended) return 0;
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      if (!this.ended) fn();
    }, ms);
    this.timeouts.add(id);
    return id;
  }
  clearTimeout(id: number) {
    window.clearTimeout(id);
    this.timeouts.delete(id);
  }
  frame(fn: FrameRequestCallback) {
    if (this.ended) return 0;
    const id = window.requestAnimationFrame((time) => {
      this.frames.delete(id);
      if (!this.ended) fn(time);
    });
    this.frames.add(id);
    return id;
  }
  cancelFrame(id: number) {
    window.cancelAnimationFrame(id);
    this.frames.delete(id);
  }
  dispose() {
    if (this.ended) return;
    this.ended = true;
    this.aborter.abort();
    for (const cleanup of [...this.cleanups].reverse()) cleanup();
    this.cleanups.clear();
    for (const id of this.timeouts) window.clearTimeout(id);
    for (const id of this.frames) window.cancelAnimationFrame(id);
    this.timeouts.clear();
    this.frames.clear();
  }
}
