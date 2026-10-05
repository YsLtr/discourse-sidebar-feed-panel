import { _normalizeHexColor, _safeIconName } from "../site/appearance";
export function _svgIcon(icon: unknown, extraClass = "") {
  const safeIcon = _safeIconName(icon);
  if (!safeIcon) return "";
  const className = `fa d-icon d-icon-${safeIcon} svg-icon fa-width-auto svg-string${extraClass ? ` ${extraClass}` : ""}`;
  return `<svg class="${className}" width="1em" height="1em" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#${safeIcon}"></use></svg>`;
}

export function _categoryColorMarkerHtml(color: unknown) {
  return `<span class="sfp-category-color-marker" style="--sfp-category-marker-color:#${_normalizeHexColor(color, "888")}" aria-hidden="true"></span>`;
}
