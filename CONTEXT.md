# Discourse Sidebar Feed Panel

This context describes the user-visible feed experience provided by the userscript that replaces the Discourse sidebar with a topic feed.

## Language

**Feed Panel**:
The sidebar replacement surface that shows Discourse topics as a compact feed.
_Avoid_: Sidebar, list, panel when referring to the replaced experience

**Topic Item**:
A rendered entry in the **Feed Panel** representing one Discourse topic.
_Avoid_: Post item, card

**Topic Display User**:
The first poster used by a **Topic Item** for avatar and display-name rendering.
_Avoid_: Any poster, participant

**Topic Display User Map**:
The retained user data needed to render the **Topic Display Users** for the current **Resident Topic Window**.
_Avoid_: User cache when discussing all known site users

**Resident Topic**:
A topic currently retained by the userscript as part of the feed's working set, whether or not it is visible in the viewport.
_Avoid_: Loaded topic when discussing memory retention

**Resident Topic Window**:
The bounded set of **Resident Topics** kept in memory for the current feed query.
_Avoid_: Cache, full history

**Rendered Topic Window**:
The subset of **Resident Topics** currently represented by mounted **Topic Items** in the **Feed Panel**.
_Avoid_: Resident Topic Window, visible topics, DOM cache

**Scroll Anchor**:
The **Resident Topic** used to preserve the user's reading position across refreshes and rendered-window changes.
_Avoid_: Scroll offset, scrollTop, visible item

**Topic Projection**:
The ordered subset of the **Resident Topic Window** that matches the current feed query and local filters.
_Avoid_: Resident Topic Window, Rendered Topic Window, filtered list

**Head-Screen Reading State**:
The Feed Panel state where the user has not scrolled beyond the first visible screen of Topic Items.
_Avoid_: First page, page 1

**Away-From-Head Reading State**:
The Feed Panel state where the user has scrolled beyond the first visible screen and should not have new Topic Items inserted above the current reading position.
_Avoid_: Outside first page, deep page, reading below page 1

**Return-To-Head Action**:
A navigation action that scrolls the Feed Panel back to the head without applying accumulated incoming activity.
_Avoid_: Refresh, apply new topics

**Head Action Button**:
The header control that refreshes in the Head-Screen Reading State and becomes the return-to-head control in the Away-From-Head Reading State.
_Avoid_: Refresh button when describing away-from-head behavior

**Frozen Refresh State**:
The Away-From-Head Reading State behavior where automatic refresh timers are stopped, while incoming activity tracking may continue.
_Avoid_: Disabled setting, unsubscribed state

**Resident Topic Limit**:
The current page-size-derived capacity of the Resident Topic Window for the loaded feed depth.
_Avoid_: User-configured cache size

**Incoming Candidate**:
A topic id received from Discourse message-bus that may be eligible to enter the current **Feed Panel** after filtering and detail fetch.
_Avoid_: New topic when eligibility has not been confirmed

**Incoming Candidate Limit**:
The maximum number of pending **Incoming Candidates** retained for future insertion into the **Feed Panel**.
_Avoid_: Resident topic limit

**Incoming Reminder Count**:
The count of Incoming Candidates that match the current latest/category scope closely enough to show a user-facing reminder.
_Avoid_: Exact insert count, fetched topic count

**Incoming Count Display**:
The optional number shown in the Head Action Button to expose the Incoming Reminder Count and make the button apply incoming activity.
_Avoid_: Refresh count

**Viewport-Protected Topic**:
A **Topic Item** that is visible or hovered and should not be replaced during a refresh that preserves reading position.
_Avoid_: Sticky topic, pinned topic

**Protected Prefix**:
The contiguous portion of the **Resident Topic Window** from the feed head through the furthest current **Viewport-Protected Topic**.
_Avoid_: Visible items, viewport cache

**Refresh Trim**:
A memory control step after refresh-style merges that releases Resident Topics beyond the page-size-derived **Resident Topic Limit**.
_Avoid_: Scroll limit, pagination limit

**Automatic Refresh Gate**:
A runtime guard that prevents automatic refresh paths from applying new topics when the page has been idle too long or the **Resident Topic Window** is far above the **Resident Topic Limit**.
_Avoid_: Manual refresh block

**Loaded Feed Depth**:
The number of API pages represented by the current feed query, tracked from the local page index.
_Avoid_: Resident topic count, continuation URL

**More Pages Signal**:
The Discourse response signal that indicates whether older pages are likely available.
_Avoid_: Pagination cursor, authoritative next page URL

## Relationships

- A **Feed Panel** contains zero or more **Topic Items**.
- A **Topic Item** is backed by exactly one **Resident Topic**.
- A **Topic Item** has at most one **Topic Display User**.
- A **Resident Topic Window** contains the **Resident Topics** that remain available for rendering and local filtering.
- A **Rendered Topic Window** contains only the **Resident Topics** currently mounted as **Topic Items**.
- A **Rendered Topic Window** may be smaller than the **Resident Topic Window** while preserving the user's reading position.
- A **Scroll Anchor** is identified by topic identity, not by a raw scroll offset.
- A **Scroll Anchor** keeps the same **Resident Topic** near the same visual position when newer topics are inserted above it.
- A **Topic Projection** contains only **Resident Topics** eligible for rendering under the current tab, filter, period, and pinned-topic settings.
- A **Rendered Topic Window** is selected from the current **Topic Projection**.
- The **Head-Screen Reading State** covers only the first visible screen, not the first API page.
- The **Away-From-Head Reading State** begins when the user scrolls beyond the first visible screen.
- The boundary between **Head-Screen Reading State** and **Away-From-Head Reading State** is one Feed Panel viewport height.
- In the **Away-From-Head Reading State**, incoming activity should accumulate as a reminder instead of inserting new **Topic Items** above the user's current reading position.
- A **Return-To-Head Action** does not apply accumulated incoming activity or trigger a refresh.
- A **Head Action Button** performs manual refresh only in the **Head-Screen Reading State**.
- A **Head Action Button** performs only a **Return-To-Head Action** in the **Away-From-Head Reading State**.
- The **Head Action Button** is the only return-to-head affordance in the **Feed Panel**.
- The **Head Action Button** state is the single source of truth for head versus away-from-head behavior in the UI.
- Without an **Incoming Count Display**, the **Head Action Button** keeps its original action for the current reading state.
- With an **Incoming Count Display**, the **Head Action Button** applies accumulated incoming activity.
- With an **Incoming Count Display** in the **Away-From-Head Reading State**, the **Head Action Button** first performs a **Return-To-Head Action** and then applies accumulated incoming activity.
- Applying activity from an **Incoming Count Display** consumes incoming candidates rather than performing a full manual refresh of the current feed query.
- When an **Incoming Count Display** is clicked in the **Away-From-Head Reading State**, the return to head should keep the animated scroll feel and apply incoming activity after the return completes.
- If the animated **Return-To-Head Action** is interrupted before reaching the head, the incoming activity is not applied and the **Incoming Count Display** remains available.
- User-applied incoming activity resets **Loaded Feed Depth** to the first page because the user has accepted a new feed head.
- Refresh-style head updates reset **Loaded Feed Depth** to the first page when they apply a new feed head.
- The **Frozen Refresh State** stops automatic refresh timers without changing the user's saved refresh settings.
- The **Frozen Refresh State** does not stop incoming activity tracking when that tracking is needed to update the reminder count.
- Leaving the **Frozen Refresh State** restarts automatic refresh timers from their full configured interval when the relevant setting is enabled.
- Pending **Incoming Candidates** may continue accumulating even when the **Incoming Count Display** is disabled, so automatic silent refresh can apply them later in the **Head-Screen Reading State**.
- Incoming activity tracking is only needed when the **Incoming Count Display** is enabled or automatic silent refresh is enabled.
- A **Topic Display User Map** is rebuilt after an actual **Refresh Trim** from the first poster of each remaining **Resident Topic**.
- The **Resident Topic Limit** defaults to one API page after the first load.
- The **Resident Topic Limit** grows with loaded feed depth as the user loads older pages.
- The **Resident Topic Limit** is calculated as API page size multiplied by loaded page count.
- Loading older topics is the only action that increases **Loaded Feed Depth**.
- Changing the feed query resets **Loaded Feed Depth**, incoming activity state, and the **Head Action Button** state for the new query.
- A **Refresh Trim** never disables user-initiated or scroll-triggered loading of older topics.
- A **Refresh Trim** runs after refresh-style merges, not after loading older pages.
- A **Refresh Trim** releases both retained topic data and the corresponding loaded-topic markers, so trimmed topics can be fetched again later.
- A **Refresh Trim** happens after refreshed topics are merged into the **Resident Topic Window** and before **Topic Items** are rendered.
- A **Refresh Trim** uses loaded feed depth and API page size rather than viewport protection.
- A **Refresh Trim** changes the oldest retained **Resident Topic**, so pagination state must continue from the local **Loaded Feed Depth**.
- The **Automatic Refresh Gate** applies to automatic silent refresh and automatic ordinary refresh, not to user-clicked refresh actions.
- The **Automatic Refresh Gate** treats the page as idle after 10 minutes without page-level user activity.
- The **Automatic Refresh Gate** always skips automatic refresh ticks when the **Resident Topic Window** exceeds three times the **Resident Topic Limit**.
- The **Automatic Refresh Gate** skips individual automatic refresh ticks without changing saved user settings.
- An **Incoming Candidate** may become a **Resident Topic** after the userscript fetches full topic details and confirms it matches the current feed query.
- The **Incoming Candidate Limit** follows the page-size-derived **Resident Topic Limit**.
- **Incoming Candidates** are intended to be inserted as a continuous set of newer topics, pushing older **Resident Topics** down before trimming is considered.
- A compacted **Incoming Candidate** id may be remembered to avoid duplicate pending counts, but a later message-bus event for that id can make it a fresh **Incoming Candidate** again.
- An **Incoming Reminder Count** is based on the current latest/category scope and does not require fetching full topic details while the user remains away from the head.
- An **Incoming Reminder Count** is confirmed again when incoming activity is actually applied to the **Feed Panel**.
- The user setting historically called "new activity reminder" controls the **Incoming Count Display**, not whether incoming tracking exists.
- The **Incoming Count Display** is hidden while automatic silent refresh is both enabled and usable in the **Head-Screen Reading State**, avoiding a number that appears only briefly before automatic application.
- Automatic silent refresh takes precedence over the **Incoming Count Display** in the **Head-Screen Reading State**.
- Loading older topics uses the next local page number from the **Loaded Feed Depth**.
- The Discourse `more_topics_url` is treated as a **More Pages Signal**, not as the authoritative next request URL.
- After a **Refresh Trim**, continuation should follow the **Loaded Feed Depth** rather than a stale retained-tail estimate.
- A **Viewport-Protected Topic** is a temporary role held by a **Topic Item** during a refresh to prevent movement or replacement jitter.
- The **Protected Prefix** is derived from **Viewport-Protected Topics**, but protects additional Resident Topics above them from memory trimming.

## Example Dialogue

> **Dev:** "When incoming activity arrives, should every Incoming Candidate become a Topic Item immediately?"
> **Domain expert:** "No. It first has to match the current tab, filters, and feed query; only then should it become a Resident Topic."

## Flagged Ambiguities

- "Loaded topic" can mean a fetched data object, a retained feed entry, or a DOM node. Use **Resident Topic** for memory-retained feed entries and **Topic Item** for rendered DOM entries.
- "Window" is ambiguous between retained data and mounted DOM. Use **Resident Topic Window** for retained topic data and **Rendered Topic Window** for mounted Topic Items.
- "Scroll position" is ambiguous between raw offset and reading context. Use **Scroll Anchor** when preserving what the user is reading.
- "Filtered list" is ambiguous between an implementation array and the user-visible eligible topic sequence. Use **Topic Projection** for the ordered eligible sequence.
- "First page" can mean either the first API page or the first visible screen. Use **Head-Screen Reading State** and **Away-From-Head Reading State** for scroll-state behavior.
- "New topic count" can mean either an **Incoming Reminder Count** or the number of Topic Items eventually inserted after detail fetch and filtering.
- "Refresh button" only describes the **Head Action Button** while the user is in the **Head-Screen Reading State**.
- "Destroy topics" is ambiguous between removing DOM nodes and releasing retained feed data. Use **Resident Topic Window** when discussing memory limits.
- "Visible topic protection" describes the previous trimming model; the newer model freezes refresh while away from the head and uses page-size-derived retention instead.
