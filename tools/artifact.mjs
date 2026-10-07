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
  const [source, legacy, pkgText] = await Promise.all([
    read(`dist/${fileName}`), read(fileName), read('package.json'),
  ]);
  const pkg = JSON.parse(pkgText);
  const releaseURL = `https://github.com/YsLtr/discourse-sidebar-feed-panel/releases/latest/download/${fileName}`;
  const meta = metadata(source);
  // Published metadata is not frozen against older releases: branding such as namespace or icon may change.
  for (const key of ['name', 'namespace', 'version', 'description', 'author', 'match', 'icon', 'grant', 'run-at', 'license']) {
    assert(meta[key]?.[0], `Built userscript is missing @${key}`);
  }
  assert.deepEqual(meta.version, [pkg.version], 'Built userscript version must match package.json');
  for (const field of ['downloadURL', 'updateURL']) {
    assert.deepEqual(meta[field], [releaseURL], `@${field} must point to the latest Release asset`);
  }
  const legacyMeta = metadata(legacy);
  assert.deepEqual(legacyMeta.version, ['3.0.0'], 'Raw migration snapshot must stay at version 3.0.0');
  for (const field of ['downloadURL', 'updateURL']) {
    assert.deepEqual(legacyMeta[field], [releaseURL], `Raw migration snapshot @${field} must point to the latest Release asset`);
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
    // The READMEs intentionally carry no version claim; only the Release link is checked.
    assert(doc.includes(`](${releaseURL})`), `${name} must link to the latest Release asset`);
  }
  return source;
}
