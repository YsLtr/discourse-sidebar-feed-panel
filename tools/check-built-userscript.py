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
        check('full CSS preserves native scroll rules', """(() => {
          const s=getComputedStyle(document.querySelector('.sfp-feed-scroll'));
          return s.overscrollBehaviorY==='contain' && s.touchAction==='pan-y pinch-zoom';
        })()""")
        cdp.evaluate("""fixture.writes.length=0;
          document.querySelector('.sfp-resizer').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:300}));
          for(let x=310;x<=450;x+=10) document.dispatchEvent(new MouseEvent('mousemove',{clientX:x}));""")
        check('drag previews width without repeated storage writes', "!fixture.writes.some(w=>w.key.endsWith(':sfp_sidebar_width')) && document.querySelector('#d-sidebar').getBoundingClientRect().width>400")
        cdp.evaluate("document.dispatchEvent(new MouseEvent('mouseup'))")
        check('drag persists once on release and removes its listeners', "fixture.writes.filter(w=>w.key.endsWith(':sfp_sidebar_width')).length===1 && !fixture.effects.listeners.some(e=>['mousemove','mouseup'].includes(e.type)) && !document.body.style.cursor")
        cdp.evaluate("""window.firstItem=document.querySelector('.sfp-topic-item');
          window.dotBefore=firstItem.querySelector('.sfp-unread-dot');
          window.timeBefore=firstItem.querySelector('.sfp-topic-time').getBoundingClientRect().x;
          firstItem.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));""")
        check('read dot keeps its node and time-row position', """(() => {
          const dot=firstItem.querySelector('.sfp-unread-dot');
          return dot===dotBefore && getComputedStyle(dot).visibility==='hidden' &&
            Math.abs(firstItem.querySelector('.sfp-topic-time').getBoundingClientRect().x-timeBefore)<0.1;
        })()""")
        cdp.evaluate("document.querySelector('.sfp-refresh-btn').click()")
        wait_for("document.querySelector('.sfp-refresh-btn').getAttribute('aria-busy')!=='true'")
        check('refresh preserves locally read state', "getComputedStyle(document.querySelector('[data-topic-id=\"300\"] .sfp-unread-dot')).visibility==='hidden'")
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
            cdp.evaluate("document.querySelector('.sfp-resizer').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:500}));document.querySelector('#d-sidebar').remove();SFPFeedPanel.dispose();fixture.release()")
            wait_for("fixture.effects.timeouts.size===0 && fixture.effects.intervals.size===0 && fixture.effects.frames.size===0")
            check('dispose cleans absent host, drag listeners, history, styles and queued effects', """!document.querySelector('.sfp-feed-container,.sfp-toggle-btn,.sfp-help-tooltip') &&
              [...fixture.subscriptions.values()].every(s=>s.size===0) &&
              fixture.effects.listeners.length===0 && history.pushState===fixture.originalPush &&
              history.replaceState===fixture.originalReplace && !document.body.style.cursor &&
              !document.documentElement.style.getPropertyValue('--d-sidebar-width') &&
              ![...document.querySelectorAll('style')].some(s=>s.textContent.includes('.sfp-feed-scroll'))""")
            cdp.evaluate("document.body.append(Object.assign(document.createElement('aside'),{id:'d-sidebar',className:'sidebar-container'}));SFPFeedPanel.start();SFPFeedPanel.start()")
            wait_for("document.querySelectorAll('.sfp-topic-item').length===30")
            check('restart is idempotent and preserves a single menu and subscription set', "document.querySelectorAll('.sfp-feed-container').length===1 && fixture.menus.length===1 && [...fixture.subscriptions.values()].every(s=>s.size===1)")
            cdp.evaluate("document.querySelector('.sfp-auto-silent-input').click();document.querySelector('.sfp-feed-scroll').scrollTop=1000")
            wait_for("document.querySelector('.sfp-refresh-btn').dataset.action==='back-top'")
            cdp.evaluate("fixture.publish('/latest',{message_type:'latest',topic_id:1200,payload:fixture.topic(1200)});document.querySelector('.sfp-refresh-btn').click();SFPFeedPanel.dispose()")
            wait_for("fixture.effects.timeouts.size===0 && fixture.effects.intervals.size===0 && fixture.effects.frames.size===0")
            check('dispose interrupts smooth return and disables automatic refresh', "fixture.effects.listeners.length===0 && !document.querySelector('.sfp-feed-container')")
            cdp.evaluate("fixture.store.delete(`sfp_site:${encodeURIComponent(location.origin)}:sfp_tag_style_cache_v1`);SFPFeedPanel.start()")
            wait_for("!!document.querySelector('iframe[src=\"/tags\"]')")
            cdp.evaluate("SFPFeedPanel.dispose()")
            wait_for("!document.querySelector('iframe[src=\"/tags\"]') && fixture.effects.timeouts.size===0 && fixture.effects.frames.size===0")
            check('dispose removes a loading tag iframe and its polling timer', "fixture.effects.listeners.length===0 && fixture.effects.intervals.size===0")

            cdp.evaluate("""fixture.store.set(scoped('sfp_tag_style_cache_v1'),{version:1,entries:[['alpha',{cssText:'--color1: #123456',icon:'',hasIcon:false}]]});
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
