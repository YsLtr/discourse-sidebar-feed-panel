# Discourse Sidebar Feed Panel - Active Handoff

The userscript replaces a selected area of a Discourse forum with a compact, locally-filtered topic feed panel, hosted from the userscript metadata of a single built file. `CONTEXT.md`, `docs/adr/` and `docs/` hold the durable contracts; this file records only the current session.

**Project root**: `C:\Users\28676\builds\discourse\userscript`
**Branch / remote**: `main` / `https://github.com/YsLtr/discourse-sidebar-feed-panel.git`
**User request**: implement the web-page language compatibility described by `docs/language-compatibility.md` — render titles in the locale the forum resolved for the request, and keep the locale-dependent persistent caches per locale.

## 本轮完成的工作

- **计划入档**(`817e446`): the investigation document was renamed to `docs/language-compatibility.md` and rewritten as the contract (terminology, server locale chain, field/endpoint translation table, live evidence, implementation rules, acceptance, known boundaries, repro commands); `docs/development.md` gained a Language compatibility section and `docs/cross-site-discourse-adaptation-plan.md` gained the matching resolved decision.
- **实现**(`56feafc`, 19 files, +364/-27):
  - `src/ui/html.ts` added `decodeHtmlEntities` (detached `<textarea>` round-trip) and `selectTopicTitle`; the single title render site `src/ui/topic-item.ts` now emits `escapeHtml(decodeHtmlEntities(selectTopicTitle(topic)))` inside `span.sfp-topic-title-line[dir="auto"]`; `Topic` gained `fancy_title?: string`.
  - Title priority: `fancy_title` when free of `:[\w\-+]+:`, else `unicode_title`, else `fancy_title`, else `title`. No `?tl=` is sent.
  - `sfp_category_data_cache_v1` and `sfp_tag_style_cache_v1` values became `{ version, locales: { "<locale>": { savedAt, … } } }`, located by `getPageLocale()` (injected into `createSiteData`/`createTagStyles` from `src/platform/discourse.ts`), keeping the current plus the previous locale (`src/site/locale-cache.ts`, `withLocaleEntry`, `MAX_CACHED_LOCALES = 2`), and dropping a pre-change blob without a `locales` field once.
  - `observePageLocale()` watches `documentElement` `lang`/`xml:lang` under the bridge Lifetime and reports at most once per page load; `controller.reloadForPageLocale()` resets site/tag in-memory state, force-rebuilds header/tab/filter bars, resets auto-load state and reloads topics in place — no `location.reload()`, caches not deleted.
  - `CONTEXT.md` gained the terms **Topic Display Title** and **Page Locale**; `todo.md`'s language item is checked off.
  - Version bumped to **3.1.0** in `package.json`/`package-lock.json`.
- **验证**: `npm run typecheck`, `npm test` (12 files / 58 tests), `npm run check:dev`, `npm run build` (192.33 kB, gzip 43.88 kB), `npm run check:artifact`, `npm run check:browser` (36 checks), `npm run check:scroll` (12 checks) all passed; migration-parity tests 8/8. A rebuild was byte-identical to the audited `dist/` artifact, so the browser checks ran against this commit's source. New unit files: `tests/unit/topic-title.test.ts`, `tests/unit/page-locale.test.ts`; the browser fixture topic and `tools/check-built-userscript.py` gained the localized-title and locale-change cases.
- **代理审查**(static variant by a scout sub-agent, offline-test variant by the main agent, adversarial variant by a code-reviewer sub-agent; reports under `.pi/tmp/audit-*.md`): no must-fix finding; the verdict was recorded as clean with accepted low-risk residuals.
- **文档复位**(`c83ae72`): `docs/language-compatibility.md` §六 acceptance was corrected to the assertions actually implemented (in-place rebuild is proven by the panel copy switching, not by a title text change), the observer unit cases were listed, §五.4 now says the observation compares against the locale recorded when the observer was created, and §七 gained the two new boundaries.
- `ea002c4`: `vitest.config.ts` comment noting that DOM-dependent behaviour is covered by `check:browser`, not by the jsdom-free unit setup.

## 当前仓库状况

- HEAD is `ea002c4`; the AGENTS.md commit for this handoff is the last change of the session and lands on top of it. Everything else is committed.
- Nothing has been pushed. Version 3.1.0 exists only locally, so no `v3.1.0` tag or Release exists yet.
- The only untracked path is `.pi/` (deep-plan scratch: the three audit reports plus `commit-message.txt`).

## 未决问题

- **是否发布 3.1.0 未定**: pushing `main` triggers `.github/workflows/release.yml`, which creates the `v3.1.0` tag and publishes the built userscript as the latest asset; published assets are not overwritten. The user has not authorized that push in this session.
- `.pi/` stays untracked because `.gitignore` cannot be edited in the documentation-reset phase. Add a `.pi/` ignore entry or delete the directory when the tree must be clean.
- **审查接受的残余风险**(已记入 `docs/language-compatibility.md` §七): the `:[\w\-+]+:` shortcode test is the same shape the server uses, so titles such as `12:30:45` or `a:b:c` fall back to the source title; entity decoding applies to all three title fields, so a title that literally contains `&lt;`/`&amp;` renders the decoded character; `withLocaleEntry` throws on a `locales: { x: null }` blob, which the call-site `try`/`catch` reduces to one lost write.
- **未经实测**(does not block this change, but must not be reported as verified): whether a real forum returns the new locale's titles after an in-session language change; userscript-manager upgrade/sandbox compatibility; the `clearCaches` delete-then-refetch path end to end (the browser check only asserts the API is still exposed); visual RTL rendering under `dir="auto"`.
- The `todo.md` notes that arrived with this change ("稍后再读" items and the new meta brand theme) are the user's own open items, not work started in this session.

## 后续任务

用户本次会话未指定后续任务。

Updated: 2026-10-11 18:36 中国标准时间 +0800
