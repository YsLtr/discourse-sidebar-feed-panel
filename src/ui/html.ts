export function escapeHtml(text: unknown) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

export function escapeAttr(text: unknown) {
  return escapeHtml(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
