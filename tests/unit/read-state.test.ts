import { describe, expect, it } from "vitest";
import {
  _isTopicRead,
  _topicListUrl,
  _applyReadMarker,
  _unreadReplyCount,
} from "../../src/feed/read-state";
import type { TopicReadState } from "../../src/feed/types";

describe("shared read-state and navigation rules", () => {
  it("does not equate unseen:false with reading progress", () => {
    expect(_isTopicRead({ id: 1, unseen: false })).toBe(false);
    expect(_isTopicRead({ id: 1, last_read_post_number: 0 })).toBe(true);
    expect(_isTopicRead({ id: 1, last_read_post_number: "" })).toBe(false);
  });
  it("bounds resume URLs and tolerates malformed progress", () => {
    expect(
      _topicListUrl({
        id: 1,
        slug: "hello",
        last_read_post_number: 4,
        highest_post_number: 5,
      }),
    ).toBe("/t/hello/1/5");
    expect(
      _topicListUrl({
        id: 1,
        last_read_post_number: 5,
        highest_post_number: 5,
      }),
    ).toBe("/t/topic/1/5");
    expect(_topicListUrl({ id: 1, last_read_post_number: -4 })).toBe(
      "/t/topic/1/1",
    );
    expect(_topicListUrl({ id: 1, last_read_post_number: "broken" })).toBe(
      "/t/topic/1",
    );
  });
  it("applies the same local read marker used during refresh merging", () => {
    const topic: TopicReadState = {
      id: 1,
      highest_post_number: 8,
      unseen: true,
      unread_posts: 3,
    };
    _applyReadMarker(topic);
    expect(topic).toMatchObject({
      last_read_post_number: 8,
      unseen: false,
      unread_posts: 0,
      new_posts: 0,
      is_seen: true,
    });
    expect(_isTopicRead(topic)).toBe(true);
  });
});

describe("unread marker for tracked topics", () => {
  it("only tracking and watching levels replace the dot with a reply count", () => {
    const base = { id: 1, unread_posts: 3, last_read_post_number: 1 };
    expect(_unreadReplyCount({ ...base, notification_level: 1 })).toBe(0);
    expect(_unreadReplyCount({ ...base, notification_level: 0 })).toBe(0);
    expect(_unreadReplyCount({ ...base, notification_level: 2 })).toBe(3);
    expect(_unreadReplyCount({ ...base, notification_level: 3 })).toBe(3);
    expect(_unreadReplyCount({ ...base, notification_level: 4 })).toBe(3);
  });
  it("falls back to the dot when the payload has no count or no level", () => {
    expect(_unreadReplyCount({ id: 1, unread_posts: 3 })).toBe(0);
    expect(_unreadReplyCount({ id: 1, notification_level: 2 })).toBe(0);
    expect(
      _unreadReplyCount({
        id: 1,
        notification_level: 2,
        unread_posts: 0,
        new_posts: 2,
      }),
    ).toBe(2);
    expect(
      _unreadReplyCount({
        id: 1,
        notification_level: 2,
        unread_posts: 0,
        new_posts: 0,
      }),
    ).toBe(0);
  });
});
