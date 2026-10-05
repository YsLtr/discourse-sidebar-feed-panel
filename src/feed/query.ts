import type { CategoryPathEntry, FeedQuerySnapshot } from "./types";

export function buildCategoryPath(
  categoryId: number,
  getCategoryMeta: (id: number) => CategoryPathEntry | null,
) {
  const targetCategoryId = Number(categoryId);
  if (!Number.isFinite(targetCategoryId)) return "";

  const chain = [];
  const seen = new Set();
  let meta = getCategoryMeta(targetCategoryId);
  while (meta && !seen.has(meta.id)) {
    seen.add(meta.id);
    chain.unshift(meta);
    const parentId = Number(meta.parent_category_id);
    if (!Number.isFinite(parentId) || parentId === meta.id) break;
    meta = getCategoryMeta(parentId);
  }

  const slugs = chain
    .map((cat) => cat.slug)
    .filter((slug): slug is string => !!slug);
  if (slugs.length === 0) slugs.push("category");
  return `/c/${slugs.map((slug) => encodeURIComponent(slug)).join("/")}/${targetCategoryId}`;
}

export function _needsPeriodForUrl(order: string) {
  return ["views", "posts", "likes", "op_likes"].includes(order);
}

export function _usesPeriodScopedTopList(order: string, period: string) {
  return period !== "all" && _needsPeriodForUrl(order);
}

export function feedQueryKey(query: FeedQuerySnapshot) {
  return [
    query.tab,
    query.categoryId || "",
    query.order,
    query.period,
    query.filter,
  ].join("|");
}

export function buildFeedUrl(
  query: FeedQuerySnapshot,
  page: number,
  getCategoryMeta: (id: number) => CategoryPathEntry | null,
) {
  const useTopList = _usesPeriodScopedTopList(query.order, query.period);

  // Discourse 的 top 周期只在 /top.json 或分类 /l/top.json 上有完整语义。
  // period=all 的“最多浏览/回复/点赞”等排序继续走 latest.json?order=...，
  // 保留此前版本的 ranked order 行为。
  if (query.tab !== "all" && query.categoryId) {
    const categoryPath = buildCategoryPath(query.categoryId, getCategoryMeta);
    const params = [`page=${page}`, "include_subcategories=true"];
    if (useTopList) {
      params.push(`period=${encodeURIComponent(query.period)}`);
      params.push(`order=${encodeURIComponent(query.order)}`);
      return `${categoryPath}/l/top.json?${params.join("&")}`;
    }

    params.push(`order=${encodeURIComponent(query.order)}`);
    return `${categoryPath}/l/latest.json?${params.join("&")}`;
  }

  if (useTopList) {
    const params = [
      `period=${encodeURIComponent(query.period)}`,
      `order=${encodeURIComponent(query.order)}`,
      `page=${page}`,
    ];
    return `/top.json?${params.join("&")}`;
  }

  const params = [`order=${encodeURIComponent(query.order)}`, `page=${page}`];
  if (query.period !== "all" && _needsPeriodForUrl(query.order)) {
    params.push(`period=${encodeURIComponent(query.period)}`);
  }
  return `/latest.json?${params.join("&")}`;
}
