# Cross-Site Discourse Adaptation Plan

This plan tracks the agreed design for changing the Feed Panel from a LinuxDO-specific userscript into a Discourse-site-aware userscript.

## Resolved Decisions

- Phase one keeps the Feed Panel tied to Discourse's native sidebar. Sites without a usable native sidebar host are not supported until there is explicit demand.
- Phase one ships exactly two built-in userscript matches: `https://linux.do/*` and `https://www.nodeloc.com/*`.
- Additional forums are added by the user through the userscript manager's include/match settings. The userscript does not provide in-script enable/disable commands.
- The userscript does not auto-detect whether an arbitrary page is Discourse and does not show activation success or failure status. Users are responsible for incorrect manual matches.
- Discourse base path is not part of site identity for this project.
- Site Feed Preferences are origin-scoped. Existing LinuxDO global preferences must migrate into LinuxDO site preferences.
- LinuxDO legacy global preference migration is copy-then-delete: after a successful site-scoped copy, the old global key is removed rather than retained for rollback.
- The migration requires adding `GM_deleteValue` so old global preference keys can be removed after successful copy.
- Feed Category Tabs are seeded from the site's Discourse navigation menu categories. If that set is missing, the first-phase fallback is only the all-topics tab.
- Feed Category Tabs must not default to every visible top-level category.
- First-phase Feed Category Tabs use site default navigation-menu categories only. Per-user Discourse sidebar/category preferences are deferred to phase two.
- LinuxDO's static category configuration is not retained as a site preset. Category names, colors, and available category tabs come from Discourse site data; if a site does not provide an icon, the Feed Panel should use a category color marker instead of inventing one.
- Phase one must replace the hard-coded LinuxDO category source with dynamic Discourse site data. If site data cannot be loaded, the Feed Panel falls back to the all-topics tab only.
- Category tab icons are opportunistic. Use a safe site-provided icon when present; otherwise use a category color marker. Do not infer icons from category names or preserve LinuxDO hand-picked icons.
- Category request paths must support parent-chain slug paths, such as `/c/<parent-slug>/<child-slug>/<id>/l/latest.json`. If parent data is unavailable, routing may fall back to `/c/<slug>/<id>/l/latest.json`.
- Parent-category Feed Category Tabs include subcategory topics by default. Incoming reminder filtering must use the same parent-plus-subcategory scope.
- No Standalone Feed Host is planned for phase one. If a forum has no native sidebar, the Feed Panel does not mount.
- If a matched site has no Native Sidebar Host, phase one exits silently, with at most a console warning for debugging.
- Sort, period, and filter controls are derived from site capabilities advertised by Discourse site data. Unsupported controls are hidden rather than emulated.
- The existing ranked-period behavior is preserved where supported: `period=all` ranked orders use latest-style ordering, while non-`all` ranked periods use top-style period requests.
- UI copy and relative-time formatting use the forum page language first, then Discourse/browser language if needed. Phase one supports `zh-CN` and `en`, with English fallback for unknown languages.
- README must document the first-phase support model: built-in support for LinuxDO and NodeLoc, manual userscript-manager match additions for other forums, native-sidebar-only behavior, and user responsibility for incorrect manual matches.

## Deferred Phase-Two Work

- Support per-user Discourse sidebar/category preferences if they can be discovered safely from the client runtime.
- Add a category-management panel that can expose subcategories without turning every subcategory into a default tab.
- Allow users to add, remove, and reorder Feed Category Tabs per site.
- Consider a dedicated subcategory filter inside a selected parent category scope.
- Add an optional per-category scope mode for `include subcategories` versus `current category only`, with matching query keys and incoming filtering.
- Add a cleanup command for clearing one site's Site Feed Preferences after cross-site storage migration is stable.

## Phase-One Implementation Sequence

1. Migrate storage to site-scoped keys, including LinuxDO legacy global-key copy-then-delete and the `GM_deleteValue` grant.
2. Introduce dynamic Discourse site data for categories, navigation category sets, and advertised site capabilities; remove the hard-coded LinuxDO category source.
3. Centralize feed query routing for all-topics and category scopes, including parent-chain category paths and the existing latest/top period semantics.
4. Make UI controls dynamic: category tabs, sort and filter controls, localization, category color-marker fallback, and README documentation.
5. Add the NodeLoc metadata match and validate LinuxDO plus NodeLoc behavior, including incoming activity, refresh, and return-to-head flows.

## Open Design Questions

- None currently recorded for phase one.
