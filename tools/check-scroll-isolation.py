"""Chrome regression check for the real Feed scroll setup and CSS.

Requires Python websocket-client and installed Chrome.
For modular source run npm run check:scroll; --source supports legacy baselines.
The fixture stubs loading/state updates; it exercises native wheel/touch scrolling
and records input-to-frame latency while the renderer main thread is deliberately busy.
Usage: python tools/check-scroll-isolation.py --label before
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess
import tempfile
import time
import urllib.request

from chrome_session import CDP, default_chrome

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--label', default='current')
inputs = parser.add_mutually_exclusive_group()
inputs.add_argument('--source', type=Path, help='Legacy single-file baseline (2.2.3 or earlier)')
inputs.add_argument('--fixture', type=Path, help='Built fixture importing the real scroll module')
parser.add_argument('--chrome', default=default_chrome())
args = parser.parse_args()
artifact = ROOT / 'perf' / 'scroll-isolation'
artifact.mkdir(parents=True, exist_ok=True)

if args.source:
    source = args.source.read_text(encoding='utf-8')
    def function(name):
        match = re.search(r'^  function ' + re.escape(name) + r'\(', source, re.M)
        if not match:
            return ''
        following = re.search(r'^  (?:async )?function ', source[match.end():], re.M)
        assert following, name
        return source[match.start():match.end() + following.start()]

    css = re.search(r'\.sfp-feed-scroll \{[^}]+\}', source).group(0)
    fixture = artifact / 'fixture.html'
    fixture.write_text('''<!doctype html><meta charset="utf-8"><title>Feed scroll isolation check</title>
    <style>body{margin:0;height:6000px;background:#eee;font:16px sans-serif}
    aside{position:fixed;left:30px;top:30px;width:340px;height:320px;display:flex;flex-direction:column;border:2px solid #333;background:white}
    .row{height:60px;border-bottom:1px solid #ccc;padding-left:15px;box-sizing:border-box}
    .row:nth-child(even){background:#bde5ff}''' + css + '''</style>
    <p style="margin-left:420px">Underlying page scroll must stay independent.</p>
    <aside><div class="sfp-feed-scroll"><div id="items"></div></div></aside>
    <script>
    let feedScrollEl=document.querySelector('.sfp-feed-scroll');
    let feedScrollAbortController=null,hasMorePages=true,isLoadingMore=false;
    window.loadCalls=0; window.stateCalls=0;
    function loadMoreTopics(){window.loadCalls++}
    function _scheduleHeadActionStateSync(){window.stateCalls++}
    ''' + function('debounce') + function('isAtScrollBoundary') + function('_setupScrollLoadMore') + '''
    window.resetFeed=(short=false)=>{
     document.querySelector('#items').innerHTML=Array.from({length:short?1:80},(_,i)=>`<div class="row">Topic ${i+1}</div>`).join('');
     feedScrollEl.scrollTop=0;
    };
    resetFeed();_setupScrollLoadMore();
    </script>''', encoding='utf-8')
else:
    fixture = (args.fixture or artifact / 'module-fixture.html').resolve()
    if not fixture.is_file():
        parser.error('Run npm run check:scroll to build the module fixture, or specify --source for a legacy baseline.')


profile=Path(tempfile.mkdtemp(prefix='sfp-scroll-check-'))
proc=None
cdp=None
results={}
errors=[]
def check(label, ok, actual):
    results[label]={'pass':bool(ok),'actual':actual}
    if not ok:
        errors.append(label)

try:
    proc=subprocess.Popen([args.chrome,'--headless=new','--no-first-run','--no-default-browser-check',
        '--disable-extensions','--remote-debugging-port=0',f'--user-data-dir={profile}',
        '--window-size=1000,800','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    port_file=profile/'DevToolsActivePort'
    deadline=time.monotonic()+15
    while not port_file.exists():
        if time.monotonic()>deadline:
            raise RuntimeError('Chrome did not start')
        time.sleep(.05)
    port=int(port_file.read_text().splitlines()[0])
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    targets=json.load(opener.open(f'http://127.0.0.1:{port}/json'))
    cdp=CDP(next(t['webSocketDebuggerUrl'] for t in targets if t['type']=='page'))
    cdp.call('Page.enable')
    cdp.call('Runtime.enable')
    cdp.call('Page.navigate',{'url':fixture.as_uri()})
    cdp.event('Page.loadEventFired')
    cdp.evaluate('window.scrollTo(0,500)')
    # Let Chrome commit hit-test / scroll regions before sending real input.
    cdp.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    def wheel(delta):
        cdp.call('Input.dispatchMouseEvent',{'type':'mouseMoved','x':180,'y':180})
        cdp.call('Input.dispatchMouseEvent',{'type':'mouseWheel','x':180,'y':180,'deltaX':0,'deltaY':delta})
    def position():
        return cdp.evaluate('({page:scrollY,feed:feedScrollEl.scrollTop,max:feedScrollEl.scrollHeight-feedScrollEl.clientHeight})')

    for where,delta in [('top',-240),('bottom',240),('short',240)]:
        cdp.evaluate(f"resetFeed({str(where=='short').lower()});window.scrollTo(0,500);feedScrollEl.scrollTop={'feedScrollEl.scrollHeight' if where=='bottom' else '0'}")
        time.sleep(.15)
        wheel(delta)
        time.sleep(.45)
        p=position()
        check('wheel_boundary_'+where,abs(p['page']-500)<1 and (p['feed']==0 if where!='bottom' else abs(p['feed']-p['max'])<1),p)

    cdp.evaluate('resetFeed();feedScrollEl.scrollTop=600;window.scrollTo(0,500)')
    time.sleep(.15)
    wheel(180)
    time.sleep(.4)
    p=position()
    check('wheel_scrolls_feed',p['feed']>650 and p['page']==500,p)

    cdp.call('Emulation.setTouchEmulationEnabled',{'enabled':True})
    for where,dy in [('middle',-130),('top',130),('bottom',-130),('short',-130)]:
        initial='600' if where=='middle' else 'feedScrollEl.scrollHeight' if where=='bottom' else '0'
        cdp.evaluate(f"resetFeed({str(where=='short').lower()});window.scrollTo(0,500);feedScrollEl.scrollTop={initial}")
        time.sleep(.15)
        cdp.call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':180,'y':190,'id':0}]})
        for step in range(1,7):
            cdp.call('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':180,'y':190+dy*step/6,'id':0}]})
            time.sleep(.025)
        cdp.call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        time.sleep(.6)
        p=position()
        okay=p['page']==500 and (p['feed']>650 if where=='middle' else abs(p['feed']-p['max'])<1 if where=='bottom' else p['feed']==0)
        check('touch_'+where,okay,p)
    cdp.call('Emulation.setTouchEmulationEnabled',{'enabled':False})

    # Setup twice must remove the previous listener set. Keep the real debounce.
    cdp.evaluate('resetFeed();_setupScrollLoadMore();_setupScrollLoadMore();window.loadCalls=0;window.stateCalls=0;feedScrollEl.scrollTop=feedScrollEl.scrollHeight')
    time.sleep(.45)
    counts=cdp.evaluate('({loads:loadCalls,states:stateCalls})')
    check('load_more_once_after_rebind',counts['loads']==1,counts)
    check('reading_state_callback_survives',counts['states']>0,counts)

    cdp.evaluate('resetFeed();feedScrollEl.scrollTop=600;window.scrollTo(0,500)')
    time.sleep(.3)
    cdp.call('Input.dispatchMouseEvent',{'type':'mouseMoved','x':180,'y':180})
    cdp.call('Tracing.start',{'categories':'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,benchmark,latencyInfo,input.scrolling','transferMode':'ReturnAsStream'})
    # Start a continuous browser-generated gesture before the block. Its later
    # wheel events arrive during it without CDP coordinate-mapping delays.
    cdp.evaluate("setTimeout(()=>{performance.mark('sfp-check-busy-start');const end=performance.now()+1400;while(performance.now()<end){}performance.mark('sfp-check-busy-end')},200)")
    cdp.call('Input.synthesizeScrollGesture',{'x':180,'y':180,'yDistance':-1400,'speed':800,
        'gestureSourceType':'mouse','preventFling':True})
    time.sleep(1.6)
    cdp.call('Tracing.end')
    handle=cdp.event('Tracing.tracingComplete')['stream']
    chunks=[]
    while True:
        part=cdp.call('IO.read',{'handle':handle})
        chunks.append(part.get('data',''))
        if part.get('eof'):
            break
    cdp.call('IO.close',{'handle':handle})
    trace=json.loads(''.join(chunks))
    (artifact/f'{args.label}.trace.json').write_text(json.dumps(trace),encoding='utf-8')
    es=trace['traceEvents']
    wheels=[e for e in es if e.get('name')=='InputLatency::MouseWheel' and e.get('ph')=='b']
    main_ack=sum(any(c['component_type']=='COMPONENT_INPUT_EVENT_LATENCY_RENDERER_MAIN'
        for c in e.get('args',{}).get('chrome_latency_info',{}).get('component_info',[])) for e in wheels)
    # The first wheel in a gesture is the regression seam. Later wheel events may
    # already be non-blocking even with the old handler, so smooth continuation
    # alone does not prove that starting a scroll no longer waits for main.
    check('wheel_starts_without_main_thread_ack',bool(wheels) and main_ack==0,{'wheel_events':len(wheels),'main_ack_events':main_ack})
    begin=next(e['ts'] for e in es if e.get('name')=='sfp-check-busy-start')
    finish=next(e['ts'] for e in es if e.get('name')=='sfp-check-busy-end')
    scrolls=[]
    for e in es:
        if e.get('name')!='InputLatency::GestureScrollUpdate' or e.get('ph')!='b' or not begin<=e['ts']<finish-100000:
            continue
        components={c['component_type']:c['time_us'] for c in e.get('args',{}).get('chrome_latency_info',{}).get('component_info',[])}
        swap=components.get('COMPONENT_INPUT_EVENT_LATENCY_FRAME_SWAP')
        if swap:
            scrolls.append({'latency_ms':(swap-e['ts'])/1000,'before_busy_end':swap<finish})
    p=position()
    check('scroll_during_main_thread_block',bool(scrolls) and all(s['before_busy_end'] and s['latency_ms']<300 for s in scrolls) and p['feed']>650,{'samples':scrolls,'position':p,'busy_ms':(finish-begin)/1000})
    results['browser']=cdp.call('Browser.getVersion')['product']
finally:
    if cdp:
        try:
            cdp.send('Browser.close')
            cdp.ws.close()
        except Exception:
            pass
    if proc:
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.terminate()
            proc.wait(timeout=5)
    # Only remove the exact temporary profile created above, under the system temp root.
    resolved=profile.resolve()
    if resolved.parent==Path(tempfile.gettempdir()).resolve() and resolved.name.startswith('sfp-scroll-check-'):
        shutil.rmtree(resolved,ignore_errors=True)

(artifact/f'{args.label}.results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
for label,result in results.items():
    if isinstance(result,dict):
        actual=dict(result['actual'])
        samples=actual.pop('samples',None)
        if samples is not None:
            latencies=[s['latency_ms'] for s in samples]
            actual['latency_ms']={'samples':len(samples),'median':statistics.median(latencies) if latencies else None,'max':max(latencies,default=None)}
        print(('PASS' if result['pass'] else 'FAIL'),label,json.dumps(actual))
    else:
        print(label,result)
if errors:
    raise SystemExit('FAIL: '+', '.join(errors))
print('PASS: native scrolling remains independent of a busy renderer; boundaries and load callbacks preserved')
