import { createFeedScroll } from '../../src/ui/scroll';
import css from '../../src/styles/feed.css?inline';

declare const __SFP_FULL_CSS__: boolean;
const style = document.createElement('style');
// Match the legacy fixture's scope for before/after comparisons. The optional
// full-CSS diagnostic also includes scrollbar pseudo-elements and other rules.
const containerRule = css.match(/\.sfp-feed-scroll\s*\{[^}]+\}/)?.[0];
if (!containerRule) throw new Error('Missing production scroll-container CSS');
style.textContent = __SFP_FULL_CSS__ ? css : containerRule;
document.head.appendChild(style);
const feedScrollEl = document.querySelector<HTMLElement>('.sfp-feed-scroll')!;
const state = window as typeof window & { loadCalls: number; stateCalls: number };
state.loadCalls = 0;
state.stateCalls = 0;
const scroll = createFeedScroll({
  canLoadMore: () => true,
  onLoadMore: () => { state.loadCalls++; },
  onReadingState: () => { state.stateCalls++; },
});
function resetFeed(short = false) {
  document.querySelector('#items')!.innerHTML = Array.from({ length: short ? 1 : 80 },
    (_, i) => `<div class="row">Topic ${i + 1}</div>`).join('');
  feedScrollEl.scrollTop = 0;
}
Object.assign(window, {
  feedScrollEl, resetFeed,
  _setupScrollLoadMore: () => scroll.bind(feedScrollEl),
});
resetFeed();
scroll.bind(feedScrollEl);
