import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { root } from './artifact.mjs';

export async function buildScrollFixture({ fullCss = false } = {}) {
  const result = await build({
    configFile: false, logLevel: 'warn',
    define: { __SFP_FULL_CSS__: String(fullCss) },
    build: {
      write: false, minify: false, cssMinify: false,
      lib: { entry: fileURLToPath(new URL('tests/browser/scroll-fixture.ts', root)), formats: ['iife'], name: 'ScrollFixture' },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
  if (outputs.length !== 1 || outputs[0].type !== 'chunk') throw new Error('Expected one inline fixture bundle');
  const code = outputs[0].code.replace(/<\/script/gi, '<\\/script');
  const destination = new URL(`perf/scroll-isolation/module${fullCss ? '-full' : ''}-fixture.html`, root);
  await mkdir(new URL('./', destination), { recursive: true });
  await writeFile(destination, `<!doctype html><meta charset="utf-8"><title>Feed scroll isolation check</title>
<style>body{margin:0;height:6000px;background:#eee;font:16px sans-serif}
aside{position:fixed;left:30px;top:30px;width:340px;height:320px;display:flex;flex-direction:column;border:2px solid #333;background:white}
.row{height:60px;border-bottom:1px solid #ccc;padding-left:15px;box-sizing:border-box}.row:nth-child(even){background:#bde5ff}</style>
<p style="margin-left:420px">Underlying page scroll must stay independent.</p>
<aside><div class="sfp-feed-scroll"><div id="items"></div></div></aside>
<script>${code}</script>`);
  return fileURLToPath(destination);
}
