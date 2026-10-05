import type { Topic } from "./types";

/** Candidate counts accumulate; only the most recent page is fetched for details. */
export class IncomingTopics {
  private candidates: number[] = [];
  private candidateIds = new Set<number>();
  private cache = new Map<number, Topic>();
  private filtered: number[] = [];
  get ids(): readonly number[] {
    return this.candidates;
  }
  get matchingIds(): readonly number[] {
    return this.filtered;
  }
  get(id: number) {
    return this.cache.get(id);
  }
  clear() {
    this.candidates = [];
    this.candidateIds.clear();
    this.cache.clear();
    this.filtered = [];
  }
  touch(id: number | string, payload?: Partial<Topic>) {
    const numeric = Number(id);
    if (!Number.isFinite(numeric)) return false;
    // A message-bus batch can contain many new IDs before its apply microtask.
    // Append those without rescanning the accumulated candidate list.
    if (this.candidateIds.has(numeric)) {
      const index = this.candidates.indexOf(numeric);
      if (index !== -1) this.candidates.splice(index, 1);
    } else {
      this.candidateIds.add(numeric);
    }
    this.candidates.push(numeric);
    if (payload)
      this.cache.set(numeric, {
        ...this.cache.get(numeric),
        ...payload,
        id: numeric,
      });
    return true;
  }
  recompute(enabled: boolean, matches: (topic: Topic) => boolean) {
    this.filtered = enabled
      ? this.candidates.filter((id) => {
          const topic = this.cache.get(id);
          return !topic || matches(topic);
        })
      : [];
    return this.filtered;
  }
  loadIds(pageSize: number) {
    return this.filtered.slice(-Math.max(1, pageSize));
  }
  remove(ids: readonly number[]) {
    const removed = new Set(ids.map(Number).filter(Number.isFinite));
    this.candidates = this.candidates.filter((id) => !removed.has(id));
    this.filtered = this.filtered.filter((id) => !removed.has(id));
    removed.forEach((id) => {
      this.candidateIds.delete(id);
      this.cache.delete(id);
    });
  }
}
