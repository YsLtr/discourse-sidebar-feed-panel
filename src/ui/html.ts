export function escapeHtml(text: unknown) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

export function escapeAttr(text: unknown) {
  return escapeHtml(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * `fancy_title` 是服务端已转义的文本(可含 `&#8220;` 一类实体),按纯文本渲染前先解码。
 */
export function decodeHtmlEntities(text: unknown) {
  if (!text) return "";
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(text);
  return textarea.value;
}

const EMOJI_SHORTCODE = /:[\w\-+]+:/;

/**
 * Topic Display Title:译文优先,但 `fancy_title` 里未展开的 `:shortcode:` 让位给原文的 `unicode_title`。
 */
export function selectTopicTitle(topic: {
  fancy_title?: string;
  unicode_title?: string;
  title?: string;
}) {
  const fancy = topic.fancy_title?.trim() || "";
  const unicode = topic.unicode_title?.trim() || "";
  if (fancy && !EMOJI_SHORTCODE.test(fancy)) return fancy;
  return unicode || fancy || topic.title?.trim() || "";
}
