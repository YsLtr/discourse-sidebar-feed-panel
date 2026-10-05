import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";
import baseline from "../fixtures/2.2.3.behavior.json";
import { cssSignature } from "../css-signature.mjs";
import * as constants from "../../src/constants";
import * as keys from "../../src/storage-keys";
import * as readState from "../../src/feed/read-state";
import { buildFeedUrl } from "../../src/feed/query";
import { AutoLoadGate } from "../../src/feed/auto-load";
import { IncomingTopics } from "../../src/feed/incoming";
import { ResidentTopics, type MergeOptions } from "../../src/feed/resident";
import { detectVanishedTopics } from "../../src/feed/unavailable";
import { createI18n } from "../../src/i18n";
import type { FeedQuerySnapshot, Topic } from "../../src/feed/types";

// Execute the unchanged 2.2.3 functions; only their DOM effects are stubbed.
// The fixture is reproducible with tools/capture-migration-baseline.mjs.
function legacy<T>(setup: string, result: string, context = {}): T {
  return vm.runInNewContext(`
    ${Object.entries(baseline.constants).map(([key, value]) => `const ${key}=${JSON.stringify(value)};`).join("\n")}
    ${Object.values(baseline.functions).join("\n")}
    ${setup}
    (${result})
  `, context) as T;
}
const query: FeedQuerySnapshot = { tab: "all", categoryId: null, order: "activity", period: "all", filter: "all" };
const topic = (id: number): Topic => ({ id, slug: `t-${id}`, views: id, posts_count: id, highest_post_number: 4, like_count: id, op_like_count: id, bumped_at: new Date(id * 1000).toISOString(), created_at: new Date(id * 1000).toISOString(), posters: [{ user_id: id }], unseen: true });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("preserves the complete CSS, bilingual text, defaults, limits and storage keys from 2.2.3", () => {
  expect({ ...constants, ...keys }).toEqual(baseline.constants);
  expect(cssSignature(readFileSync("src/styles/feed.css", "utf8"))).toBe(baseline.cssSha256);
  const ast = ts.createSourceFile("i18n.ts", readFileSync("src/i18n.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let actual: unknown;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "I18N")
      actual = vm.runInNewContext(`(${node.initializer!.getText(ast)})`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  expect(actual).toEqual(baseline.i18n);
});

it("matches legacy read links and markers for missing, numeric and malformed progress", () => {
  const old = legacy<typeof readState>("", "{_topicListUrl,_isTopicRead,_hasUnreadMarker,_applyReadMarker}");
  for (const progress of [undefined, null, "", "bad", 0, -1, 1, 4, 8, "2"])
    for (const highest of [undefined, 1, 4, 9]) {
      const value = { ...topic(1), last_read_post_number: progress, highest_post_number: highest };
      expect(readState._topicListUrl(value)).toBe(old._topicListUrl(value));
      expect(readState._isTopicRead(value)).toBe(old._isTopicRead(value));
      const a = structuredClone(value), b = structuredClone(value);
      readState._applyReadMarker(a); old._applyReadMarker(b);
      expect(a).toEqual(b);
    }
});

it("matches legacy locale fallbacks, interpolation and relative-time boundaries", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
  for (const lang of ["zh-CN", "en", "fr", ""])
    for (const siteLocale of ["zh_CN", "en", ""]) {
      const document = { documentElement: { getAttribute: (key: string) => key === "lang" ? lang : "" } };
      const navigator = { language: "en" };
      const getDiscourse = () => ({ SiteSettings: { default_locale: siteLocale } });
      vi.stubGlobal("document", document); vi.stubGlobal("navigator", navigator);
      const current = createI18n(getDiscourse);
      const old = legacy<ReturnType<typeof createI18n>>(`const I18N=${JSON.stringify(baseline.i18n)};`, "{getUiLocale,t,formatRelativeTime}", { document, navigator, getDiscourse, Date });
      expect(current.getUiLocale()).toBe(old.getUiLocale());
      for (const key of [...Object.keys(baseline.i18n.en), "missing-key"])
        expect(current.t(key, { count: 42 })).toBe(old.t(key, { count: 42 }));
      for (const seconds of [-1, 0, 59, 60, 3599, 3600, 86400, 2592000, 31536000]) {
        const date = new Date(Date.now() - seconds * 1000).toISOString();
        expect(current.formatRelativeTime(date)).toBe(old.formatRelativeTime(date));
      }
      expect(current.formatRelativeTime("invalid")).toBe(old.formatRelativeTime("invalid"));
    }
});

it("matches all legacy query URL combinations including category ancestry and top periods", () => {
  const getMeta = (id: number) => ({ id, slug: id === 2 ? "子 分类" : "parent", parent_category_id: id === 2 ? 1 : undefined });
  const old = legacy<{ buildUrl: typeof buildFeedUrl }>(`
    const _getCategoryMeta = getMeta;
    const FeedQuery = ${baseline.feedQuery};
  `, "FeedQuery", { getMeta });
  for (const order of ["activity", "created", "views", "posts", "likes", "op_likes"])
    for (const period of ["all", "daily", "weekly", "monthly", "quarterly", "yearly"])
      for (const categoryId of [null, 2])
        for (const page of [0, 1, 8]) {
          const q = { ...query, order, period, categoryId, tab: categoryId ? "cat-2" : "all" };
          expect(buildFeedUrl(q, page, getMeta)).toBe(old.buildUrl(q, page, getMeta));
        }
});

it("matches the old rate-window boundary, latched empty stop and query reset", () => {
  let now = 0;
  const old = legacy<{ can(key: string): boolean; request(): void; result(count: number): void }>(`
    let autoLoadTimestamps=[], autoLoadEmptyFilterCount=0, autoLoadStoppedForSession=false, autoLoadSessionKey='', key='A';
    const _getAutoLoadSessionKey=()=>key;
  `, "{can: value => {key=value; return _canRunAutoLoad()}, request:_recordAutoLoadRequest, result:_recordAutoLoadFilterResult}", { Date: { now: () => now } });
  const gate = new AutoLoadGate(() => now);
  for (const key of ["A", "B", "A"]) {
    for (let step = 0; step < 20; step++) {
      expect(gate.canRun(key)).toBe(old.can(key));
      gate.recordRequest(key); old.request();
      const count = step < 5 ? 1 : 0;
      gate.recordResult(key, count); old.result(count);
      now += [0, 1, 4999, 5000][step % 4];
    }
  }
});

it("matches legacy incoming accumulation, unknown payloads, reordering and detail cap", () => {
  const old = legacy<{ touch(id: number, data?: Partial<Topic>): void; recompute(): number[]; load(): number[]; remove(ids: number[]): void }>(`
    let topicPageSize=3;
    const sidebarIncomingState={topicIds:[],topicIdSet:new Set(),topicCache:new Map(),filteredTopicIds:[],filteredLoadTopicIds:[]};
    const FeedQuery={snapshot:()=>({})};
    const _canUseSidebarIncomingRefresh=()=>true;
    const _topicMatchesIncomingCandidate=t=>t.category_id!==99;
  `, `{
    touch: (id,data) => { _touchSidebarIncomingTopicId(id); if(data) sidebarIncomingState.topicCache.set(id,{...sidebarIncomingState.topicCache.get(id),...data,id}); },
    recompute:_recomputeSidebarIncomingFilteredTopicIds,load:_getSidebarIncomingLoadTopicIds,remove:_removeSidebarIncomingTopicIds
  }`);
  const current = new IncomingTopics();
  for (const id of [1, 2, 3, 4, 5, 6, 7, 1, 8, 3]) {
    const data = id === 8 ? undefined : { category_id: id === 4 ? 99 : 2 };
    old.touch(id, data); current.touch(id, data);
    expect(current.recompute(true, t => t.category_id !== 99)).toEqual(old.recompute());
    expect(current.loadIds(3)).toEqual(old.load());
  }
  current.remove([3, 8]); old.remove([3, 8]);
  expect(current.recompute(true, t => t.category_id !== 99)).toEqual(old.recompute());
  expect(current.loadIds(3)).toEqual(old.load());
});

it("matches legacy refresh merges, read preservation, anomaly ordering, expiry and retained users", () => {
  type Snapshot = { topics: Topic[]; users: object; page: number; more: boolean; ids: number[]; highlights: number[] };
  const old = legacy<{ init(topics: Topic[]): void; merge(topics: Topic[], options: MergeOptions): Snapshot }>(`
    let allTopics=[],usersMap={},loadedTopicIds=new Set(),topicPageSize=3,currentPage=1,hasMorePages=true,highlights=[];
    const _captureFeedScrollAnchor=()=>null, _restoreFeedScrollAnchor=()=>{}, _syncHeadActionState=()=>{}, _syncIncomingHeadAction=()=>{};
    const renderTopics=ids=>{highlights=ids};
  `, `{
    init: topics => { allTopics=topics; loadedTopicIds=new Set(topics.map(t=>t.id)); usersMap=Object.fromEntries(topics.map(t=>[t.id,{id:t.id,username:String(t.id)}])); },
    merge: (topics,options) => { _mergeAndRenderTopics(topics,options); return {topics:allTopics,users:usersMap,page:currentPage,more:hasMorePages,ids:[...loadedTopicIds].sort(),highlights}; }
  }`);
  const current = new ResidentTopics();
  const initial = [9, 8, 7, 6, 5, 4].map(topic);
  initial[0].last_read_post_number = 4;
  initial[1].sfpUnavailable = true; initial[1].sfpUnavailablePushed = 0;
  current.loadHead(structuredClone(initial.slice(0, 3)), 3, "/next");
  current.append(structuredClone(initial.slice(3)), "/next");
  current.addUsers(initial.map(t => ({ id: t.id, username: String(t.id) })));
  old.init(structuredClone(initial));
  for (let step = 0; step < 18; step++) {
    const fresh = (step < 2 ? [9, 7, 6] : [step + 9, step + 8, step + 7]).map(topic);
    const options: MergeOptions = { mode: step % 2 ? "prepend" : "replace-head", moreTopicsUrl: step % 3 ? "/next" : "", resetFeedDepth: step !== 0, sortQuery: query };
    const expected = old.merge(structuredClone(fresh), options);
    const highlights = current.merge(structuredClone(fresh), options);
    expect({ topics: current.topics, users: current.users, page: current.page, more: current.hasMore, ids: current.topics.map(t => t.id).sort(), highlights }).toEqual(expected);
  }
});

it("matches disappearance detection for every sort, ties, pinned topics and period exclusions", () => {
  const old = legacy<{ detect(topics: Topic[], fresh: Topic[], query: FeedQuerySnapshot): Topic[] }>("let allTopics=[];", "{detect:(topics,fresh,query)=>{allTopics=topics;_detectVanishedHeadTopics(fresh,query);return allTopics}}");
  for (const order of ["activity", "created", "views", "posts", "likes", "op_likes"])
    for (const period of ["all", "weekly"])
      for (const pinned of [false, true])
        for (const ids of [[10, 9, 8], [10, 9, 6], [10, 6, 5], []]) {
          const a = [9, 8, 7, 99].map(topic), q = { ...query, order, period };
          a[1].pinned = pinned;
          const b = structuredClone(a), fresh = ids.map(topic);
          detectVanishedTopics(a, fresh, q);
          expect(a).toEqual(old.detect(b, fresh, q));
        }
});
