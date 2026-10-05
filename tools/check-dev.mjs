import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { metadata } from './artifact.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'warn' });
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const url = new URL('/__vite-plugin-monkey.install.user.js', origin);
  url.searchParams.set('origin', new URL(origin).origin);
  const install = await fetch(url);
  assert.equal(install.status, 200);
  const header = metadata(await install.text());
  assert.deepEqual(header.name, ['dev:Discourse Sidebar Feed Panel']);
  assert.equal(header.downloadURL, undefined, 'Dev install points at production download');
  assert.equal(header.updateURL, undefined, 'Dev install points at production updates');
  const entry = await fetch(new URL('/src/main.ts', origin));
  assert.equal(entry.status, 200);
  assert((await entry.text()).includes('startFeedPanel'), 'TypeScript entry was not transformed');
  const gm = await fetch(new URL('/src/platform/gm.ts', origin));
  assert.equal(gm.status, 200);
  assert((await gm.text()).includes('vite-plugin-monkey'), 'GM client alias was not resolved');
  console.log('PASS: dev metadata, TypeScript entry and GM bridge');
} finally {
  await server.close();
}
