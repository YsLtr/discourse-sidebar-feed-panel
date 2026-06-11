# Discourse Sidebar Feed Panel

[中文](README.md) | English

A userscript that turns the native Discourse sidebar into a compact topic feed panel. After installation, supported Discourse forums get a sidebar feed for topics, categories, incoming activity, and read state.

Current version: `2.1.0`

## Features

- Shows a topic feed inside the native Discourse sidebar
- Supports Latest activity, Newest, Most viewed, Most replies, Most liked, and OP likes where the site supports them
- Supports All, Unread/Unseen, and Read filters where the site supports them
- Builds category tabs from the forum's own navigation categories; falls back to only "All" if none are available
- Includes subcategories when a parent category tab is selected
- Supports drag resizing for the sidebar
- Supports incoming activity count, return to top, manual refresh, automatic silent refresh, and ordinary automatic refresh
- Supports hiding read pinned topics at the top of the Latest activity first page
- Stores width, order, period, category, filter, and refresh preferences per site origin
- Supports Chinese and English UI text, with English fallback for unknown languages

## Known Supported Sites

These sites are built into the userscript metadata and do not need manual match rules:

| Site | Match rule |
| --- | --- |
| [LINUX DO](https://linux.do/) | `https://linux.do/*` |
| [NodeLoc](https://www.nodeloc.com/) | `https://www.nodeloc.com/*` |
| [Chrultrabook Forum](https://forum.chrultrabook.com/) | `https://forum.chrultrabook.com/*` |
| [OpenAI Community](https://community.openai.com/) | `https://community.openai.com/*` |

Other Discourse forums can be tried by adding custom match rules in your userscript manager. The script does not use a global web match and does not auto-detect arbitrary Discourse sites.

## Installation

Install one userscript manager first:

- [Tampermonkey](https://www.tampermonkey.net/)
- [Violentmonkey](https://violentmonkey.github.io/)
- [ScriptCat](https://scriptcat.org/)

Then open one of these install links:

- [Install from GitHub](https://raw.githubusercontent.com/YsLtr/discourse-sidebar-feed-panel/main/discourse-sidebar-feed-panel.user.js)
- [Install from Greasy Fork](https://update.greasyfork.org/scripts/579280/Discourse%20Sidebar%20Feed%20Panel.user.js)
- [Install from ScriptCat](https://scriptcat.org/scripts/code/6360/Discourse%20Sidebar%20Feed%20Panel.user.js)

Your userscript manager should open an install page. Click Install or Confirm. If the browser only shows the `.user.js` file as plain text, the userscript manager is usually missing or disabled.

## How To Open It

1. Install the script, then refresh a known supported site such as `https://linux.do/`.
2. Check your userscript manager and make sure this script is enabled on the current site.
3. If the forum's native sidebar is collapsed, open it with the forum's own sidebar button first. This script only replaces the native Discourse sidebar and does not create a standalone panel elsewhere.
4. Look to the right of the site logo in the top header. A small two-column icon button should appear there.
5. Click that button to switch the sidebar into feed mode. The highlighted button means feed mode is enabled; click it again to restore the native sidebar.

The enabled state is saved per site. When you return to the same site, the feed panel will be restored if the native sidebar is available.

## Basic Usage

The feed header usually contains:

- Order dropdown: switches between Latest activity, Newest, Most viewed, Most replies, Most liked, OP likes, and other supported orders.
- Period dropdown: appears for view/reply/like ranking orders and selects All, Daily, Weekly, Monthly, Quarterly, or Yearly.
- Settings button: opens settings for the current view.
- Head action button: refreshes while at the top; becomes return-to-top after scrolling down; applies incoming activity when a count is shown.

Category tabs are shown below the header:

- "All" shows topics across the current site scope.
- Other tabs come from the forum's own navigation categories and do not list every top-level category by default.
- Parent category tabs include subcategory topics by default.
- The more button opens the category/order panel, where category tabs can be reordered by dragging.

The filter bar is shown below category tabs:

- "All" shows all topics in the current scope.
- "Unread" or "Unseen" shows topics the site reports as unread/unseen.
- "Read" shows topics the site reports as read.
- Available filters depend on the forum's public Discourse capabilities.

The topic list supports:

- Clicking a topic title to open the topic.
- Loading older topics by scrolling near the bottom or clicking Load more.
- Resizing the sidebar by dragging its edge. Width is saved per site.

## Settings

Settings change depending on the current order.

In Latest activity:

- New activity count: shows the number of incoming candidates in the current category scope on the head action button.
- Hide pinned: only when loading the first page, hides read pinned topics from the top pinned block. Unread pinned topics stay visible. Load more and incoming activity are not affected.
- Auto silent refresh: while at the top, automatically applies incoming activity. After scrolling away from the top, new items are accumulated instead of inserted.
- Silent refresh interval: seconds. `0` means apply incoming activity as soon as possible.

In non-Latest orders:

- Auto refresh: while at the top, periodically re-fetches the current order and filter.
- Refresh interval: seconds, minimum `1`. Avoid very short intervals because frequent requests may trigger site rate limits.

## Use On Other Discourse Forums

The script only ships with the built-in sites listed above. To use it on another Discourse forum, add a custom match rule for this script in your userscript manager.

Example match rule:

```text
https://forum.example.com/*
```

Common paths:

- Tampermonkey: Dashboard -> this script -> Settings -> User matches or include/match -> add the site rule -> save.
- Violentmonkey: Dashboard -> this script -> Settings -> Custom match rules -> add the site rule -> save.
- ScriptCat: Script management -> this script -> Settings -> match rules or user matches -> add the site rule -> save.

After adding the rule, refresh the target forum. If it is a compatible Discourse site with a native sidebar, the toggle button should appear next to the top logo. Manually matching non-Discourse or incompatible sites is at your own risk.

## FAQ

### Nothing changes after installation

- Check whether the current URL matches one of the script rules.
- Check that the userscript manager is enabled and this script is not disabled on the current site.
- Refresh the page and wait for Discourse to finish loading.
- Make sure the native sidebar exists. Mobile layouts or very narrow windows usually do not provide a sidebar host to replace.

### I cannot find the two-column toggle button

The button is inserted to the right of the site logo in the top header. It will not appear if the logo area has not loaded, the page is not a standard Discourse layout, or the script does not match the current URL.

### Only the "All" category is shown

This usually means the site did not expose navigation categories to the frontend, or the local category cache needs refreshing. Use the userscript manager menu command `SFP: 清空分类和标签缓存`, or run this in the browser console:

```js
SFPFeedPanel.clearCaches()
```

### How do I turn it off?

Click the two-column button next to the top logo to restore the native sidebar. You can also disable the script in your userscript manager, or remove a custom match rule for a site.

## Limitations

- The script only replaces the native Discourse sidebar. Sites without a usable native sidebar will not get a standalone feed panel.
- Category tabs depend on the forum's navigation category data and do not default to every top-level category.
- The script does not provide an in-page enable/disable menu. Activation is controlled by userscript manager match/include rules.
- Manually matched sites carry their own compatibility risk.

## Permissions

The script uses these userscript permissions:

- `GM_addStyle`: inject feed panel styles
- `GM_setValue`: save user preferences
- `GM_getValue`: read user preferences
- `GM_deleteValue`: delete legacy LinuxDO global keys after migration
- `GM_registerMenuCommand`: add a userscript manager command for clearing category and tag caches
- `unsafeWindow`: access required Discourse runtime objects from the page context

Built-in match rules:

```text
https://linux.do/*
https://www.nodeloc.com/*
https://forum.chrultrabook.com/*
https://community.openai.com/*
```

## Updates

If installed from GitHub Raw, Greasy Fork, or ScriptCat, your userscript manager will usually check for updates automatically. You can also check updates manually from the userscript manager dashboard.

## License

MIT
