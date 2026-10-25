import { objectPayload } from "../platform/json";
import type {
  FeedQuerySnapshot,
  Topic,
  TopicResponse,
  TopicUser,
} from "./types";

export function topicResponse(value: unknown): TopicResponse {
  const data = objectPayload<TopicResponse>(value) || {};
  const list = objectPayload<NonNullable<TopicResponse["topic_list"]>>(
    data.topic_list,
  );
  return {
    users: Array.isArray(data.users)
      ? data.users.filter(
          (user): user is TopicUser => !!user && Number.isFinite(user.id),
        )
      : [],
    topic_list: list
      ? {
          topics: Array.isArray(list.topics)
            ? list.topics.filter(
                (topic): topic is Topic => !!topic && Number.isFinite(topic.id),
              )
            : undefined,
          more_topics_url:
            typeof list.more_topics_url === "string"
              ? list.more_topics_url
              : null,
        }
      : undefined,
  };
}

export function createFeedApi({
  buildUrl,
  getCsrfToken,
  getSignal,
}: {
  buildUrl(query: FeedQuerySnapshot, page: number): string;
  getCsrfToken(): string;
  getSignal(): AbortSignal;
}) {
  async function request(url: string, signal: AbortSignal = getSignal()) {
    const response = await fetch(url, {
      headers: { "X-CSRF-Token": getCsrfToken() },
      signal,
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return topicResponse(await response.json());
  }
  return {
    page: (query: FeedQuerySnapshot, page: number) =>
      request(buildUrl(query, page)),
    byIds(ids: readonly number[], signal: AbortSignal = getSignal()) {
      const unique = [...new Set(ids.map(Number).filter(Number.isFinite))];
      return unique.length
        ? request(`/latest.json?topic_ids=${unique.join(",")}`, signal)
        : Promise.resolve(null);
    },
    /**
     * 单个话题的 TopicView（`/t/<id>.json`）。给 `/latest.json?topic_ids=`
     * 拿不回来的话题用：静音分类、未列出、私密都会在那里被剔掉。
     * 不回 `ok` 就抛错——调用方要按状态码区分「不存在」与「网络失败」。
     */
    async topicView(id: number, signal: AbortSignal = getSignal()) {
      const response = await fetch(`/t/${id}.json`, {
        headers: { "X-CSRF-Token": getCsrfToken() },
        signal,
      });
      if (!response.ok) return { status: response.status, json: null };
      const json = await response.json().catch(() => null);
      return { status: response.status, json };
    },
  };
}
