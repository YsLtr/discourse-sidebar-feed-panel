import { _applyReadMarker, _isTopicRead } from "./read-state";
import type {
  FeedQuerySnapshot,
  Topic,
  TopicMessage,
  TopicUser,
} from "./types";
import {
  detectVanishedTopics,
  interleaveUnavailableTopics,
  markUnavailable,
} from "./unavailable";

export interface MergeOptions {
  mode?: "prepend" | "replace-head";
  moreTopicsUrl?: string | null;
  resetFeedDepth?: boolean;
  sortQuery?: FeedQuerySnapshot | null;
}

/** Owns resident data and pagination. No DOM, GM, timers or requests. */
export class ResidentTopics {
  private retained: Topic[] = [];
  private displayUsers: Record<number, TopicUser> = {};
  private loaded = new Set<number>();
  private depth = 0;
  private size = 30;
  private more = true;

  get topics(): readonly Topic[] {
    return this.retained;
  }
  get users(): Readonly<Record<number, TopicUser>> {
    return this.displayUsers;
  }
  get page() {
    return this.depth;
  }
  get pageSize() {
    return this.size;
  }
  get hasMore() {
    return this.more;
  }
  get limit() {
    return Math.max(1, this.size) * (Math.max(0, this.depth) + 1);
  }
  has(id: number) {
    return this.loaded.has(id);
  }

  reset({ clearUsers = true } = {}) {
    this.retained = [];
    if (clearUsers) this.displayUsers = {};
    this.loaded.clear();
    this.depth = 0;
    this.more = true;
  }

  addUsers(users: readonly TopicUser[] = []) {
    for (const user of users) this.displayUsers[user.id] = user;
  }

  loadHead(
    topics: Topic[],
    rawPageSize: number,
    moreTopicsUrl?: string | null,
  ) {
    this.retained = topics;
    this.loaded = new Set(topics.map((topic) => topic.id));
    this.size = rawPageSize;
    this.depth = 0;
    this.more = !!moreTopicsUrl;
  }

  endPages() {
    this.more = false;
  }

  append(topics: readonly Topic[], moreTopicsUrl?: string | null) {
    this.depth++;
    this.more = !!moreTopicsUrl;
    const added = topics.filter((topic) => {
      if (this.loaded.has(topic.id)) return false;
      this.loaded.add(topic.id);
      return true;
    });
    this.retained = this.retained.concat(added);
    return added;
  }

  markRead(topic: Topic) {
    if (_isTopicRead(topic)) return false;
    _applyReadMarker(topic);
    const resident = this.retained.find(
      (candidate) => candidate.id === topic.id,
    );
    if (resident && resident !== topic) _applyReadMarker(resident);
    return true;
  }

  lifecycle(message: TopicMessage | null | undefined) {
    if (!message?.topic_id) return false;
    const topicId = Number(message.topic_id);
    if (!Number.isFinite(topicId)) return false;
    const topic = this.retained.find(
      (candidate) => candidate.id === topicId,
    );
    if (!topic) return false;
    if (message.message_type === "recover") {
      if (!topic.sfpUnavailable) return false;
      topic.sfpUnavailable = false;
      delete topic.sfpUnavailablePushed;
      return true;
    }
    return (
      ["delete", "destroy"].includes(message.message_type || "") &&
      markUnavailable(topic)
    );
  }

  detectVanished(rawTopics: readonly Topic[], query: FeedQuerySnapshot) {
    detectVanishedTopics(this.retained, rawTopics, query);
  }

  private rebuildUsers() {
    const next: Record<number, TopicUser> = {};
    for (const topic of this.retained) {
      const id = topic.posters?.[0]?.user_id;
      if (id !== undefined && this.displayUsers[id])
        next[id] = this.displayUsers[id];
    }
    this.displayUsers = next;
  }

  private expireUnavailable(newEntrants: number) {
    if (!newEntrants) return;
    const expired = new Set<number>();
    for (const topic of this.retained) {
      if (!topic.sfpUnavailable) continue;
      topic.sfpUnavailablePushed =
        (topic.sfpUnavailablePushed || 0) + newEntrants;
      if (topic.sfpUnavailablePushed >= this.limit) expired.add(topic.id);
    }
    if (!expired.size) return;
    this.retained = this.retained.filter((topic) => !expired.has(topic.id));
    expired.forEach((id) => this.loaded.delete(id));
    this.rebuildUsers();
  }

  private trim() {
    let kept = 0;
    const trimmed: number[] = [];
    this.retained = this.retained.filter((topic) => {
      if (topic.sfpUnavailable) return true;
      if (kept++ < this.limit) return true;
      trimmed.push(topic.id);
      return false;
    });
    if (!trimmed.length) return;
    trimmed.forEach((id) => this.loaded.delete(id));
    this.rebuildUsers();
  }

  merge(topics: readonly Topic[], options: MergeOptions = {}): number[] | null {
    if (!topics.length) return null;
    const {
      mode = "prepend",
      resetFeedDepth = true,
      moreTopicsUrl,
      sortQuery,
    } = options;
    const fetched = new Map(topics.map((topic) => [topic.id, topic]));
    // A response begun before a local click must not undo that click's read state.
    for (const resident of this.retained) {
      const replacement = fetched.get(resident.id);
      if (replacement && _isTopicRead(resident) && !_isTopicRead(replacement))
        _applyReadMarker(replacement);
    }
    if (resetFeedDepth) this.depth = 0;
    const highlights = topics
      .filter((topic) => mode === "prepend" || !this.loaded.has(topic.id))
      .map((topic) => topic.id);
    this.retained = [
      ...topics,
      ...this.retained.filter((topic) => !fetched.has(topic.id)),
    ];
    if (mode === "replace-head") {
      if (sortQuery)
        interleaveUnavailableTopics(this.retained, sortQuery, topics.length);
      this.more = !!moreTopicsUrl;
    } else if (resetFeedDepth)
      this.more = this.retained.length >= Math.max(1, this.size);
    const entrants = topics.filter(
      (topic) => !this.loaded.has(topic.id),
    ).length;
    topics.forEach((topic) => this.loaded.add(topic.id));
    this.expireUnavailable(entrants);
    this.trim();
    return highlights;
  }
}
