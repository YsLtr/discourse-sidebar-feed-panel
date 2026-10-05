import { TAG_STYLE_CACHE_VERSION } from "../constants";
import type { TopicTag } from "../feed/types";
import { Lifetime } from "../platform/lifetime";
import type { ValueStore } from "../preferences";
import { TAG_STYLE_CACHE_KEY } from "../storage-keys";
import { _safeIconName } from "./appearance";
import type { createSiteData } from "./site-data";
import type { SitePayload, TagStyle, TagStyleCache } from "./types";

export function createTagStyles({
  storage,
  site,
}: {
  storage: ValueStore;
  site: ReturnType<typeof createSiteData>;
}) {
  let scope = new Lifetime();
  const _getSiteValue = storage.get;
  const _setSiteValue = storage.set;
  const { loadSiteData, _extractPreloadedSiteData } = site;
  const tagStyleByKey = new Map<string, TagStyle>();
  let tagStylePromise: Promise<void> | null = null;
  let tagStyleLoaded = false;
  function _tagIndexKeys(tag: string | TopicTag) {
    const keys: string[] = [];
    const add = (value: unknown) => {
      if (value === null || value === undefined) return;
      const key = String(value).trim().toLowerCase();
      if (key && !keys.includes(key)) keys.push(key);
    };
    if (typeof tag === "string") {
      add(tag);
      return keys;
    }
    add(tag?.name);
    add(tag?.slug);
    add(tag?.text);
    add(tag?.id);
    return keys;
  }

  function _tagDisplayName(tag: string | TopicTag) {
    return typeof tag === "string"
      ? tag
      : tag?.name || tag?.text || tag?.slug || "";
  }

  function _normalizeTagRecord(tag: string | TopicTag) {
    if (typeof tag === "string") {
      const name = tag.trim();
      return name ? { name, slug: name } : null;
    }
    if (tag && typeof tag === "object") {
      const name = String(
        tag.name || tag.text || tag.slug || tag.id || "",
      ).trim();
      if (!name) return null;
      return {
        id: tag.id,
        name,
        slug: tag.slug || tag.name || name,
      };
    }
    const name = String(tag || "").trim();
    return name ? { name, slug: name } : null;
  }

  function _getTopTagsFromSiteData(site: SitePayload | null) {
    if (site?.can_tag_topics === false) return [];
    const topTags = Array.isArray(site?.top_tags) ? site.top_tags : [];
    return topTags
      .map(_normalizeTagRecord)
      .filter((tag): tag is NonNullable<typeof tag> => !!tag);
  }

  function _cacheTagStyleAliases(tags: Array<string | TopicTag>) {
    tags.forEach((tag) => {
      const style = _getTagStyle(tag);
      if (style) _cacheTagStyle(_tagIndexKeys(tag), style);
    });
  }

  function _getTagStyle(tag: string | TopicTag) {
    for (const key of _tagIndexKeys(tag)) {
      const style = tagStyleByKey.get(key);
      if (style) return style;
    }
    return null;
  }

  function _sanitizeTagStyle(styleText: unknown) {
    const pairs: string[] = [];
    String(styleText || "")
      .split(";")
      .forEach((part) => {
        const [rawName, rawValue] = part.split(":");
        const name = rawName?.trim();
        const value = rawValue?.trim();
        if (
          (name === "--color1" || name === "--color2") &&
          /^#[A-Fa-f0-9]{3,8}$/.test(value || "")
        ) {
          pairs.push(`${name}: ${value}`);
        }
      });
    return pairs.join("; ");
  }

  function _cacheTagStyle(keys: unknown[], style: TagStyle) {
    keys.forEach((key) => {
      const normalized = String(key || "")
        .trim()
        .toLowerCase();
      if (normalized) tagStyleByKey.set(normalized, style);
    });
  }

  function _loadTagStyleCache() {
    if (tagStyleByKey.size > 0) return true;

    try {
      const cache = _getSiteValue<TagStyleCache | null>(
        TAG_STYLE_CACHE_KEY,
        null,
      );
      if (
        !cache ||
        cache.version !== TAG_STYLE_CACHE_VERSION ||
        !Array.isArray(cache.entries)
      ) {
        return false;
      }

      cache.entries.forEach(([key, style]) => {
        if (!key || !style || typeof style !== "object") return;
        const icon = _safeIconName(style.icon || "");
        const cssText = _sanitizeTagStyle(style.cssText || "");
        if (!icon && !cssText) return;
        tagStyleByKey.set(String(key), {
          icon,
          cssText,
          hasIcon: !!icon,
        });
      });

      return tagStyleByKey.size > 0;
    } catch (e) {
      console.warn("[SFP] load tag style cache failed:", e);
      return false;
    }
  }

  function _saveTagStyleCache() {
    if (tagStyleByKey.size === 0) return;

    try {
      _setSiteValue(TAG_STYLE_CACHE_KEY, {
        version: TAG_STYLE_CACHE_VERSION,
        savedAt: Date.now(),
        entries: Array.from(tagStyleByKey.entries()),
      });
    } catch (e) {
      console.warn("[SFP] save tag style cache failed:", e);
    }
  }

  function _extractTagStylesFromDocument(doc: Document) {
    const anchors = Array.from(
      doc.querySelectorAll<HTMLAnchorElement>("a.discourse-tag[data-tag-name]"),
    );
    anchors.forEach((anchor) => {
      const use = anchor.querySelector("svg use");
      const icon = _safeIconName(
        (
          use?.getAttribute("href") ||
          use?.getAttribute("xlink:href") ||
          ""
        ).replace(/^#/, ""),
      );
      const style = {
        icon,
        cssText: _sanitizeTagStyle(anchor.getAttribute("style") || ""),
        hasIcon: !!icon,
      };
      if (!style.hasIcon && !style.cssText) return;

      const hrefParts = (anchor.getAttribute("href") || "")
        .split("/")
        .filter(Boolean);
      _cacheTagStyle(
        [
          anchor.dataset.tagName,
          anchor.textContent,
          hrefParts[1],
          hrefParts[2],
        ],
        style,
      );
    });
  }

  function _waitForIframeTags(
    iframe: HTMLIFrameElement,
    loadScope: Lifetime,
    timeoutMs = 12000,
  ) {
    return new Promise<Document | null>((resolve) => {
      const forget = loadScope.defer(() => resolve(null));
      const finish = (value: Document | null) => {
        forget();
        resolve(value);
      };
      const start = Date.now();
      const tick = () => {
        let doc = null;
        try {
          doc = iframe.contentDocument;
          if (doc && doc.querySelector("a.discourse-tag[data-tag-name]")) {
            finish(doc);
            return;
          }
        } catch (e) {
          finish(null);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          finish(doc);
          return;
        }
        loadScope.timeout(tick, 250);
      };
      tick();
    });
  }

  async function loadTagStyleIndex() {
    if (scope.disposed) return;
    if (tagStyleLoaded) return;
    if (tagStylePromise) return tagStylePromise;

    const loadScope = scope;
    tagStylePromise = (async () => {
      let iframe: HTMLIFrameElement | null = null;
      try {
        let siteTags: Array<string | TopicTag> = [];
        try {
          siteTags = _getTopTagsFromSiteData(await loadSiteData());
        } catch (e) {
          siteTags = _getTopTagsFromSiteData(_extractPreloadedSiteData());
        }

        if (loadScope.disposed) return;
        if (_loadTagStyleCache()) {
          _cacheTagStyleAliases(siteTags);
          tagStyleLoaded = true;
          return;
        }

        _extractTagStylesFromDocument(document);
        iframe = document.createElement("iframe");
        iframe.src = "/tags";
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.cssText =
          "position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;border:0;visibility:hidden;pointer-events:none;";
        document.body.appendChild(iframe);
        const forgetIframe = loadScope.defer(() => iframe?.remove());
        const doc = await _waitForIframeTags(iframe, loadScope);
        forgetIframe();
        if (loadScope.disposed) return;
        if (doc) _extractTagStylesFromDocument(doc);

        _cacheTagStyleAliases(siteTags);
        _saveTagStyleCache();
        tagStyleLoaded = true;
      } catch (e) {
        console.warn("[SFP] load tag style index failed:", e);
      } finally {
        if (iframe) iframe.remove();
        if (loadScope === scope) tagStylePromise = null;
      }
    })();

    return tagStylePromise;
  }

  function _resetRuntimeTagStyleData() {
    scope.dispose();
    scope = new Lifetime();
    tagStylePromise = null;
    tagStyleLoaded = false;
    tagStyleByKey.clear();
  }
  return {
    get loaded() {
      return tagStyleLoaded;
    },
    get loading() {
      return !!tagStylePromise;
    },
    loadTagStyleIndex,
    _tagDisplayName,
    _getTagStyle,
    reset: _resetRuntimeTagStyleData,
    dispose: () => scope.dispose(),
  };
}
