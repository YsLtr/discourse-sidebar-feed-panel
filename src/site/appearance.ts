const SAFE_ICON_RE = /^[A-Za-z0-9_-]+$/;
const SAFE_COLOR_RE = /^#?[A-Fa-f0-9]{3,8}$/;

export function _normalizeHexColor(color: unknown, fallback = "888") {
  if (!color) return fallback;
  const raw = String(color).trim();
  if (!SAFE_COLOR_RE.test(raw)) return fallback;
  return raw.startsWith("#") ? raw.slice(1) : raw;
}

export function _isSafeIconName(icon: unknown): icon is string {
  return typeof icon === "string" && SAFE_ICON_RE.test(icon);
}

export function _safeIconName(icon: unknown) {
  return _isSafeIconName(icon) ? icon : "";
}

export function _safeCategoryStyleType(
  styleType: string | undefined,
  hasIcon: boolean,
) {
  return ["icon", "emoji", "square"].includes(styleType || "")
    ? styleType
    : hasIcon
      ? "icon"
      : "square";
}
