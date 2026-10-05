import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';

export const fileName = 'discourse-sidebar-feed-panel.user.js';
export const root = new URL('../', import.meta.url);
export const read = path => readFile(new URL(path, root), 'utf8');

export function metadata(source) {
  const header = source.match(/^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==/m)?.[0];
  assert(header, 'Missing userscript metadata');
  const result = {};
  for (const [, key, value] of header.matchAll(/^\/\/ @(\S+)\s+(.+)$/gm)) (result[key] ??= []).push(value.trim());
  for (const values of Object.values(result)) values.sort();
  return result;
}

export async function checkArtifact() {
  const [source, baselineText, pkgText] = await Promise.all([
    read(`dist/${fileName}`), read('tests/fixtures/2.2.3.metadata.json'), read('package.json'),
  ]);
  const baseline = JSON.parse(baselineText);
  const pkg = JSON.parse(pkgText);
  baseline.version = [pkg.version];
  const releaseURL = `https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/latest/download/${fileName}`;
  baseline.downloadURL = [releaseURL];
  baseline.updateURL = [releaseURL];
  for (const values of Object.values(baseline)) values.sort();
  assert.deepEqual(metadata(source), baseline, 'Published identity, permissions and match rules must be preserved');
  const legacy = await read(fileName);
  assert.deepEqual(metadata(legacy), { ...baseline, version: ['3.0.0'] }, 'Raw migration snapshot must retain its identity and Release update URLs');
  if (pkg.version === '3.0.0') {
    assert.equal(legacy.replace(/\r\n/g, '\n'), source.replace(/\r\n/g, '\n'), '3.0.0 Raw migration snapshot must match the release build');
  }
  assert.deepEqual((await readdir(new URL('dist/', root))).sort(), [fileName], 'Build must contain one self-contained userscript');
  assert(!/@vite\/client|localhost:\d+|127\.0\.0\.1:\d+|__monkeyWindow-/.test(source), 'Development bridge leaked into production');
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(ast.parseDiagnostics.length, 0, 'Invalid JavaScript');
  function checkNode(node) {
    assert(!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node), 'ESM dependency in userscript');
    assert(!(ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword), 'Runtime chunk loader in userscript');
    ts.forEachChild(node, checkNode);
  }
  checkNode(ast);
  for (const name of ['README.md', 'README.en.md']) {
    const doc = await read(name);
    assert(doc.includes(`\`${pkg.version}\``), `${name} version is stale`);
    assert(doc.includes(`](${releaseURL})`), `${name} must link to the latest Release asset`);
  }
  return source;
}
