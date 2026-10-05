import { _needsPeriodForUrl } from "./query";
import type { FeedQuerySnapshot, Topic } from "./types";

export function markUnavailable(topic: Topic) {
  if (!topic || topic.sfpUnavailable) return false;
  topic.sfpUnavailable = true;
  topic.sfpUnavailablePushed = 0;
  return true;
}

export function sortKey(topic: Topic, order: string) {
  if (!topic) return null;
  switch (order) {
    case "created": {
      const created = Date.parse(topic.created_at || "");
      return Number.isFinite(created) ? created : null;
    }
    case "views":
      return Number.isFinite(topic.views) ? topic.views! : null;
    case "posts":
      return Number.isFinite(topic.posts_count) ? topic.posts_count! : null;
    case "likes":
      return Number.isFinite(topic.like_count) ? topic.like_count! : null;
    case "op_likes":
      return Number.isFinite(topic.op_like_count) ? topic.op_like_count! : null;
    case "activity":
    default: {
      const bumped = Date.parse(topic.bumped_at || "");
      return Number.isFinite(bumped) ? bumped : null;
    }
  }
}

export function interleaveUnavailableTopics(
  allTopics: Topic[],
  query: FeedQuerySnapshot,
  freshLength: number,
) {
  if (allTopics.length <= freshLength) return;

  const anomalies: Topic[] = [];
  for (let index = allTopics.length - 1; index >= freshLength; index--) {
    if (allTopics[index]?.sfpUnavailable) {
      anomalies.unshift(allTopics.splice(index, 1)[0]);
    }
  }
  if (anomalies.length === 0) return;

  // activity/default 排序中置顶会浮到头部且排序键可能很旧，插入扫描
  // 时跳过它们，避免异常话题被插到置顶块之前。
  const pinnedFloats =
    !query?.order || ["activity", "default"].includes(query.order);
  for (const anomaly of anomalies) {
    const keyValue = sortKey(anomaly, query.order);
    let insertIndex = 0;
    if (keyValue !== null) {
      while (insertIndex < allTopics.length) {
        const resident = allTopics[insertIndex];
        if (pinnedFloats && (resident.pinned || resident.pinned_globally)) {
          insertIndex++;
          continue;
        }
        const residentKey = sortKey(resident, query.order);
        if (residentKey !== null && residentKey < keyValue) break;
        insertIndex++;
      }
    }
    allTopics.splice(insertIndex, 0, anomaly);
  }
}

export function detectVanishedTopics(
  allTopics: readonly Topic[],
  rawTopics: readonly Topic[],
  query: FeedQuerySnapshot,
) {
  if (!Array.isArray(rawTopics) || rawTopics.length === 0) return;
  if (allTopics.length === 0) return;
  // 周期榜（top.json?period=...）按“周期内有活动”过滤成员，话题可能
  // 只因活动滚出周期而离开窗口，排序键比较会误标，因此只在 period=all
  // 的纯排序（latest.json?order=...）上检测。
  if (_needsPeriodForUrl(query.order) && query.period !== "all") return;

  const pinnedFloats =
    !query.order || ["activity", "default"].includes(query.order);
  const newTopicIds = new Set(
    rawTopics.map((topic) => Number(topic?.id)).filter(Number.isFinite),
  );

  let windowMinKeyValue: number | null = null;
  for (const topic of rawTopics) {
    if (pinnedFloats && (topic?.pinned || topic?.pinned_globally)) continue;
    const keyValue = sortKey(topic, query.order);
    if (keyValue === null) continue;
    if (windowMinKeyValue === null || keyValue < windowMinKeyValue) {
      windowMinKeyValue = keyValue;
    }
  }
  // 窗口内没有可比较的话题时无法判断，宁可漏报也不误标。
  if (windowMinKeyValue === null) return;

  // 只检查上一次 page-0 窗口内的条目；加载更多拉进来的深页条目
  // 本来就不在 page-0 语义内，缺失是正常现象。
  const candidateWindow = Math.min(rawTopics.length, allTopics.length);
  for (let index = 0; index < candidateWindow; index++) {
    const topic = allTopics[index];
    if (!topic || newTopicIds.has(Number(topic.id))) continue;
    if (pinnedFloats && (topic.pinned || topic.pinned_globally)) continue;
    if (topic.sfpUnavailable) continue;
    const keyValue = sortKey(topic, query.order);
    // 排序键相同（同一秒/同一计数）时顺序不确定，只用严格更新的
    // 键做判断，避免误标。
    if (keyValue === null || keyValue <= windowMinKeyValue) continue;
    markUnavailable(topic);
  }
}
