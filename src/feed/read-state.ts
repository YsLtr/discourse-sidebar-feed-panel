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

// Discourse NotificationLevels.TRACKING。关注第一帖（4）也按跟踪处理，
// 与 Discourse 自身 `notification_level >= TRACKING` 的判定一致。
const TRACKING_LEVEL = 2;

/**
 * 跟踪/关注的话题用「新回复数」顶替未读圆点。
 *
 * 服务端只对跟踪以上级别算 `unread_posts`（静音/常规恒为 0），且从未打开过的
 * 话题 `last_read_post_number` 为空，同样为 0——那种情况继续走圆点。
 */
export function _unreadReplyCount(topic: TopicReadState) {
  if (!(Number(topic.notification_level) >= TRACKING_LEVEL)) return 0;
  const count = Number(topic.unread_posts) || Number(topic.new_posts) || 0;
  return count > 0 ? count : 0;
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
