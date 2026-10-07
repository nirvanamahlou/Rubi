/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node inventory is also loaded by the coverage test. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const persian = /[\u0600-\u06ff]/;
const root = path.resolve(__dirname, '../../..');
const excluded =
  /(?:^|[/\\])(?:node_modules|\.next|dist|vendor|i18n|demo|fixtures?|mocks?)(?:[/\\]|$)|\.(?:spec|test|render)\.|(?:fixture|mock|demo)[-.]/i;

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function textCandidates(value) {
  if (!persian.test(value)) return [];
  if (/<[a-z!][^>]*>/i.test(value)) {
    const texts = [...value.matchAll(/(?:^|>)([^<>]+)(?=<|$)/g)].map(
      (m) => m[1],
    );
    for (const match of value.matchAll(
      /(?:title|placeholder|aria-label|alt)=["']([^"']+)["']/g,
    ))
      texts.push(match[1]);
    return texts
      .filter((text) => !/[{}]|=>/.test(text))
      .flatMap(textCandidates);
  }
  // Never send code, credentials or source paths to a translation provider.
  if (
    /=>|\b(?:const|function|SELECT|INSERT|UPDATE|DELETE)\b|[{}]|\\[A-Za-z]:|https?:\/\//.test(
      value,
    )
  )
    return [];
  const text = normalizeText(value);
  return text && persian.test(text) ? [text] : [];
}

function inventory() {
  const found = new Map();
  const add = (value, file) => {
    for (const text of textCandidates(value)) {
      if (!found.has(text)) found.set(text, new Set());
      found.get(text).add(path.relative(root, file).replaceAll('\\', '/'));
    }
  };
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (excluded.test(file)) continue;
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:ts|tsx|js)$/.test(file)) {
        const source = ts.createSourceFile(
          file,
          fs.readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        function visit(node) {
          if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isJsxText(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node)
          ) {
            let visible = true;
            if (file.includes(`${path.sep}api${path.sep}src${path.sep}`)) {
              visible = /(?:[.-]xlsx|finance-export)\.ts$/.test(file);
              for (
                let ancestor = node.parent;
                ancestor && !ts.isSourceFile(ancestor);
                ancestor = ancestor.parent
              ) {
                if (
                  ts.isCallExpression(ancestor) &&
                  /Xlsx/i.test(ancestor.expression.getText(source))
                )
                  visible = true;
                if (
                  ts.isNewExpression(ancestor) &&
                  /(?:Exception|Error)$/.test(
                    ancestor.expression.getText(source),
                  )
                )
                  visible = true;
                if (
                  ts.isPropertyAssignment(ancestor) &&
                  /^(?:message|label|title|description|placeholder)$/.test(
                    ancestor.name.getText(source).replace(/["']/g, ''),
                  )
                )
                  visible = true;
              }
            }
            if (visible) add(node.text, file);
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      } else if (/\.html$/.test(file)) add(fs.readFileSync(file, 'utf8'), file);
    }
  }
  for (const relative of [
    'apps/web/src',
    'apps/web/public',
    'apps/api/src',
    'packages/contracts/src',
  ]) {
    const directory = path.resolve(root, relative);
    if (fs.existsSync(directory)) walk(directory);
  }
  return [...found]
    .map(([text, files]) => ({ text, files: [...files] }))
    .sort((a, b) => a.text.localeCompare(b.text, 'fa'));
}

module.exports = { inventory, normalizeText, textCandidates };
if (require.main === module) {
  const data = inventory();
  if (process.argv[2])
    fs.writeFileSync(process.argv[2], JSON.stringify(data, null, 2));
  console.log(JSON.stringify({ uniqueTexts: data.length }));
}
