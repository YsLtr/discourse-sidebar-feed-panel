/** 语言版本表保留的语言数:当前语言 + 上一个语言。 */
export const MAX_CACHED_LOCALES = 2;

/** 写入当前语言的那一份,并按 savedAt 剪枝到 MAX_CACHED_LOCALES 个语言。 */
export function withLocaleEntry<T extends { savedAt: number }>(
  locales: Record<string, T> | undefined,
  locale: string,
  entry: T,
) {
  const next: Record<string, T> = { ...locales, [locale]: entry };
  const keys = Object.keys(next);
  if (keys.length <= MAX_CACHED_LOCALES) return next;
  keys
    .sort((a, b) => (next[a].savedAt || 0) - (next[b].savedAt || 0))
    .slice(0, keys.length - MAX_CACHED_LOCALES)
    .forEach((key) => delete next[key]);
  return next;
}
