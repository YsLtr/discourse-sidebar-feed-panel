// Regenerate only when intentionally replacing the migration reference.
// Tests consume the fixture, so shallow clones do not need historical Git objects.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { cssSignature } from '../tests/css-signature.mjs';

const revision = '47794f3';
const source = execFileSync('git', ['show', `${revision}:discourse-sidebar-feed-panel.user.js`], { encoding: 'utf8' });
const ast = ts.createSourceFile('baseline.js', source, ts.ScriptTarget.Latest, true);
const declarations = new Map(), functions = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
    declarations.set(node.name.text, node.initializer.getText(ast));
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const names = [
  '_topicBaseUrl', '_isPinnedTopic', '_hasLastReadPostNumber', '_topicListUrl', '_isTopicRead', '_hasUnreadMarker', '_applyReadMarker',
  '_residentTopicLimit', '_resetLoadedFeedDepth', '_trimResidentTopicsAfterRefresh', '_rebuildUsersMapForResidentTopics',
  '_mergeAndRenderTopics', '_markTopicUnavailable', '_expireUnavailableTopicsByPush', '_feedSortKeyValue', '_interleaveUnavailableTopicsBySortKey', '_detectVanishedHeadTopics',
  '_resetAutoLoadState', '_ensureAutoLoadSession', '_canRunAutoLoad', '_recordAutoLoadRequest', '_recordAutoLoadFilterResult',
  '_touchSidebarIncomingTopicId', '_getSidebarIncomingLoadTopicIds', '_incomingLoadTopicLimit', '_recomputeSidebarIncomingFilteredTopicIds', '_removeSidebarIncomingTopicIds',
  '_categoryPath', '_needsPeriodForUrl', '_usesPeriodScopedTopList',
  'getUiLocale', 't', 'formatRelativeTime',
];
const constantNames = [...declarations.keys()].filter(name => /^[A-Z][A-Z_0-9]+$/.test(name) && !['I18N', 'ORDER_OPTION_DEFS', 'PERIOD_OPTION_DEFS', 'FILTER_OPTION_DEFS', 'SAFE_COLOR_RE', 'SAFE_ICON_RE'].includes(name));
const constants = vm.runInNewContext(`${constantNames.map(name => `const ${name} = ${declarations.get(name)};`).join('\n')}\nJSON.stringify({${constantNames.join(',')}})`);
let css;
const cssAst = ts.createSourceFile('css.js', functions.get('injectStyles'), ts.ScriptTarget.Latest, true);
function findCss(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) css = node.text;
  ts.forEachChild(node, findCss);
}
findCss(cssAst);
const hash = value => createHash('sha256').update(value).digest('hex');
const fixture = {
  revision, sourceSha256: hash(source), cssSha256: cssSignature(css),
  constants: JSON.parse(constants),
  i18n: vm.runInNewContext(`(${declarations.get('I18N')})`),
  feedQuery: declarations.get('FeedQuery'),
  functions: Object.fromEntries(names.map(name => {
    if (!functions.has(name)) throw new Error(`Missing baseline function: ${name}`);
    return [name, functions.get(name)];
  })),
};
writeFileSync(new URL('../tests/fixtures/2.2.3.behavior.json', import.meta.url), JSON.stringify(fixture, null, 2) + '\n');
console.log(`Captured ${names.length} unchanged functions, CSS digest, translations and constants from ${revision}.`);
