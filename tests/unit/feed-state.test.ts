import { describe, expect, it } from "vitest";
import { ResidentTopics } from "../../src/feed/resident";
import { IncomingTopics } from "../../src/feed/incoming";
import { AutoLoadGate } from "../../src/feed/auto-load";
import { ReadingState } from "../../src/feed/reading";
import { PageActivity } from "../../src/feed/refresh";
import { detectVanishedTopics } from "../../src/feed/unavailable";
import { _isTopicRead } from "../../src/feed/read-state";
import {
  AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS,
  AUTO_LOAD_MAX_REQUESTS_PER_WINDOW,
  AUTO_LOAD_RATE_WINDOW_MS,
  AUTO_REFRESH_IDLE_LIMIT_MS,
} from "../../src/constants";
import type { FeedQuerySnapshot, Topic } from "../../src/feed/types";

const query: FeedQuerySnapshot = {
  tab: "all",
  categoryId: null,
  order: "views",
  period: "all",
  filter: "all",
};
const topic = (id: number, views = id): Topic => ({
  id,
  views,
  highest_post_number: 4,
  posters: [{ user_id: id }],
  unseen: true,
});

describe("resident ownership", () => {
  it("appends without trimming, then resets refresh depth, releases IDs and prunes display users", () => {
    const state = new ResidentTopics();
    state.addUsers([1, 2, 3, 4, 5].map((id) => ({ id, username: String(id) })));
    state.loadHead([topic(5), topic(4)], 2, "/latest.json?page=80");
    expect(
      state.append([topic(4), topic(3), topic(2)], "/next").map((t) => t.id),
    ).toEqual([3, 2]);
    expect(state.page).toBe(1);
    expect(state.limit).toBe(4);
    expect(state.topics).toHaveLength(4);
    state.markRead(state.topics[0]);
    expect(
      state.merge([topic(5), topic(4)], {
        mode: "replace-head",
        moreTopicsUrl: "/next",
      }),
    ).toEqual([]);
    expect(state.page).toBe(0);
    expect(state.has(3)).toBe(false);
    expect(Object.keys(state.users).sort()).toEqual(["4", "5"]);
    expect(_isTopicRead(state.topics[0])).toBe(true);
    expect(state.append([topic(3), topic(2)], "/next")).toHaveLength(2);
  });

  it("keeps unavailable topics in order without consuming capacity; only new entrants age them", () => {
    const state = new ResidentTopics();
    state.loadHead([topic(9), topic(8)], 2, "/next");
    state.lifecycle({ message_type: "delete", topic_id: 9 });
    state.merge([topic(8), topic(7)], {
      mode: "replace-head",
      sortQuery: query,
      moreTopicsUrl: "/next",
    });
    expect(state.topics.map((t) => t.id)).toEqual([9, 8, 7]);
    expect(state.topics[0].sfpUnavailablePushed).toBe(1);
    state.merge([topic(8), topic(7)], {
      mode: "replace-head",
      sortQuery: query,
    });
    expect(state.has(9)).toBe(true);
    state.merge([topic(10)], { mode: "prepend" });
    expect(state.has(9)).toBe(false);
    expect(state.topics.map((t) => t.id)).toEqual([10, 8]);
  });

  it("recovers an unavailable topic and clears all retained state on query reset", () => {
    const state = new ResidentTopics();
    state.loadHead([topic(1)], 1, "/next");
    expect(state.lifecycle({ message_type: "destroy", topic_id: "1" })).toBe(
      true,
    );
    expect(state.lifecycle({ message_type: "recover", topic_id: 1 })).toBe(
      true,
    );
    expect(state.topics[0].sfpUnavailable).toBe(false);
    state.reset();
    expect(state.has(1)).toBe(false);
    expect(state.topics).toEqual([]);
    expect(state.users).toEqual({});
    expect(state.page).toBe(0);
  });

  it("ignores missing lifecycle messages and invalid IDs even with resident topics", () => {
    const state = new ResidentTopics();
    state.loadHead([topic(1)], 1, "/next");
    for (const message of [
      null,
      undefined,
      {},
      { message_type: "delete" },
      ...["", "bad", NaN, Infinity, 0].map((topic_id) => ({
        message_type: "delete",
        topic_id,
      })),
    ]) {
      expect(state.lifecycle(message)).toBe(false);
      expect(state.topics[0].sfpUnavailable).toBeUndefined();
    }
    expect(state.lifecycle({ message_type: "delete", topic_id: "1" })).toBe(true);
  });
});

describe("vanished head detection", () => {
  it("distinguishes a missing in-window topic from ordinary sinking, ties and deeper pages", () => {
    const old = [topic(9), topic(8), topic(7), topic(99)];
    detectVanishedTopics(old, [topic(10), topic(9), topic(6)], query);
    expect(old.map((t) => !!t.sfpUnavailable)).toEqual([
      false,
      true,
      true,
      false,
    ]);
    const sinking = [topic(9), topic(8), topic(7)];
    detectVanishedTopics(sinking, [topic(10), topic(9), topic(8)], query);
    expect(sinking.some((t) => t.sfpUnavailable)).toBe(false);
    const tie = [topic(7, 8)];
    detectVanishedTopics(tie, [topic(8, 8)], query);
    expect(tie[0].sfpUnavailable).toBeUndefined();
  });
  it("exempts period membership changes and floating pinned topics", () => {
    const old = [topic(9)];
    detectVanishedTopics(old, [topic(8)], { ...query, period: "weekly" });
    expect(old[0].sfpUnavailable).toBeUndefined();
    const pinned = [{ ...topic(9), pinned: true, bumped_at: "2026-10-05" }];
    detectVanishedTopics(pinned, [{ ...topic(8), bumped_at: "2026-10-04" }], {
      ...query,
      order: "activity",
    });
    expect(pinned[0].sfpUnavailable).toBeUndefined();
  });
});

describe("incoming candidates", () => {
  it("counts accumulated matches, loads only the newest page and retains unknown payloads", () => {
    const incoming = new IncomingTopics();
    for (let id = 1; id <= 7; id++)
      incoming.touch(id, { category_id: id === 3 ? 99 : 1 });
    incoming.touch(8);
    incoming.recompute(true, (t) => t.category_id === 1);
    expect(incoming.matchingIds).toHaveLength(7);
    expect(incoming.loadIds(3)).toEqual([6, 7, 8]);
    incoming.touch(2, { title: "updated" });
    incoming.recompute(true, (t) => t.category_id === 1);
    expect(incoming.loadIds(3)).toEqual([7, 8, 2]);
    expect(incoming.get(2)?.category_id).toBe(1);
    incoming.remove([7, 8, 2]);
    expect(incoming.matchingIds).toEqual([1, 4, 5, 6]);
    incoming.clear();
    expect(incoming.ids).toEqual([]);
    expect(incoming.get(2)).toBeUndefined();
  });

  it("keeps unique candidate order and payloads consistent after removals and reset", () => {
    const incoming = new IncomingTopics();
    incoming.touch(1, { category_id: 2, title: "first" });
    incoming.touch(2, { category_id: 3 });
    incoming.touch("1", { title: "updated" });
    expect(incoming.ids).toEqual([2, 1]);
    expect(incoming.get(1)).toEqual({ id: 1, category_id: 2, title: "updated" });

    incoming.remove([1]);
    incoming.touch(1, { title: "reentered" });
    incoming.touch(3);
    incoming.touch(1);
    expect(incoming.ids).toEqual([2, 3, 1]);
    expect(incoming.get(1)).toEqual({ id: 1, title: "reentered" });
    incoming.recompute(true, () => true);
    expect(incoming.loadIds(2)).toEqual([3, 1]);

    incoming.clear();
    incoming.touch(1);
    incoming.touch(2);
    incoming.touch(1);
    expect(incoming.ids).toEqual([2, 1]);
    expect(incoming.get(1)).toBeUndefined();
  });
});

describe("automatic gates", () => {
  it("isolates rate windows and the latched empty-result stop by query", () => {
    let now = 0;
    const gate = new AutoLoadGate(() => now);
    for (let i = 0; i < AUTO_LOAD_MAX_REQUESTS_PER_WINDOW; i++)
      gate.recordRequest("A");
    expect(gate.canRun("A")).toBe(false);
    now += AUTO_LOAD_RATE_WINDOW_MS;
    expect(gate.canRun("A")).toBe(true);
    for (let i = 0; i < AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS; i++)
      gate.recordResult("A", 0);
    gate.recordResult("A", 5);
    expect(gate.canRun("A")).toBe(false);
    expect(gate.canRun("B")).toBe(true);
    expect(gate.canRun("A")).toBe(true);
  });
  it("keeps reading state latched until the actual head; activity and visibility gate independently", () => {
    const reading = new ReadingState();
    expect(reading.isAway(100, 500)).toBe(false);
    reading.away = reading.isAway(501, 500);
    expect(reading.isAway(100, 500)).toBe(true);
    expect(reading.isAway(1, 500)).toBe(false);
    expect(reading.atHead(2)).toBe(false);
    let now = 0;
    const activity = new PageActivity(() => now);
    expect(activity.idle(true)).toBe(true);
    now = AUTO_REFRESH_IDLE_LIMIT_MS + 1;
    expect(activity.idle(false)).toBe(true);
    activity.record();
    expect(activity.idle(false)).toBe(false);
  });
});
