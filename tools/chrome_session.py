"""Small CDP harness shared by scroll regression and built-userscript smoke checks."""
import os
import shutil
import websocket
import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

def default_chrome():
    return os.environ.get('CHROME_BIN') or shutil.which('google-chrome') or shutil.which('chromium') or 'C:/Program Files/Google/Chrome/Application/chrome.exe'

class CDP:
    def __init__(self, url):
        self.ws=websocket.create_connection(url, timeout=12, suppress_origin=True)
        self.seq=0
        self.pending={}
        self.events=[]
    def send(self, method, params=None):
        self.seq+=1
        self.ws.send(json.dumps({'id':self.seq,'method':method,'params':params or {}}))
        return self.seq
    def read(self):
        item=json.loads(self.ws.recv())
        if 'id' in item:
            self.pending[item['id']]=item
        else:
            self.events.append(item)
        return item
    def result(self, ident):
        while ident not in self.pending:
            self.read()
        reply=self.pending.pop(ident)
        if 'error' in reply:
            raise RuntimeError(reply['error'])
        return reply.get('result',{})
    def call(self, method, params=None):
        return self.result(self.send(method,params))
    def evaluate(self, expression):
        reply=self.call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
        if 'exceptionDetails' in reply:
            raise RuntimeError(reply['exceptionDetails'])
        return reply.get('result',{}).get('value')
    def event(self, method):
        while True:
            for i,e in enumerate(self.events):
                if e.get('method')==method:
                    return self.events.pop(i)['params']
            self.read()


class ChromeSession:
    """A disposable headless profile. Does not touch the user's browser profile."""
    def __init__(self, chrome=None):
        self.chrome = chrome or default_chrome()
        self.profile = None
        self.proc = None
        self.cdp = None

    def __enter__(self):
        self.profile = Path(tempfile.mkdtemp(prefix='sfp-browser-check-'))
        try:
            self.proc = subprocess.Popen([
                self.chrome, '--headless=new', '--no-first-run', '--no-default-browser-check',
                '--disable-extensions', '--remote-debugging-port=0',
                f'--user-data-dir={self.profile}', '--window-size=1100,850', 'about:blank',
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            port_file = self.profile / 'DevToolsActivePort'
            deadline = time.monotonic() + 15
            while not port_file.exists():
                if time.monotonic() > deadline:
                    raise RuntimeError('Chrome did not start')
                time.sleep(.05)
            port = int(port_file.read_text().splitlines()[0])
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            targets = json.load(opener.open(f'http://127.0.0.1:{port}/json'))
            self.cdp = CDP(next(t['webSocketDebuggerUrl'] for t in targets if t['type'] == 'page'))
            self.cdp.call('Page.enable')
            self.cdp.call('Runtime.enable')
            return self.cdp
        except Exception:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *_):
        if self.cdp:
            try:
                self.cdp.send('Browser.close')
                self.cdp.ws.close()
            except Exception:
                pass
        if self.proc:
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.terminate()
                self.proc.wait(timeout=5)
        if self.profile:
            resolved = self.profile.resolve()
            if resolved.parent == Path(tempfile.gettempdir()).resolve() and resolved.name.startswith('sfp-browser-check-'):
                shutil.rmtree(resolved, ignore_errors=True)
