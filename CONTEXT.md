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

**Resident Topic Limit**:
The maximum size of the **Resident Topic Window** before older retained topics are released.
_Avoid_: Page size, request limit

**Incoming Candidate**:
A topic id received from Discourse message-bus that may be eligible to enter the current **Feed Panel** after filtering and detail fetch.
_Avoid_: New topic when eligibility has not been confirmed

**Incoming Candidate Limit**:
The maximum number of pending **Incoming Candidates** retained for future insertion into the **Feed Panel**.
_Avoid_: Resident topic limit

**Viewport-Protected Topic**:
A **Topic Item** that is visible or hovered and should not be replaced during a refresh that preserves reading position.
_Avoid_: Sticky topic, pinned topic

**Protected Prefix**:
The contiguous portion of the **Resident Topic Window** from the feed head through the furthest current **Viewport-Protected Topic**.
_Avoid_: Visible items, viewport cache

**Refresh Trim**:
A memory control step after manual refresh, automatic refresh, or silent incoming refresh that releases Resident Topics after the **Protected Prefix** when the window exceeds the **Resident Topic Limit**.
_Avoid_: Scroll limit, pagination limit

**Automatic Refresh Gate**:
A runtime guard that prevents automatic refresh paths from applying new topics when the page has been idle too long or the **Resident Topic Window** is far above the **Resident Topic Limit**.
_Avoid_: Manual refresh block

**Continuation URL**:
The Discourse-provided `more_topics_url` used to load topics older than the current tail of the **Resident Topic Window**.
_Avoid_: Locally computed page number

## Relationships

- A **Feed Panel** contains zero or more **Topic Items**.
- A **Topic Item** is backed by exactly one **Resident Topic**.
- A **Topic Item** has at most one **Topic Display User**.
- A **Resident Topic Window** contains the **Resident Topics** that remain available for rendering and local filtering.
- A **Topic Display User Map** is rebuilt after an actual **Refresh Trim** from the first poster of each remaining **Resident Topic**.
- The **Resident Topic Limit** defaults to 200 **Resident Topics**.
- The **Protected Prefix** may temporarily exceed the **Resident Topic Limit** so the user keeps the reading context above the current visible position.
- A **Refresh Trim** never disables user-initiated or scroll-triggered loading of older topics.
- A **Refresh Trim** runs after refresh-style merges, not after loading older pages.
- A **Refresh Trim** releases both retained topic data and the corresponding loaded-topic markers, so trimmed topics can be fetched again later.
- A **Refresh Trim** happens after refreshed topics are merged into the **Resident Topic Window** and before **Topic Items** are rendered.
- A **Refresh Trim** derives its boundary from currently protected **Topic Item** ids, then applies that boundary to the unfiltered **Resident Topic Window** order.
- A **Refresh Trim** changes the oldest retained **Resident Topic**, so it must also realign the **Continuation URL** to continue loading from the retained tail rather than from a stale page number.
- The **Automatic Refresh Gate** applies to automatic silent refresh and automatic ordinary refresh, not to user-clicked refresh actions.
- The **Automatic Refresh Gate** treats the page as idle after 10 minutes without page-level user activity.
- The **Automatic Refresh Gate** always skips automatic refresh ticks when the **Resident Topic Window** exceeds three times the **Resident Topic Limit**.
- The **Automatic Refresh Gate** skips individual automatic refresh ticks without changing saved user settings.
- An **Incoming Candidate** may become a **Resident Topic** after the userscript fetches full topic details and confirms it matches the current feed query.
- The **Incoming Candidate Limit** follows the user-configured **Resident Topic Limit**.
- **Incoming Candidates** are intended to be inserted as a continuous set of newer topics, pushing older **Resident Topics** down before trimming is considered.
- A compacted **Incoming Candidate** id may be remembered to avoid duplicate pending counts, but a later message-bus event for that id can make it a fresh **Incoming Candidate** again.
- Loading older topics follows the latest known **Continuation URL** from Discourse instead of locally incrementing page numbers.
- After a **Refresh Trim**, the **Continuation URL** should intentionally overlap the retained tail and rely on loaded-topic markers for de-duplication, avoiding gaps in page-based Discourse lists.
- A **Viewport-Protected Topic** is a temporary role held by a **Topic Item** during a refresh to prevent movement or replacement jitter.
- The **Protected Prefix** is derived from **Viewport-Protected Topics**, but protects additional Resident Topics above them from memory trimming.

## Example Dialogue

> **Dev:** "When incoming activity arrives, should every Incoming Candidate become a Topic Item immediately?"
> **Domain expert:** "No. It first has to match the current tab, filters, and feed query; only then should it become a Resident Topic."

## Flagged Ambiguities

- "Loaded topic" can mean a fetched data object, a retained feed entry, or a DOM node. Use **Resident Topic** for memory-retained feed entries and **Topic Item** for rendered DOM entries.
- "Destroy topics" is ambiguous between removing DOM nodes and releasing retained feed data. Use **Resident Topic Window** when discussing memory limits.
- "Visible topic protection" in code prevents movement or replacement jitter for visible or hovered **Topic Items**. Memory trimming derives a broader **Protected Prefix** from that code-defined protected set.
