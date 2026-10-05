import {
  AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS,
  AUTO_LOAD_MAX_REQUESTS_PER_WINDOW,
  AUTO_LOAD_RATE_WINDOW_MS,
} from "../constants";

/** The rate limit belongs to a query, never to the next query's first page. */
export class AutoLoadGate {
  private key = "";
  private timestamps: number[] = [];
  private emptyCount = 0;
  private stopped = false;
  constructor(private now: () => number = Date.now) {}
  reset(key: string) {
    this.key = key;
    this.timestamps = [];
    this.emptyCount = 0;
    this.stopped = false;
  }
  private ensure(key: string) {
    if (this.key !== key) this.reset(key);
  }
  canRun(key: string) {
    this.ensure(key);
    if (this.stopped) return false;
    this.timestamps = this.timestamps.filter(
      (time) => this.now() - time < AUTO_LOAD_RATE_WINDOW_MS,
    );
    return this.timestamps.length < AUTO_LOAD_MAX_REQUESTS_PER_WINDOW;
  }
  recordRequest(key: string) {
    this.ensure(key);
    this.timestamps.push(this.now());
  }
  recordResult(key: string, count: number) {
    this.ensure(key);
    this.emptyCount = count > 0 ? 0 : this.emptyCount + 1;
    if (this.emptyCount >= AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS)
      this.stopped = true;
  }
}
