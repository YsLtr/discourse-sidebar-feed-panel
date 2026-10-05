import { createHash } from 'node:crypto';
import postcss from 'postcss';

// Preserve rule order, selectors, at-rules, values and !important; discard only
// comments/formatting. Whitespace around function arguments is formatter-owned.
export function cssSignature(css) {
  const compact = text => text.replace(/\s+/g, ' ').trim();
  const visit = node => {
    const children = node.nodes?.filter(child => child.type !== 'comment').map(visit);
    if (node.type === 'decl') return [node.type, node.prop, compact(node.value).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'), !!node.important];
    if (node.type === 'rule') return [node.type, compact(node.selector), children];
    if (node.type === 'atrule') return [node.type, node.name, compact(node.params), children];
    return [node.type, children];
  };
  return createHash('sha256').update(JSON.stringify(visit(postcss.parse(css)))).digest('hex');
}
