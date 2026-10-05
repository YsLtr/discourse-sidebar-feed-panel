import type { TopicReadState } from "./types";

export function _topicBaseUrl(topic: TopicReadState) {
  const slug = topic.slug || "topic";
  return `/t/${slug}/${topic.id}`;
}

export function _isPinnedTopic(topic: TopicReadState) {
  return !!(topic && (topic.pinned || topic.pinned_globally));
}

export function _hasLastReadPostNumber(topic: TopicReadState) {
  return (
    topic.last_read_post_number !== null &&
    topic.last_read_post_number !== undefined &&
    topic.last_read_post_number !== ""
  );
}

export function _topicListUrl(topic: TopicReadState) {
  const baseUrl = _topicBaseUrl(topic);
  if (!_hasLastReadPostNumber(topic)) return baseUrl;

  const lastRead = Number(topic.last_read_post_number);
  const highest = Number(topic.highest_post_number);
  if (!Number.isFinite(lastRead)) return baseUrl;

  let postNumber = lastRead + 1;
  if (Number.isFinite(highest) && postNumber > highest) {
    postNumber = highest;
  }
  if (postNumber < 1) postNumber = 1;
  return `${baseUrl}/${postNumber}`;
}

export function _isTopicRead(topic: TopicReadState) {
  if (!topic || !topic.id) return false;
  const baseUrl = _topicBaseUrl(topic);
  const url = _topicListUrl(topic);
  return url !== baseUrl && url.startsWith(`${baseUrl}/`);
}

export function _hasUnreadMarker(topic: TopicReadState) {
  return !_isTopicRead(topic);
}

export function _applyReadMarker(topic: TopicReadState) {
  topic.unread_posts = 0;
  topic.new_posts = 0;
  topic.unseen = false;
  topic.is_seen = true;
  if (topic.highest_post_number) {
    topic.last_read_post_number = topic.highest_post_number;
  }
}
