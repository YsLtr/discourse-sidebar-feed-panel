"""Exercise the actual production bundle with mock GM and Discourse services.

This checks module integration and full CSS, not userscript-manager sandboxing.
"""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import time

from chrome_session import ChromeSession, default_chrome

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--chrome', default=default_chrome())
parser.add_argument('--source', type=Path, default=ROOT / 'dist/discourse-sidebar-feed-panel.user.js')
args = parser.parse_args()
source = args.source.read_text(encoding='utf-8')
fixture = (ROOT / 'tests/browser/site-fixture.html').read_bytes()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(fixture)

    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
results = []

try:
    with ChromeSession(args.chrome) as cdp:
        cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
        cdp.event('Page.loadEventFired')
        cdp.evaluate(source)

        def wait_for(expression):
            deadline = time.monotonic() + 6
            while not cdp.evaluate(expression):
                if time.monotonic() > deadline:
                    errors = [e for e in cdp.events if e.get('method') == 'Runtime.exceptionThrown']
                    raise AssertionError(f'Timed out: {expression}\n{json.dumps(errors)}')
                time.sleep(.04)

        def check(label, expression):
            actual = cdp.evaluate(expression)
            assert actual, f'{label}: {actual}'
            results.append(label)
            print('PASS', label)

        wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
        wait_for("!document.querySelector('.sfp-width-animating')")
        check('mount, metadata-derived tabs and default-order migration', """(() => {
          const key=`sfp_site:${encodeURIComponent(location.origin)}:sfp_current_order`;
          return document.querySelectorAll('.sfp-feed-container').length===1 &&
            document.querySelectorAll('.sfp-tab-bar .sfp-tab-item').length===2 &&
            fixture.store.get(key)==='activity' && fixture.menus.length===1 &&
            fixture.requests.every(r=>r.csrf==='fixture-csrf');
        })()""")
        check('sidebar width drives the grid track under a body-level override', """(() => {
          const track=parseFloat(getComputedStyle(document.querySelector('#main-outlet-wrapper')).gridTemplateColumns.split(' ')[0]);
          const written=parseFloat(document.querySelector('#d-sidebar').style.width);
          const sidebarPx=document.querySelector('#d-sidebar').getBoundingClientRect().width;
          const bodyVar=getComputedStyle(document.body).getPropertyValue('--d-sidebar-width').trim();
          return Math.abs(track-written)<1 && Math.abs(track-sidebarPx)<1 && !bodyVar.endsWith('em');
        })()""")
        cdp.evaluate("""window.panelWidthBefore=document.querySelector('#d-sidebar').style.getPropertyValue('width');
          document.querySelector('.sfp-feed-container').remove();""")
        wait_for("document.querySelectorAll('.sfp-feed-container').length===1")
        time.sleep(.5)
        check('a container re-mount keeps the panel width past the animation window', """(() => {
          const side=document.querySelector('#d-sidebar');
          const track=parseFloat(getComputedStyle(document.querySelector('#main-outlet-wrapper')).gridTemplateColumns.split(' ')[0]);
          return side.style.getPropertyValue('width')===panelWidthBefore &&
            Math.abs(track-parseFloat(panelWidthBefore))<1 &&
            document.body.style.getPropertyValue('--d-sidebar-width')===panelWidthBefore;
        })()""")
        check('full CSS preserves native scroll rules', """(() => {
          const s=getComputedStyle(document.querySelector('.sfp-feed-scroll'));
          return s.overscrollBehaviorY==='contain' && s.touchAction==='pan-y pinch-zoom';
        })()""")
        wait_for("""document.querySelector('[data-topic-id="299"] .sfp-tag')?.getAttribute('style')==='--color1: #123456'""")
        check('localized fancy_title is entity-decoded inside a dir="auto" title line', """(() => {
          const line=document.querySelector('[data-topic-id="299"] .sfp-topic-title-line');
          return !!line && line.textContent==='Translated \u201cAlpha\u201d' && line.getAttribute('dir')==='auto' &&
            document.querySelector('[data-topic-id="300"] .sfp-topic-title-line').textContent==='Topic 300';
        })()""")
        check('the tag style cache of the current page locale is adopted without a /tags request', """!!document.querySelector('.sfp-tag[style]') &&
          !document.querySelector('iframe[src="/tags"]')""")
        check('a tracked topic shows its new reply count where the dot would be', """(() => {
          const item=document.querySelector('[data-topic-id="280"]');
          const count=item.querySelector('.sfp-unread-count');
          return !!count && count.textContent==='3' && !item.querySelector('.sfp-unread-dot') &&
            !!count.getAttribute('title');
        })()""")
        cdp.evaluate("""fixture.writes.length=0;
          document.querySelector('.sfp-resizer').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:300}));
          for(let x=310;x<=450;x+=10) document.dispatchEvent(new MouseEvent('mousemove',{clientX:x}));""")
        check('drag previews width without repeated storage writes', "!fixture.writes.some(w=>w.key.endsWith(':sfp_sidebar_width')) && document.querySelector('#d-sidebar').getBoundingClientRect().width>400 && parseFloat(getComputedStyle(document.querySelector('#main-outlet-wrapper')).gridTemplateColumns.split(' ')[0])>400")
        cdp.evaluate("document.dispatchEvent(new MouseEvent('mouseup'))")
        check('drag persists once on release and removes its listeners', "fixture.writes.filter(w=>w.key.endsWith(':sfp_sidebar_width')).length===1 && !fixture.effects.listeners.some(e=>['mousemove','mouseup'].includes(e.type)) && !document.body.style.cursor")
        cdp.evaluate("""window.outlet=document.querySelector('.home-logo-wrapper-outlet');
          window.outletParent=outlet.parentElement;
          outlet.remove();""")
        wait_for("!document.querySelector('.sfp-toggle-btn')")
        cdp.evaluate("""const fresh=document.createElement('div');
          fresh.className='home-logo-wrapper-outlet';
          fresh.innerHTML='<div class="title">Fixture forum</div>';
          outletParent.prepend(fresh);""")
        wait_for("document.querySelectorAll('.sfp-toggle-btn').length===1")
        check('toggle re-anchors when the header is replaced', """!!document.querySelector('.home-logo-wrapper-outlet .title > .sfp-toggle-btn') &&
          document.querySelectorAll('.sfp-toggle-btn').length===1""")
        cdp.evaluate("""window.firstItem=document.querySelector('.sfp-topic-item');
          window.dotBefore=firstItem.querySelector('.sfp-unread-dot');
          window.timeBefore=firstItem.querySelector('.sfp-topic-time').getBoundingClientRect().x;
          firstItem.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));""")
        check('read dot keeps its node and time-row position', """(() => {
          const dot=firstItem.querySelector('.sfp-unread-dot');
          return dot===dotBefore && getComputedStyle(dot).visibility==='hidden' &&
            Math.abs(firstItem.querySelector('.sfp-topic-time').getBoundingClientRect().x-timeBefore)<0.1;
        })()""")
        cdp.evaluate("document.querySelector('[data-topic-id=\"280\"]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}))")
        check('opening a tracked topic keeps its server reply count', """(() => {
          const item=document.querySelector('[data-topic-id="280"]');
          return item.classList.contains('sfp-read') &&
            item.querySelector('.sfp-unread-count')?.textContent==='3';
        })()""")
        cdp.evaluate("fixture.head[20].unread_posts=7;document.querySelector('.sfp-refresh-btn').click()")
        wait_for("document.querySelector('.sfp-refresh-btn').getAttribute('aria-busy')!=='true'")
        check('refresh preserves locally read state', "getComputedStyle(document.querySelector('[data-topic-id=\"300\"] .sfp-unread-dot')).visibility==='hidden'")
        check('the reply count follows the refreshed payload', "document.querySelector('[data-topic-id=\"280\"] .sfp-unread-count')?.textContent==='7'")
        cdp.evaluate("document.querySelector('.sfp-load-more').click()")
        wait_for("document.querySelectorAll('.sfp-topic-item').length===60")
        check('pagination follows local page depth', "fixture.requests.some(r=>r.path==='/latest.json?order=activity&page=1') && !fixture.requests.some(r=>r.path.includes('page=8'))")
        cdp.evaluate("document.querySelector('.sfp-feed-scroll').scrollTop=1000")
        wait_for("document.querySelector('.sfp-refresh-btn').dataset.action==='back-top'")
        cdp.evaluate("fixture.publish('/latest',{message_type:'latest',topic_id:999,payload:fixture.topic(999)})")
        wait_for("document.querySelector('.sfp-refresh-btn').dataset.action==='incoming'")
        check('away-from-head activity stays queued', "!document.querySelector('[data-topic-id=\"999\"]') && document.querySelectorAll('.sfp-topic-item').length===60")
        cdp.evaluate("document.querySelector('.sfp-refresh-btn').click()")
        wait_for("!!document.querySelector('[data-topic-id=\"999\"]')")
        check('incoming click returns to head before applying', "document.querySelector('.sfp-feed-scroll').scrollTop<=1 && document.querySelectorAll('.sfp-topic-item').length===30")
        cdp.evaluate("fixture.publish('/delete',{message_type:'delete',topic_id:999})")
        check('topic lifecycle subscription survives independently', "document.querySelector('[data-topic-id=\"999\"]').textContent.includes('话题异常')")
        cdp.evaluate("fixture.publish('/delete',null);fixture.publish('/recover',undefined);fixture.publish('/destroy',{topic_id:'invalid',message_type:'destroy'})")
        check('malformed lifecycle messages leave the current feed usable', "document.querySelectorAll('.sfp-topic-item').length===30 && document.querySelector('[data-topic-id=\"999\"]').textContent.includes('话题异常')")
        cdp.evaluate("document.querySelector('.sfp-toggle-btn').click()")
        check('deactivate removes feed and message-bus subscriptions', "document.querySelectorAll('.sfp-feed-container').length===0 && [...fixture.subscriptions.values()].every(s=>s.size===0)")
        cdp.evaluate("document.querySelector('.sfp-toggle-btn').click()")
        wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
        cdp.evaluate("document.querySelector('#d-sidebar').replaceWith(Object.assign(document.createElement('aside'),{id:'d-sidebar',className:'sidebar-container'}))")
        wait_for("document.querySelectorAll('.sfp-topic-item').length===30 && !!document.querySelector('#d-sidebar .sfp-resizer')")
        check('host replacement remounts once without duplicate subscriptions', "document.querySelectorAll('.sfp-feed-container').length===1 && [...fixture.subscriptions.values()].every(s=>s.size===1)")
        check('the width handle carries an invisible 3x-wide grip in its middle', """(() => {
          // 5 px 的把手太细：里面挂一条不可见的宽条，宽 15 px（3 倍）、高 25%。
          const handle=document.querySelector('.sfp-resizer');
          const grip=handle.querySelector('.sfp-resizer-grip');
          if (!grip) return false;
          const h=handle.getBoundingClientRect(), g=grip.getBoundingClientRect();
          const style=getComputedStyle(grip);
          return Math.abs(g.width - h.width*3) <= 1 &&
            Math.abs(g.height - h.height/4) <= 1 &&
            Math.abs((g.top+g.bottom)/2 - (h.top+h.bottom)/2) <= 1 &&
            style.backgroundColor==='rgba(0, 0, 0, 0)' &&
            style.cursor==='ew-resize';
        })()""")
        check('the width grip straddles the sidebar edge so the outer half is hittable', """(() => {
          // 侧边栏在 feed 模式下不裁剪横向溢出，所以命中条可以直接挂在把手里面、
          // 伸出边界，边界外那半截照样能点。
          const sidebar=document.querySelector('#d-sidebar');
          const grip=sidebar.querySelector('.sfp-resizer > .sfp-resizer-grip');
          if (!grip) return false;
          const s=sidebar.getBoundingClientRect(), g=grip.getBoundingClientRect();
          if (!(g.left < s.right && g.right > s.right)) return false;
          const midY=g.top+g.height/2;
          const own=el => el===grip || grip.contains(el);
          return own(document.elementFromPoint(g.left+2, midY)) &&
            own(document.elementFromPoint(g.right-2, midY)) &&
            // 边界外 5 px 处：把手本身已不在那儿，全靠命中条。
            own(document.elementFromPoint(s.right+5, midY));
        })()""")
        check('feed mode does not clip the sidebar, and has no vertical overflow to lose', """(() => {
          // 放开裁剪的前提：两轴都是 visible（`overflow-x: visible` 无法与
          // `overflow-y: auto` 共存），而 feed 模式里本来也没有纵向溢出可丢。
          const sidebar=document.querySelector('#d-sidebar');
          const wrapper=sidebar.closest('.sidebar-wrapper') || sidebar.parentElement;
          return getComputedStyle(sidebar).overflowX==='visible' &&
            getComputedStyle(sidebar).overflowY==='visible' &&
            getComputedStyle(wrapper).overflowX==='visible' &&
            getComputedStyle(wrapper).overflowY==='visible' &&
            sidebar.scrollHeight <= sidebar.clientHeight + 1 &&
            wrapper.scrollHeight <= wrapper.clientHeight + 1;
        })()""")
        cdp.evaluate("fixture.pause=true;document.querySelector('.sfp-refresh-btn').click()")
        wait_for('fixture.pending.length===1')
        cdp.evaluate("document.querySelector('.sfp-toggle-btn').click();fixture.release()")
        check('late refresh cannot resurrect a deactivated feed', "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(!document.querySelector('.sfp-feed-container')))))")
        check('cache control API is still available', "typeof SFPFeedPanel.clearCaches==='function'")
        if cdp.evaluate("typeof SFPFeedPanel.dispose==='function'"):
            cdp.evaluate("document.querySelector('.sfp-toggle-btn').click()")
            wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
            # Each paused response captures a different snapshot. Resolve the newest
            # query first and the old A response last, even though fetch ignores abort.
            cdp.evaluate("fixture.pause=true;fixture.head[0].title='stale A';document.querySelector('.sfp-refresh-btn').click()")
            wait_for('fixture.pending.length===1')
            cdp.evaluate("document.querySelector('.sfp-tab-bar [data-tab=\"cat-1\"]').click()")
            wait_for('fixture.pending.length===2')
            cdp.evaluate("fixture.head[0].title='current A';document.querySelector('.sfp-tab-bar [data-tab=\"all\"]').click()")
            check('head query changes coalesce while the old request is pending', 'fixture.pending.length===2')
            cdp.evaluate("fixture.pause=false;fixture.pending.pop()()")
            wait_for("document.querySelector('[data-topic-id=\"300\"]')?.textContent.includes('current A')")
            cdp.evaluate("fixture.release()")
            check('A-B-A queries reject older snapshots even when cancellation is ignored', "new Promise(r=>requestAnimationFrame(()=>r(document.querySelector('[data-topic-id=\"300\"]').textContent.includes('current A'))))")

            cdp.evaluate("fixture.pause=true;fixture.head[0].title='stale filter';document.querySelector('.sfp-refresh-btn').click()")
            wait_for('fixture.pending.length===1')
            cdp.evaluate("document.querySelector('[data-filter=\"unseen\"]').click();document.querySelector('[data-filter=\"all\"]').click();fixture.release()")
            check('local filter changes also retire in-flight snapshots', "new Promise(r=>requestAnimationFrame(()=>r(document.querySelector('[data-topic-id=\"300\"]').textContent.includes('current A') && document.querySelector('.sfp-refresh-btn').getAttribute('aria-busy')==='false')))")

            cdp.evaluate("fixture.pause=true;document.querySelector('.sfp-refresh-btn').click()")
            wait_for('fixture.pending.length===1')
            cdp.evaluate("document.querySelector('.sfp-resizer').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:500}))")
            cdp.evaluate("document.querySelector('#d-sidebar').remove()")
            wait_for("!document.querySelector('.sfp-feed-container')")
            check('losing the host clears the width variables while the panel turns off', """(() => {
              const track=parseFloat(getComputedStyle(document.querySelector('#main-outlet-wrapper')).gridTemplateColumns.split(' ')[0]);
              const siteDefault=15*parseFloat(getComputedStyle(document.body).fontSize);
              return !document.documentElement.style.getPropertyValue('--d-sidebar-width') &&
                !document.body.style.getPropertyValue('--d-sidebar-width') &&
                !document.querySelector('#main-outlet-wrapper').style.getPropertyValue('--d-sidebar-width') &&
                Math.abs(track-siteDefault)<1;
            })()""")
            cdp.evaluate("SFPFeedPanel.dispose();fixture.release()")
            wait_for("fixture.effects.timeouts.size===0 && fixture.effects.intervals.size===0 && fixture.effects.frames.size===0")
            check('dispose cleans absent host, drag listeners, history, styles and queued effects', """!document.querySelector('.sfp-feed-container,.sfp-toggle-btn,.sfp-help-tooltip') &&
              [...fixture.subscriptions.values()].every(s=>s.size===0) &&
              fixture.effects.listeners.length===0 && history.pushState===fixture.originalPush &&
              history.replaceState===fixture.originalReplace && !document.body.style.cursor &&
              !document.documentElement.style.getPropertyValue('--d-sidebar-width') &&
              !document.body.style.getPropertyValue('--d-sidebar-width') &&
              !document.querySelector('#main-outlet-wrapper').style.getPropertyValue('--d-sidebar-width') &&
              ![...document.querySelectorAll('style')].some(s=>s.textContent.includes('.sfp-feed-scroll'))""")
            cdp.evaluate("document.body.append(Object.assign(document.createElement('aside'),{id:'d-sidebar',className:'sidebar-container'}));SFPFeedPanel.start();SFPFeedPanel.start()")
            wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
            check('restart is idempotent and preserves a single menu and subscription set', "document.querySelectorAll('.sfp-feed-container').length===1 && fixture.menus.length===1 && [...fixture.subscriptions.values()].every(s=>s.size===1)")
            cdp.evaluate("document.querySelector('.sfp-auto-silent-input').click();document.querySelector('.sfp-feed-scroll').scrollTop=1000")
            wait_for("document.querySelector('.sfp-refresh-btn').dataset.action==='back-top'")
            cdp.evaluate("fixture.publish('/latest',{message_type:'latest',topic_id:1200,payload:fixture.topic(1200)});document.querySelector('.sfp-refresh-btn').click();SFPFeedPanel.dispose()")
            wait_for("fixture.effects.timeouts.size===0 && fixture.effects.intervals.size===0 && fixture.effects.frames.size===0")
            check('dispose interrupts smooth return and disables automatic refresh', "fixture.effects.listeners.length===0 && !document.querySelector('.sfp-feed-container')")
            cdp.evaluate("""fixture.store.set(scoped('sfp_tag_style_cache_v1'),{version:1,locales:{'ja':{savedAt:1,entries:[['alpha',{cssText:'--color1: #123456',icon:'',hasIcon:false}]]}}});
              SFPFeedPanel.start()""")
            wait_for("!!document.querySelector('iframe[src=\"/tags\"]') && document.querySelectorAll('.sfp-topic-item').length===30")
            check('a tag style cache without the current page locale is not adopted', "[...document.querySelectorAll('.sfp-tag')].every(t=>!t.getAttribute('style'))")
            cdp.evaluate("SFPFeedPanel.dispose()")
            wait_for("!document.querySelector('iframe[src=\"/tags\"]') && fixture.effects.timeouts.size===0 && fixture.effects.frames.size===0")
            check('dispose removes a loading tag iframe and its polling timer', "fixture.effects.listeners.length===0 && fixture.effects.intervals.size===0")

            cdp.evaluate("""fixture.store.set(scoped('sfp_tag_style_cache_v1'),{version:1,locales:{'zh-cn':{savedAt:1,entries:[['alpha',{cssText:'--color1: #123456',icon:'',hasIcon:false}]]}}});
              fixture.store.set(scoped('sfp_auto_silent_refresh'),true);
              fixture.store.set(scoped('sfp_auto_silent_refresh_interval'),0);
              SFPFeedPanel.start();""")
            wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
            cdp.evaluate("""fixture.requests.length=0;
              for(let id=3000;id<3040;id++) fixture.publish('/new',{message_type:'new_topic',topic_id:id,payload:fixture.topic(id)});""")
            wait_for("!!document.querySelector('[data-topic-id=\"3039\"]')")
            check('zero-second silent refresh batches one message turn and caps details at one page', "fixture.requests.length===1 && new URL(fixture.requests[0].path,location.origin).searchParams.get('topic_ids').split(',').length===30 && document.querySelectorAll('.sfp-topic-item').length===30")
            cdp.evaluate("""fixture.requests.length=0;
              fixture.publish('/latest',{message_type:'latest',topic_id:4000,payload:fixture.topic(4000)});
              document.querySelector('[data-filter="unseen"]').click();
              document.querySelector('[data-filter="all"]').click();""")
            wait_for("!!document.querySelector('[data-topic-id=\"4000\"]')")
            check('filter changes in the same message turn cannot strand a queued silent refresh', "fixture.requests.length===1 && fixture.requests[0].path.includes('topic_ids=4000')")
            cdp.evaluate("""fixture.requests.length=0;fixture.head[20].unread_posts=4;
              fixture.publish('/latest',{message_type:'latest',topic_id:280,payload:{bumped_at:new Date().toISOString(),category_id:2,archetype:'regular'}});""")
            wait_for("document.querySelector('[data-topic-id=\"280\"] .sfp-unread-count')?.textContent==='4'")
            check('a silent refresh re-reads the reply count of a tracked topic', "fixture.requests.some(r=>r.path.includes('topic_ids=280'))")
            cdp.evaluate("fixture.requests.length=0;document.documentElement.lang='en'")
            wait_for("document.querySelector('.sfp-tab-bar [data-tab=\"all\"]')?.textContent.includes('All') && document.querySelectorAll('.sfp-topic-item').length===30")
            check('a page locale change without a reload rebuilds the panel in place', """(() => {
              const cache=fixture.store.get(scoped('sfp_tag_style_cache_v1'));
              return fixture.requests.some(r=>r.path==='/latest.json?order=activity&page=0') &&
                cache.locales['zh-cn'].entries.length===1;
            })()""")
            cdp.evaluate("document.documentElement.lang='zh-CN'")
            cdp.evaluate("new Promise(resolve=>setTimeout(resolve,400))")
            check('each page load reports one locale change only', "document.querySelector('.sfp-tab-bar [data-tab=\"all\"]').textContent.includes('All')")

            cdp.evaluate("""SFPFeedPanel.dispose();
              fixture.store.set(scoped('sfp_auto_silent_refresh'),false);
              fixture.store.set(scoped('sfp_current_filter'),'read');
              fixture.pageTopics=page=>Array.from({length:30},(_,i)=>fixture.topic(5000+page*30+i));
              fixture.requests.length=0;SFPFeedPanel.start();""")
            wait_for("!!document.querySelector('.sfp-load-more') && !document.querySelector('.sfp-loading')")

            def auto_scroll():
                cdp.evaluate("""(() => { const el=document.querySelector('.sfp-feed-scroll');
                  el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll')); })()""")

            def after_debounce():
                cdp.evaluate("new Promise(resolve=>setTimeout(resolve,380))")

            for page in range(1, 4):
                auto_scroll()
                wait_for(f"fixture.requests.some(r=>r.path==='/latest.json?order=activity&page={page}') && !document.querySelector('.sfp-load-more-spinner')")
            cdp.evaluate("fixture.beforeStop=fixture.requests.length;fixture.originalNow=Date.now;Date.now=()=>fixture.originalNow()+6000")
            auto_scroll()
            after_debounce()
            check('three empty filtered pages stop automatic loading beyond the rate window', "fixture.requests.length===fixture.beforeStop && document.querySelectorAll('.sfp-topic-item').length===0")
            cdp.evaluate("document.querySelector('.sfp-load-more').click()")
            wait_for("fixture.requests.some(r=>r.path.endsWith('page=4')) && !document.querySelector('.sfp-load-more-spinner')")
            check('manual loading bypasses the empty-result stop and explains no match', "fixture.requests.length===fixture.beforeStop+1 && !!document.querySelector('.sfp-load-more-note')")
            cdp.evaluate("Date.now=fixture.originalNow;document.querySelector('[data-filter=\"all\"]').click();fixture.rateStart=fixture.requests.length")
            for page in range(5, 8):
                auto_scroll()
                wait_for(f"fixture.requests.some(r=>r.path.endsWith('page={page}')) && !document.querySelector('.sfp-load-more-spinner')")
            auto_scroll()
            after_debounce()
            check('filter reset preserves depth and the fourth automatic request is rate-limited', "fixture.requests.length===fixture.rateStart+3 && document.querySelectorAll('.sfp-topic-item').length===240")
            cdp.evaluate("fixture.failNext=true;document.querySelector('.sfp-load-more').click()")
            wait_for("!!document.querySelector('.sfp-load-more-retry')")
            check('manual request bypasses rate gate and failure keeps loaded topics', "document.querySelectorAll('.sfp-topic-item').length===240")
            cdp.evaluate("document.querySelector('.sfp-load-more-retry').click()")
            wait_for("document.querySelectorAll('.sfp-topic-item').length===270")
            check('retry requests the failed page again without skipping depth', "fixture.requests.slice(-2).every(r=>r.path.endsWith('page=8')) && !document.querySelector('.sfp-load-more-error')")
            cdp.evaluate("SFPFeedPanel.dispose()")
            wait_for("!document.querySelector('.sfp-feed-container')")
            cdp.evaluate("""document.body.style.setProperty('--d-sidebar-width','777px');
              SFPFeedPanel.start();""")
            wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
            cdp.evaluate("SFPFeedPanel.dispose()")
            wait_for("!document.querySelector('.sfp-feed-container')")
            check('dispose restores the pre-existing inline width value', "document.body.style.getPropertyValue('--d-sidebar-width')==='777px'")
            time.sleep(.12)
            check('dispose leaves the width variables cleared', """!document.documentElement.style.getPropertyValue('--d-sidebar-width') &&
              !document.querySelector('#main-outlet-wrapper').style.getPropertyValue('--d-sidebar-width') &&
              document.body.style.getPropertyValue('--d-sidebar-width')==='777px'""")
            time.sleep(.3)
            check('the width stays cleared after the animation window', """!document.documentElement.style.getPropertyValue('--d-sidebar-width') &&
              !document.querySelector('#main-outlet-wrapper').style.getPropertyValue('--d-sidebar-width') &&
              document.body.style.getPropertyValue('--d-sidebar-width')==='777px'""")
            cdp.evaluate("document.body.style.removeProperty('--d-sidebar-width')")
            cdp.evaluate("""fixture.store.set(scoped('sfp_feed_mode_enabled'),false);
              document.querySelector('#d-sidebar').style.setProperty('width','555px','important');
              SFPFeedPanel.start();""")
            wait_for("document.querySelectorAll('.sfp-toggle-btn').length===1")
            time.sleep(.2)
            cdp.evaluate("SFPFeedPanel.dispose()")
            time.sleep(.2)
            check('a disabled feed leaves the host inline width untouched', """!document.querySelector('.sfp-feed-container') &&
              document.querySelector('#d-sidebar').style.getPropertyValue('width')==='555px'""")
            cdp.evaluate("""document.querySelector('#d-sidebar').style.removeProperty('width');
              fixture.store.set(scoped('sfp_feed_mode_enabled'),true)""")

        # --- 稍后再读 ---
        # 匿名会话：预览端点一次都不该被请求。
        cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
        cdp.event('Page.loadEventFired')
        cdp.evaluate(source)
        wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
        cdp.evaluate("""window.dragTo=(selector, uri, plain) => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', uri);
            if (plain) dt.setData('text/plain', plain);
            const target = document.querySelector(selector);
            target.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };
          window.startDrag=(selector) => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', '');
            document.querySelector(selector).dispatchEvent(new DragEvent('dragstart', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };""")
        check('an empty read-later section stays hidden', """(() => {
          const section = document.querySelector('.sfp-read-later');
          return !!section && section.hidden && !document.querySelector('.sfp-rl-item');
        })()""")
        cdp.evaluate("startDrag('.sfp-feed-scroll .sfp-topic-item')")
        check('dragging a feed link reveals the drop placeholder', """(() => {
          const section = document.querySelector('.sfp-read-later');
          return !section.hidden && !!section.querySelector('.sfp-rl-drop');
        })()""")
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/t/299')")
        wait_for("""document.querySelectorAll('.sfp-rl-item .sfp-topic-item').length===1""")
        check('dropping a topic adds a read-later topic item and persists it', """(() => {
          const stored = JSON.parse(localStorage.getItem('sfp_read_later_v1') || '{}');
          return stored.items.length===1 && stored.items[0].topicId===299 &&
            document.querySelector('.sfp-rl-item .sfp-topic-item').dataset.topicId==='299';
        })()""")
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/t/298')")
        wait_for("""document.querySelectorAll('.sfp-rl-item').length===2""")
        check('new entries stack upward with the newest on top', """(() => {
          const items = [...document.querySelectorAll('.sfp-rl-item')];
          // 存储「新 → 旧」，DOM 按同序写入，所以最新条目在最上方。
          return items[0].dataset.url==='/t/298' && items[1].dataset.url==='/t/299' &&
            items[0].getBoundingClientRect().top < items[1].getBoundingClientRect().top;
        })()""")
        cdp.evaluate("""dragTo('.sfp-read-later', 'https://elsewhere.example/t/1');
          dragTo('.sfp-read-later', 'javascript:alert(1)');""")
        check('cross-origin and javascript drops are rejected', """document.querySelectorAll('.sfp-rl-item').length===2 &&
          JSON.parse(localStorage.getItem('sfp_read_later_v1') || '{}').items.length===2""")
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/about')")
        wait_for("""document.querySelectorAll('.sfp-rl-item').length===3""")
        check('an anonymous session renders the link-preview fallback without any onebox request', """(() => {
          const item = document.querySelector('.sfp-rl-item[data-url="/about"]');
          return !!item && !!item.querySelector('.sfp-rl-fallback') &&
            item.querySelector('.sfp-rl-fallback-title').textContent==='about' &&
            item.querySelector('.sfp-rl-fallback-note').textContent==='链接预览' &&
            !item.querySelector('.sfp-rl-card') &&
            fixture.oneboxRequests.length===0;
        })()""")
        cdp.evaluate("""window.rlSection=document.querySelector('.sfp-read-later');
          window.rlDivider=document.querySelector('.sfp-rl-divider');""")
        check('the divider is a sibling of the section, not part of it', """rlDivider.parentElement===rlSection.parentElement &&
          rlDivider.nextElementSibling===rlSection && !rlSection.contains(rlDivider)""")
        check('the divider is the only boundary between the two areas', """(() => {
          const divider=rlDivider.getBoundingClientRect();
          const section=rlSection.getBoundingClientRect();
          return Math.abs(section.top-divider.bottom)<=1 &&
            getComputedStyle(rlSection).borderTopWidth==='0px';
        })()""")
        check('the list is pinned to the bottom edge of its scroll area', """(() => {
          // `column-reverse` 让主轴原点落在底部：内容不足时靠底，内容溢出时
          // `scrollTop = 0` 也是贴底，所以列表底边永远与滚动区底边重合。
          const scroll=document.querySelector('.sfp-rl-scroll').getBoundingClientRect();
          const list=document.querySelector('.sfp-rl-list').getBoundingClientRect();
          return Math.abs(list.bottom-scroll.bottom)<=1;
        })()""")
        check('the divider hit area is two invisible circles, not just the 3 px line', """(() => {
          // 线本身只有 3 px；命中判定靠中心与右端两个不可见小圆，直径是线高的 10 倍。
          const grips=[...rlDivider.querySelectorAll('.sfp-rl-grip')];
          if (grips.length!==2) return false;
          const line=rlDivider.getBoundingClientRect();
          const center=grips[0].getBoundingClientRect();
          const end=grips[1].getBoundingClientRect();
          return grips.every(g => {
            const r=g.getBoundingClientRect(), style=getComputedStyle(g);
            return Math.abs(r.width - line.height*10) <= 1 &&
              Math.abs(r.height - line.height*10) <= 1 &&
              style.backgroundColor==='rgba(0, 0, 0, 0)' && style.borderRadius==='50%';
          }) &&
            Math.abs((center.left+center.right)/2 - (line.left+line.right)/2) <= 1 &&
            // 右端的圆整个贴在边界内：右边与宽度分割线相切，不越界（越界会被裁掉）。
            Math.abs(end.right - line.right) <= 1;
        })()""")
        check('both divider grips can be hit above and below the line', """(() => {
          // 圆的上下两半分别在主区域与稍后再读区域里：区域有背景且 DOM 在后，
          // 分隔线必须抬到区域之上，否则下半截的点击会被区域吃掉。
          const hits=[...rlDivider.querySelectorAll('.sfp-rl-grip')].map(g => {
            const r=g.getBoundingClientRect();
            const cx=r.left+r.width/2;
            const above=document.elementFromPoint(cx, r.top+2);
            const below=document.elementFromPoint(cx, r.bottom-2);
            const own=el => el===g || g.contains(el) || el?.contains(g);
            return own(above) && own(below);
          });
          return hits.every(Boolean) && !rlSection.hidden;
        })()""")
        check('the height stays at one item no matter how many entries there are', """(() => {
          // 加第二条不自动长高：没拖过分隔线就是「一个条目高」，取最底下那条。
          const nodes = document.querySelectorAll('.sfp-rl-item');
          const bottom = nodes[nodes.length-1].offsetHeight;
          return nodes.length===3 && Math.abs(rlSection.offsetHeight - bottom) <= 2;
        })()""")
        cdp.evaluate("""window.beforeDividerDrag=(() => {
            const scroll=document.querySelector('.sfp-rl-scroll');
            const first=document.querySelector('.sfp-rl-item').getBoundingClientRect();
            return {top: first.top, scrollTop: scroll.scrollTop,
              height: document.querySelector('.sfp-read-later').offsetHeight};
          })()""")
        cdp.evaluate("""const divider=document.querySelector('.sfp-rl-divider');
          divider.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientY:200}));
          document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientY:160}));
          document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientY:160}));""")
        wait_for("localStorage.getItem('sfp_read_later_height_v1')!==null")
        check('dragging the divider persists the height once', """(() => {
          const saved = Number(localStorage.getItem('sfp_read_later_height_v1'));
          return saved > 0 && Math.abs(rlSection.offsetHeight - saved) <= 2;
        })()""")
        cdp.evaluate("""window.gripBefore=rlSection.offsetHeight;
          window.gripDrag=(() => {
            // 从右端的小圆上按下：pointerdown 冒泡回分隔线，拖拽逻辑一行都不用改。
            const grip=document.querySelector('.sfp-rl-grip-end');
            const r=grip.getBoundingClientRect(), y=r.top+r.height/2;
            grip.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:r.left+r.width/2,clientY:y}));
            document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientY:y-40}));
            document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientY:y-40}));
            return {before:gripBefore, after:rlSection.offsetHeight};
          })()""")
        check('the divider can be dragged from its invisible grip', "gripDrag.after > gripDrag.before + 10")
        check('dragging the divider resizes the region without moving the content', """(() => {
          // 内容从下往上算：底边固定、滚动原点在底部，所以高度变了条目也不动。
          const first=document.querySelector('.sfp-rl-item').getBoundingClientRect();
          const scroll=document.querySelector('.sfp-rl-scroll');
          return Math.abs(rlSection.offsetHeight-beforeDividerDrag.height)>10 &&
            Math.abs(first.top-beforeDividerDrag.top)<=1 &&
            scroll.scrollTop===beforeDividerDrag.scrollTop;
        })()""")
        cdp.evaluate("""window.savedHeight=Number(localStorage.getItem('sfp_read_later_height_v1'));
          dragTo('.sfp-read-later', location.origin + '/t/297');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===4")
        check('a manually dragged height no longer follows the item count', """Math.abs(rlSection.offsetHeight - savedHeight) <= 2""")
        cdp.evaluate("""window.feedScroll=document.querySelector('.sfp-feed-scroll');
          window.roomyHeight=rlSection.offsetHeight;
          window.chromeHeight=feedScroll.offsetTop;
          document.querySelector('#d-sidebar').style.height=(chromeHeight+100)+'px';
          window.dispatchEvent(new Event('resize'));""")
        time.sleep(.15)
        check('a too-short panel locks the divider and splits the room in half', """(() => {
          const divider=document.querySelector('.sfp-rl-divider');
          const room=document.querySelector('.sfp-feed-container').clientHeight
            - feedScroll.offsetTop - divider.offsetHeight;
          return divider.getAttribute('aria-disabled')==='true' &&
            !divider.hasAttribute('aria-valuenow') &&
            Math.abs(rlSection.offsetHeight - Math.floor(room/2)) <= 1;
        })()""")
        cdp.evaluate("""document.querySelector('.sfp-rl-divider').dispatchEvent(
            new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));""")
        check('a locked divider ignores the keyboard', """(() => {
          const divider=document.querySelector('.sfp-rl-divider');
          const room=document.querySelector('.sfp-feed-container').clientHeight
            - feedScroll.offsetTop - divider.offsetHeight;
          return rlSection.offsetHeight===Math.floor(room/2);
        })()""")
        cdp.evaluate("""document.querySelector('#d-sidebar').style.height='700px';
          window.dispatchEvent(new Event('resize'));""")
        time.sleep(.15)
        check('restoring the height returns to the user value and unlocks the divider', """(() => {
          const divider=document.querySelector('.sfp-rl-divider');
          return !divider.hasAttribute('aria-disabled') &&
            Math.abs(rlSection.offsetHeight - savedHeight) <= 2;
        })()""")
        # 区域内的拖动 = 搬动：拖到别的条目上排序，拖出区域删除。
        cdp.evaluate("""window.rlItems=() => [...document.querySelectorAll('.sfp-rl-item')].map(i=>i.dataset.url);
          window.dragItem=(url, targetUrl, where) => {
            const item=document.querySelector(`.sfp-rl-item[data-url="${url}"]`);
            const dt=new DataTransfer();
            item.querySelector('a').dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
            const mark={effectAllowed:dt.effectAllowed, internal:dt.getData('application/x-sfp-read-later')};
            const section=document.querySelector('.sfp-read-later');
            if (!targetUrl) {
              section.dispatchEvent(new DragEvent('dragleave',{bubbles:true,dataTransfer:dt,relatedTarget:document.body}));
              document.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));
              return mark;
            }
            const target=document.querySelector(`.sfp-rl-item[data-url="${targetUrl}"]`);
            const rect=target.getBoundingClientRect();
            const clientY= where==='before' ? rect.top+2 : rect.bottom-2;
            section.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientY}));
            section.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientY}));
            return mark;
          };
          window.beforeOrder=rlItems();
          // 把最旧的（视觉最下）拖到最上方。
          window.lastMark=dragItem('/t/299', '/t/297', 'before');""")
        wait_for("JSON.stringify(rlItems())!==JSON.stringify(beforeOrder)")
        check('a read-later drag carries the internal move marker', """lastMark.internal==='/t/299'""")
        check('dragging an entry onto another reorders the list', """(() => {
          const order=rlItems();
          const stored=JSON.parse(localStorage.getItem('sfp_read_later_v1')).items.map(i=>i.url);
          // DOM 顺序 = 存储顺序 = 从上到下的视觉顺序，三者一致。
          return order[0]==='/t/299' && order.length===beforeOrder.length &&
            JSON.stringify(stored)===JSON.stringify(order);
        })()""")
        check('an internal drag shows no add overlay', """document.querySelector('.sfp-rl-drop').hidden""")
        cdp.evaluate("dragItem('/t/299')")
        wait_for("!rlItems().includes('/t/299')")
        check('dragging an entry out of the region removes it', """(() => {
          const order=rlItems();
          return !order.includes('/t/299') &&
            !JSON.parse(localStorage.getItem('sfp_read_later_v1')).items.some(i=>i.url==='/t/299');
        })()""")
        check('the read-later area no longer has remove buttons', """!document.querySelector('.sfp-rl-remove')""")
        cdp.evaluate("""window.removalCounts=[];
          while (rlItems().length) {
            dragItem(rlItems()[0]);
            removalCounts.push(rlItems().length);
            if (removalCounts.length > 10) break;
          }""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        check('each drag-out drops exactly one item and the last one hides the section', """(() => {
          const section = document.querySelector('.sfp-read-later');
          return removalCounts.join(',')==='2,1,0' && section.hidden &&
            !document.querySelector('.sfp-rl-item');
        })()""")
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          localStorage.removeItem('sfp_read_later_height_v1');""")

        # 从主列表的发布者区域拖出：拿到的是资料页，不是话题页。
        # 带真实指针坐标，走 `elementFromPoint` 那条最准的路径。
        cdp.evaluate("""window.dragFrom=(selector, uri) => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', uri);
            const node = document.querySelector(selector);
            const rect = node.getBoundingClientRect();
            node.dispatchEvent(new DragEvent('dragstart', {bubbles:true, cancelable:true, dataTransfer:dt,
              clientX: Math.round(rect.left + rect.width/2), clientY: Math.round(rect.top + rect.height/2)}));
            document.querySelector('.sfp-read-later').dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };
          dragFrom('.sfp-feed-scroll .sfp-topic-item .sfp-topic-username',
            document.querySelector('.sfp-feed-scroll .sfp-topic-item').href);""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('dragging the poster area saves the profile, not the topic', """(() => {
          const item=document.querySelector('.sfp-rl-item');
          return item.dataset.url==='/u/alice' && !item.querySelector('.sfp-topic-item');
        })()""")
        # 昵称（name）与文本选区两种拖拽起点都要落到资料页。
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        cdp.evaluate("""window.dragFromName=(selector) => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', document.querySelector('.sfp-feed-scroll .sfp-topic-item').href);
            document.querySelector(selector).dispatchEvent(new DragEvent('dragstart', {bubbles:true, cancelable:true, dataTransfer:dt, clientX:-1, clientY:-1}));
            document.querySelector('.sfp-read-later').dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };
          dragFromName('.sfp-feed-scroll .sfp-topic-item .sfp-topic-name');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('dragging the display name saves the profile too', """document.querySelector('.sfp-rl-item').dataset.url==='/u/alice'""")
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        # 发布者区域整块（含昵称与用户名之间的空隙）都要认成资料页。
        cdp.evaluate("""window.dragFromArea=() => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', document.querySelector('.sfp-feed-scroll .sfp-topic-item').href);
            document.querySelector('.sfp-feed-scroll .sfp-topic-item .sfp-topic-user-info')
              .dispatchEvent(new DragEvent('dragstart', {bubbles:true, cancelable:true, dataTransfer:dt, clientX:-1, clientY:-1}));
            document.querySelector('.sfp-read-later').dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };
          dragFromArea();""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('dragging the poster info row saves the profile', """document.querySelector('.sfp-rl-item').dataset.url==='/u/alice'""")
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        cdp.evaluate("""(() => {
            // 文本拖拽时 dragstart 的 target 可能退到整张卡片，只剩选区能定位来源。
            const username=document.querySelector('.sfp-feed-scroll .sfp-topic-item .sfp-topic-username');
            const range=document.createRange();
            range.selectNodeContents(username);
            const selection=document.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            const dt=new DataTransfer();
            dt.setData('text/uri-list', document.querySelector('.sfp-feed-scroll .sfp-topic-item').href);
            document.querySelector('.sfp-feed-scroll .sfp-topic-item')
              .dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:-1,clientY:-1}));
            document.querySelector('.sfp-read-later')
              .dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
            selection.removeAllRanges();
          })()""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('a text drag whose target falls back to the card still saves the profile', """document.querySelector('.sfp-rl-item').dataset.url==='/u/alice'""")
        # 主列表已有的话题：直接复制快照，不再发补全请求。
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        cdp.evaluate("""fixture.requests.length=0;
          dragTo('.sfp-read-later', location.origin + '/t/299');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('a topic already in the main list is copied without another request', """(() => {
          const item=document.querySelector('.sfp-rl-item .sfp-topic-item');
          return !!item && item.dataset.topicId==='299' &&
            !fixture.requests.some(r=>r.path.includes('topic_ids'));
        })()""")
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          localStorage.removeItem('sfp_read_later_height_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")

        # 分隔线只是一条线；区域贴着容器底部；改窗口大小不搬动内容。
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/t/299')")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('the divider is a bare line with no padding band', """(() => {
          const divider=document.querySelector('.sfp-rl-divider');
          return divider.offsetHeight<=4 &&
            getComputedStyle(divider).backgroundColor!=='rgba(0, 0, 0, 0)';
        })()""")
        cdp.evaluate("""(() => {
          const divider=document.querySelector('.sfp-rl-divider');
          divider.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientY:400}));
          document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientY:300}));
          document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientY:300}));
        })()""")
        wait_for("localStorage.getItem('sfp_read_later_height_v1')!==null")
        cdp.evaluate("dragItem(rlItems()[0])")
        wait_for("document.querySelector('.sfp-read-later').hidden")
        check('emptying the list forgets the dragged height', """localStorage.getItem('sfp_read_later_height_v1')===null""")
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/t/299')")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('a re-added item starts again at one item height', """(() => {
          const section=document.querySelector('.sfp-read-later');
          const item=document.querySelector('.sfp-rl-item');
          return Math.abs(section.offsetHeight - item.offsetHeight) <= 2;
        })()""")
        cdp.evaluate("""dragTo('.sfp-read-later', location.origin + '/t/298');
          dragTo('.sfp-read-later', location.origin + '/t/297');
          dragTo('.sfp-read-later', location.origin + '/t/296');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===4")
        check('a new item appears above the older ones', """(() => {
          const items=[...document.querySelectorAll('.sfp-rl-item')];
          const urls=items.map(i=>i.dataset.url);
          const newest=items.find(i=>i.dataset.url==='/t/296');
          const older=items.find(i=>i.dataset.url==='/t/299');
          return urls[0]==='/t/296' && newest.getBoundingClientRect().top <
            older.getBoundingClientRect().top;
        })()""")
        check('the read-later scrollbar matches the main list', """(() => {
          const a=getComputedStyle(document.querySelector('.sfp-rl-scroll'));
          const b=getComputedStyle(document.querySelector('.sfp-feed-scroll'));
          return a.scrollbarColor===b.scrollbarColor && a.scrollbarGutter===b.scrollbarGutter;
        })()""")
        # 拖分隔线只改变可见窗口：滚动位置不动（不再被强行拉到底部）。
        cdp.evaluate("""window.beforeResize=(() => {
            const scroll=document.querySelector('.sfp-rl-scroll');
            scroll.scrollTop=0;
            return {
              scrollTop: scroll.scrollTop,
              scrollBottom: scroll.getBoundingClientRect().bottom,
              height: document.querySelector('.sfp-read-later').offsetHeight,
            };
          })()""")
        cdp.evaluate("""(() => {
          const divider=document.querySelector('.sfp-rl-divider');
          divider.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientY:400}));
          document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientY:330}));
          document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientY:330}));
        })()""")
        time.sleep(.12)
        check('dragging the divider does not move the scroll position', """(() => {
          const scroll=document.querySelector('.sfp-rl-scroll');
          return document.querySelector('.sfp-read-later').offsetHeight > beforeResize.height &&
            scroll.scrollTop===beforeResize.scrollTop &&
            Math.abs(scroll.getBoundingClientRect().bottom-beforeResize.scrollBottom)<=2;
        })()""")
        cdp.evaluate("startDrag('.sfp-feed-scroll .sfp-topic-item')")
        check('the drop frame covers the whole region and sits above the items', """(() => {
          const overlay=document.querySelector('.sfp-rl-drop');
          const section=document.querySelector('.sfp-read-later');
          const o=overlay.getBoundingClientRect(), s=section.getBoundingClientRect();
          const style=getComputedStyle(overlay);
          const first=document.querySelector('.sfp-rl-item');
          return !overlay.hidden && overlay.parentElement===section &&
            o.top<=s.top+3 && o.bottom>=s.bottom-3 &&
            style.position==='absolute' && Number(style.zIndex)>0 &&
            (overlay.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_PRECEDING)!==0;
        })()""")
        check('the overlay asks you to drag in before you enter', """(() => {
          const overlay=document.querySelector('.sfp-rl-drop');
          return !overlay.classList.contains('sfp-rl-drop-active') &&
            overlay.textContent.trim()==='拖进加入稍后再读';
        })()""")
        # 悬停在主列表（面板的其余部分）不算进入区域：落点范围只限分隔线以下。
        cdp.evaluate("""(() => {
          const dt=new DataTransfer();
          dt.setData('text/uri-list', location.origin + '/about');
          const main=document.querySelector('.sfp-feed-scroll');
          main.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
        })()""")
        check('hovering the main list does not count as entering the region', """(() => {
          const overlay=document.querySelector('.sfp-rl-drop');
          return !overlay.classList.contains('sfp-rl-drop-active') &&
            overlay.textContent.trim()==='拖进加入稍后再读';
        })()""")
        cdp.evaluate("""(() => {
          const section=document.querySelector('.sfp-read-later');
          const dt=new DataTransfer();
          dt.setData('text/uri-list', location.origin + '/about');
          section.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
        })()""")
        check('entering the region switches to the release wording and deepens the shade', """(() => {
          const overlay=document.querySelector('.sfp-rl-drop');
          const style=getComputedStyle(overlay);
          return overlay.classList.contains('sfp-rl-drop-active') &&
            overlay.textContent.trim()==='松开加入稍后再读' &&
            style.backgroundColor!=='rgba(0, 0, 0, 0)';
        })()""")
        cdp.evaluate("""(() => {
          // 退回主列表：落点高亮必须撤回。
          const dt=new DataTransfer();
          dt.setData('text/uri-list', location.origin + '/about');
          document.querySelector('.sfp-read-later').dispatchEvent(
            new DragEvent('dragleave',{bubbles:true,dataTransfer:dt,relatedTarget:document.body}));
        })()""")
        check('leaving the region takes the highlight back', """(() => {
          const overlay=document.querySelector('.sfp-rl-drop');
          return !overlay.classList.contains('sfp-rl-drop-active') &&
            overlay.textContent.trim()==='拖进加入稍后再读';
        })()""")
        cdp.evaluate("document.dispatchEvent(new DragEvent('dragend'))")
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          localStorage.removeItem('sfp_read_later_height_v1');""")

        # 登录会话：预览卡片走 /onebox，失败与限流都降级。
        cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
        cdp.event('Page.loadEventFired')
        cdp.evaluate("fixture.currentUser={id:1,username:'alice'}")
        cdp.evaluate(source)
        wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
        cdp.evaluate("""window.dragTo=(selector, uri) => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', uri);
            document.querySelector(selector).dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };""")
        # 预览在飞时不显示任何加载行：条目立刻以占位卡片出现。
        cdp.evaluate("""fixture.oneboxDelay=700;
          dragTo('.sfp-read-later', location.origin + '/u/alice');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        time.sleep(.12)
        check('a pending preview shows no loading row and no extra height', """(() => {
          const section=document.querySelector('.sfp-read-later');
          return !section.querySelector('.sfp-rl-pending') &&
            !/加载中/.test(section.textContent) &&
            !!section.querySelector('.sfp-rl-fallback') &&
            Math.abs(section.offsetHeight - document.querySelector('.sfp-rl-item').offsetHeight) <= 2;
        })()""")
        wait_for("!!document.querySelector('.sfp-rl-card')")
        cdp.evaluate("fixture.oneboxDelay=0")
        check('the preview request matches the editor parameters', """(() => {
          const request = fixture.requests.find(r=>r.path.startsWith('/onebox'));
          return !!request && request.path.includes('refresh=true') &&
            request.xhr==='XMLHttpRequest' && request.credentials==='include';
        })()""")
        check('a logged-in session renders the onebox preview card', """(() => {
          const card = document.querySelector('.sfp-rl-card');
          return fixture.oneboxRequests.length===1 &&
            card.querySelector('.sfp-rl-card-title').textContent==='Preview title' &&
            card.querySelector('.sfp-rl-card-excerpt').textContent==='Preview excerpt' &&
            card.querySelector('.sfp-rl-card-image').getAttribute('src')===location.origin + '/uploads/preview.png';
        })()""")
        # 移除再加回来：已经拿到的预览留在页内缓存里，不该再发一次请求。
        cdp.evaluate("""window.removeRlItem=(url) => {
            const item=document.querySelector(`.sfp-rl-item[data-url="${url}"]`);
            const dt=new DataTransfer();
            item.querySelector('a').dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
            document.querySelector('.sfp-read-later').dispatchEvent(
              new DragEvent('dragleave',{bubbles:true,dataTransfer:dt,relatedTarget:document.body}));
            document.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));
          };
          window.oneboxBefore=fixture.oneboxRequests.length;
          removeRlItem('/u/alice');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/u/alice')")
        wait_for("!!document.querySelector('.sfp-rl-card')")
        time.sleep(.3)
        check('removing a link and adding it back reuses the cached preview', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/u/alice"]');
          return fixture.oneboxRequests.length===oneboxBefore &&
            fixture.oneboxRequests.filter(u=>u.endsWith('/u/alice')).length===1 &&
            !!item && !!item.querySelector('.sfp-rl-card');
        })()""")
        # 直接重新拖入已在列表里的链接：移到最新位置，保留预览，不再请求。
        cdp.evaluate("""dragTo('.sfp-read-later', location.origin + '/t/299');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===2")
        cdp.evaluate("""window.rlUrls=() => [...document.querySelectorAll('.sfp-rl-item')].map(i=>i.dataset.url);
          window.orderBeforeRedrag=rlUrls();
          window.requestsBeforeRedrag=fixture.oneboxRequests.length;
          dragTo('.sfp-read-later', location.origin + '/u/alice');""")
        time.sleep(.35)
        check('re-dragging an existing link moves it to the newest position', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/u/alice"]');
          const order=rlUrls();
          return order[0]==='/u/alice' && order[1]==='/t/299' &&
            orderBeforeRedrag[0]==='/t/299' &&
            order.length===orderBeforeRedrag.length &&
            fixture.oneboxRequests.length===requestsBeforeRedrag &&
            !!item && !!item.querySelector('.sfp-rl-card');
        })()""")
        # 话题先取 latest，拿不到快照才退到 /onebox：成功时不并发预览请求。
        # 9010 不在主列表里，所以必须靠 topic_ids 补快照。
        cdp.evaluate("""dragTo('.sfp-read-later', location.origin + '/t/9010');""")
        wait_for("!!document.querySelector('.sfp-rl-item[data-url=\"/t/9010\"] .sfp-topic-item')")
        time.sleep(.35)
        check('a topic resolved by latest never fires a onebox preview', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/t/9010"]');
          return fixture.requests.some(r=>r.path.includes('topic_ids=9010')) &&
            !fixture.oneboxRequests.some(u=>u.endsWith('/t/9010')) &&
            !!item?.querySelector('.sfp-topic-item') && !item.querySelector('.sfp-rl-card');
        })()""")
        # 页内快照缓存：删掉再加回来不再请求 latest，直接渲染话题条目。
        cdp.evaluate("""window.topicRequestsBefore=fixture.requests.filter(r=>r.path.includes('topic_ids')).length;
          removeRlItem('/t/9010');""")
        wait_for("!document.querySelector('.sfp-rl-item[data-url=\"/t/9010\"]')")
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/t/9010')")
        wait_for("!!document.querySelector('.sfp-rl-item[data-url=\"/t/9010\"] .sfp-topic-item')")
        time.sleep(.3)
        check('re-adding a removed topic reuses the page snapshot cache', """(() => {
          const asked=fixture.requests.filter(r=>r.path.includes('topic_ids')).length;
          return asked===topicRequestsBefore &&
            !fixture.oneboxRequests.some(u=>u.endsWith('/t/9010'));
        })()""")
        # latest 整批失败也不发预览：按 id 取 TopicView 照样能补上快照。
        cdp.evaluate("""window.topicOneboxBefore=fixture.oneboxRequests.length;
          fixture.failNext=true;
          dragTo('.sfp-read-later', location.origin + '/t/9011');""")
        wait_for("!!document.querySelector('.sfp-rl-item[data-url=\"/t/9011\"] .sfp-topic-item')")
        time.sleep(.45)
        check('a topic whose latest fetch fails is still resolved per id, never previewed', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/t/9011"]');
          return fixture.oneboxRequests.length===topicOneboxBefore &&
            fixture.requests.some(r=>r.path==='/t/9011.json') &&
            !!item?.querySelector('.sfp-topic-item') && !item.querySelector('.sfp-rl-card');
        })()""")
        # 200 但列表里没有、按 id 又回 404：标成话题异常，同样不发预览。
        cdp.evaluate("""fixture.failNext=false;
          fixture.missingTopicIds=[9012];
          fixture.goneTopicIds=[9012];
          window.missingOneboxBefore=fixture.oneboxRequests.length;
          dragTo('.sfp-read-later', location.origin + '/t/9012');""")
        wait_for("!!document.querySelector('.sfp-rl-item[data-url=\"/t/9012\"] .sfp-topic-unavailable')")
        time.sleep(.45)
        check('a topic missing everywhere is marked unavailable, not previewed', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/t/9012"]');
          return fixture.oneboxRequests.length===missingOneboxBefore &&
            fixture.requests.some(r=>r.path==='/t/9012.json') &&
            !!item?.querySelector('.sfp-topic-unavailable') && !item.querySelector('.sfp-rl-card');
        })()""")
        cdp.evaluate("""fixture.missingTopicIds=[];
          fixture.goneTopicIds=[];
          removeRlItem('/t/9012'); removeRlItem('/t/9011'); removeRlItem('/t/9010');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===2")
        # onebox 失败 → 读目标页 head 的 OG 标签兜底。
        cdp.evaluate("""fixture.pageOg={title:'OG Title',description:'OG description text',image:'/uploads/og.png'};
          fixture.oneboxHtml=()=>'<a href="#">nothing</a>';
          dragTo('.sfp-read-later', location.origin + '/u/erin');""")
        wait_for("!!document.querySelector('.sfp-rl-item[data-url=\"/u/erin\"] .sfp-rl-card')")
        check('a failed onebox falls back to the page Open Graph tags', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/u/erin"]');
          const card=item.querySelector('.sfp-rl-card');
          return fixture.headRequests.includes('/u/erin') &&
            card.querySelector('.sfp-rl-card-title').textContent==='OG Title' &&
            card.querySelector('.sfp-rl-card-excerpt').textContent==='OG description text' &&
            card.querySelector('.sfp-rl-card-image').getAttribute('src')===location.origin + '/uploads/og.png';
        })()""")
        cdp.evaluate("""fixture.pageOg=null;
          fixture.oneboxHtml=null;
          removeRlItem('/u/erin');""")
        wait_for("!document.querySelector('.sfp-rl-item[data-url=\"/u/erin\"]')")
        # 200 也可能是失败：`<a href="url">url</a>` 兜底照样是 200，必须按失败处理。
        cdp.evaluate("""fixture.oneboxHtml=(target)=>`<a href="${target}">${target}</a>`;
          dragTo('.sfp-read-later', location.origin + '/u/bob');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===3")
        time.sleep(.4)
        check('a 200 with the bare-anchor fallback counts as a failed preview', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/u/bob"]');
          return !!item && !!item.querySelector('.sfp-rl-fallback') &&
            !item.querySelector('.sfp-rl-card');
        })()""")
        # 失败不进缓存：删掉再加回来要重新试一次，而不是永远卡在降级卡片。
        cdp.evaluate("""window.bobBefore=fixture.oneboxRequests.filter(u=>u.endsWith('/u/bob')).length;
          removeRlItem('/u/bob');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===2")
        cdp.evaluate("dragTo('.sfp-read-later', location.origin + '/u/bob')")
        wait_for("fixture.oneboxRequests.filter(u=>u.endsWith('/u/bob')).length>bobBefore")
        check('a failed preview is retried after the entry is re-added', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/u/bob"]');
          return fixture.oneboxRequests.filter(u=>u.endsWith('/u/bob')).length===bobBefore+1 &&
            !!item && !!item.querySelector('.sfp-rl-fallback');
        })()""")
        cdp.evaluate("""fixture.oneboxHtml=null;
          localStorage.removeItem('sfp_read_later_v1');
          localStorage.removeItem('sfp_read_later_height_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        cdp.evaluate("""dragTo('.sfp-read-later', location.origin + '/u/dave');""")
        wait_for("!!document.querySelector('.sfp-rl-card')")
        cdp.evaluate("""fixture.oneboxStatus=403;
          dragTo('.sfp-read-later', location.origin + '/c/dev/3');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===2")
        time.sleep(.4)
        check('a 403 downgrades preview availability for the rest of the page', """(() => {
          const item = document.querySelector('.sfp-rl-item[data-url="/c/dev/3"]');
          return !!item && !!item.querySelector('.sfp-rl-fallback');
        })()""")
        cdp.evaluate("""fixture.oneboxStatus=200;
          dragTo('.sfp-read-later', location.origin + '/about');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===3")
        time.sleep(.4)
        check('preview requests stop entirely after the downgrade', """(() => {
          // alice、erin、bob 两次（失败后重试）、dave、/c/dev/3；403 之后
          // /about 一次都不发。/t/299、/t/9010、/t/9011、/t/9012 都是话题，
          // 话题从不发预览请求。
          const about = document.querySelector('.sfp-rl-item[data-url="/about"]');
          return fixture.oneboxRequests.length===6 &&
            fixture.oneboxRequests.at(-1).endsWith('/c/dev/3') &&
            !!about && !!about.querySelector('.sfp-rl-fallback');
        })()""")
        cdp.evaluate("""localStorage.setItem('fixture_expect_count', String(document.querySelectorAll('.sfp-rl-item').length));
          localStorage.setItem('fixture_expect_url', document.querySelector('.sfp-rl-item').dataset.url);""")
        cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
        cdp.event('Page.loadEventFired')
        cdp.evaluate(source)
        wait_for("document.querySelectorAll('.sfp-rl-item').length===3")
        check('items survive a page reload and restore in order', """(() => {
          const items=[...document.querySelectorAll('.sfp-rl-item')];
          return String(items.length)===localStorage.getItem('fixture_expect_count') &&
            items[0].dataset.url===localStorage.getItem('fixture_expect_url');
        })()""")
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          localStorage.removeItem('sfp_read_later_height_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        cdp.evaluate("""window.dropTo=(uri) => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', uri);
            document.querySelector('.sfp-read-later').dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };
          dropTo(location.origin + '/t/296');
          dropTo(location.origin + '/t/295');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===2")
        # 295/296 都在主列表里，所以刷新后不该再发 topic_ids；只有主列表没有的才请求。
        cdp.evaluate("""fixture.missingTopicIds=[296];
          fixture.requests.length=0;
          document.querySelector('.sfp-refresh-btn').click();""")
        time.sleep(.5)
        check('a refresh reuses the main list and asks for nothing already loaded', """(() => {
          const asked=fixture.requests.filter(r=>r.path.includes('topic_ids'));
          return asked.length===0;
        })()""")
        cdp.evaluate("""fixture.missingTopicIds=[9001];
          fixture.goneTopicIds=[9001];
          fixture.requests.length=0;
          localStorage.setItem('sfp_read_later_v1', JSON.stringify({version:2,items:[
            {url:'/t/296',title:'kept',kind:'topic',topicId:296,addedAt:2},
            {url:'/t/9001',title:'elsewhere',kind:'topic',topicId:9001,addedAt:1}
          ]}));
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:'x'}));""")
        wait_for("fixture.requests.some(r=>r.path.includes('topic_ids=9001'))")
        check('only the topic missing from the main list is requested', """(() => {
          const asked=fixture.requests.filter(r=>r.path.includes('topic_ids'));
          return asked.length>0 && asked.every(r=>r.path.includes('9001')) &&
            !asked.some(r=>r.path.includes('296'));
        })()""")
        wait_for("!!document.querySelector('.sfp-rl-item .sfp-topic-unavailable')")
        check('a saved topic missing from the response is marked unavailable', """(() => {
          const missing=document.querySelector('.sfp-rl-item[data-url="/t/9001"]');
          const kept=document.querySelector('.sfp-rl-item[data-url="/t/296"]');
          // 列表接口拿不到时先按 id 取 TopicView；404 才是「真的没有」。
          return fixture.requests.some(r=>r.path==='/t/9001.json') &&
            !!missing?.querySelector('.sfp-topic-unavailable') &&
            !!kept && !kept.querySelector('.sfp-topic-unavailable');
        })()""")
        # 静音分类里的话题：/latest.json?topic_ids= 永远回空，但按 id 能取到。
        # 用户把它拖进来就是要看到它，不能显示成异常。
        cdp.evaluate("""fixture.missingTopicIds=[9002];
          fixture.goneTopicIds=[9001];
          fixture.requests.length=0;
          localStorage.setItem('sfp_read_later_v1', JSON.stringify({version:2,items:[
            {url:'/t/9002',title:'muted',kind:'topic',topicId:9002,addedAt:2}
          ]}));
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:'x'}));""")
        wait_for("!!document.querySelector('.sfp-rl-item[data-url=\"/t/9002\"] .sfp-topic-item')")
        check('a topic the list API hides is still fetched per id and rendered', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/t/9002"]');
          const topic=item?.querySelector('.sfp-topic-item');
          return fixture.requests.some(r=>r.path==='/t/9002.json') &&
            !!topic && topic.dataset.topicId==='9002' &&
            !item.querySelector('.sfp-topic-unavailable') &&
            !item.querySelector('.sfp-rl-card');
        })()""")
        check('the per-id topic snapshot fills in title, stats and poster', """(() => {
          const item=document.querySelector('.sfp-rl-item[data-url="/t/9002"]');
          return item.querySelector('.sfp-topic-title-line').textContent.includes('Topic 9002') &&
            !!item.querySelector('.sfp-topic-avatar') &&
            item.querySelector('.sfp-topic-stat').textContent.includes('3');
        })()""")
        # 刷新会触发两次同步请求；等它们都落地，否则同步写回会覆盖测试的删除。
        time.sleep(.6)
        cdp.evaluate("""fixture.missingTopicIds=[];
          fixture.goneTopicIds=[];
          localStorage.removeItem('sfp_read_later_v1');
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:null}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===0")
        check('a cross-tab storage event re-reads the list and hides the empty section', """document.querySelector('.sfp-read-later').hidden""")
        # 「一个条目高」取最底下那条：先拖入话题（高条目），再拖入链接（矮条目、落在上方），
        # 区域高度应当跟着底部那条走，而不是顶部那条。
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_height_v1');
          window.dragTo=(selector, uri) => {
            const dt = new DataTransfer();
            dt.setData('text/uri-list', uri);
            document.querySelector(selector).dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
          };
          dragTo('.sfp-read-later', location.origin + '/t/293');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        cdp.evaluate("""dragTo('.sfp-read-later', location.origin + '/u/gina');""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===2")
        check('one item height comes from the bottom-most entry', """(() => {
          const nodes=[...document.querySelectorAll('.sfp-rl-item')];
          const top=nodes[0].offsetHeight, bottom=nodes[nodes.length-1].offsetHeight;
          return nodes.length===2 && top!==bottom &&
            Math.abs(document.querySelector('.sfp-read-later').offsetHeight - bottom) <= 2;
        })()""")
        cdp.evaluate("""localStorage.setItem('sfp_read_later_v1', JSON.stringify({version:2,items:[
            {url:'/t/294',title:'From another tab',kind:'topic',topicId:294,addedAt:5}
          ]}));
          window.dispatchEvent(new StorageEvent('storage',{key:'sfp_read_later_v1',newValue:'x'}));""")
        wait_for("document.querySelectorAll('.sfp-rl-item').length===1")
        check('a cross-tab storage event renders the other tab entries', """(() => {
          const item=document.querySelector('.sfp-rl-item');
          return item.dataset.url==='/t/294' && !!item.querySelector('.sfp-topic-item');
        })()""")
        check('an unread saved topic shows the unread marker before it is opened', """!!document.querySelector('.sfp-rl-item .sfp-unread-dot:not(.sfp-unread-hidden)')""")
        cdp.evaluate("document.querySelector('.sfp-rl-item .sfp-topic-item').click()")
        wait_for("!!document.querySelector('.sfp-rl-item .sfp-topic-item.sfp-read')")
        check('opening a saved topic keeps it in the list and persists the read marker', """(() => {
          const stored = JSON.parse(localStorage.getItem('sfp_read_later_v1') || '{}').items;
          return document.querySelectorAll('.sfp-rl-item').length===1 &&
            stored.length===1 && stored[0].topic.unseen===false &&
            stored[0].topic.last_read_post_number===stored[0].topic.highest_post_number;
        })()""")
        cdp.evaluate("SFPFeedPanel.dispose()")
        wait_for("!document.querySelector('.sfp-feed-container')")
        check('dispose removes the read-later section and its listeners', """!document.querySelector('.sfp-read-later') &&
          !fixture.effects.listeners.some(e=>['dragstart','dragend','drop','storage'].includes(e.type))""")
        cdp.evaluate("""localStorage.removeItem('sfp_read_later_v1');
          localStorage.removeItem('sfp_read_later_height_v1');""")

        for label, descriptor in [
            ('readonly', "{value:undefined,writable:false}"),
            ('throwing setter', "{get:()=>undefined,set:()=>{throw new Error('bridge denied')}}"),
        ]:
            cdp.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/'})
            cdp.event('Page.loadEventFired')
            cdp.evaluate(f"Object.defineProperty(window,'SFPFeedPanel',{descriptor});void 0")
            cdp.evaluate(source)
            wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
            cdp.evaluate("fixture.requests.length=0;fixture.menus[0].callback()")
            wait_for("fixture.requests.some(r=>r.path==='/latest.json?order=activity&page=0') && document.querySelectorAll('.sfp-topic-item').length===30")
            check(f'{label} page API does not block feed startup or the cache menu', "fixture.menus.length===1 && document.querySelectorAll('.sfp-feed-container').length===1")
        errors = [e for e in cdp.events if e.get('method') == 'Runtime.exceptionThrown']
        assert not errors, json.dumps(errors)
        print(f'PASS: {len(results)} built-userscript browser checks')
finally:
    server.shutdown()
    server.server_close()
