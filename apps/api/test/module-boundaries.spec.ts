import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
        ? [path]
        : [];
  });
}
function privateImports(file: string, text: string, root: string): string[] {
  const owner = relative(root, file).split(sep)[0];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false);
  const imports: string[] = [];
  function visit(node: ts.Node) {
    let moduleSpecifier: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      moduleSpecifier = node.moduleSpecifier;
    } else if (ts.isExternalModuleReference(node)) {
      moduleSpecifier = node.expression;
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      moduleSpecifier = node.argument.literal;
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      moduleSpecifier = node.arguments[0];
    }
    if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
      const specifier = moduleSpecifier.text;
      if (specifier.startsWith('.')) {
        const target = relative(root, resolve(dirname(file), specifier));
        if (
          /repository(?:$|[./\\-])/.test(target) &&
          target.split(sep)[0] !== owner
        ) {
          imports.push(specifier);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}
// Dedicated composition roots assemble owner-provided classes without importing
// whole runtime modules (which would start unrelated background processors).
const compositionImports: Record<string, string[]> = {
  'assistant-read/assistant-read.module.ts': [
    '../master-data/master-data.repository',
    '../sales/sales.repository',
  ],
  'documents/document-scan-worker.ts': [
    '../notifications/notifications.repository',
  ],
};
describe('recursive module repository boundaries', () => {
  it('checks every production subdirectory against explicit composition exceptions', () => {
    const root = resolve(process.cwd(), 'src');
    const violations = sourceFiles(root).flatMap((file) => {
      const path = relative(root, file).replaceAll('\\', '/');
      const source = readFileSync(file, 'utf8');
      return privateImports(file, source, root)
        .filter((specifier) => !compositionImports[path]?.includes(specifier))
        .map((specifier) => `${path}: ${specifier}`);
    });
    expect(violations).toEqual([]);
  }, 30000);
  it('detects an import hidden in a new nested directory, including type imports', () => {
    const root = resolve('synthetic/src');
    expect(
      privateImports(
        resolve(root, 'hr/nested/use-case.ts'),
        "import type { Private } from '../../finance/private.repository';",
        root,
      ),
    ).toEqual(['../../finance/private.repository']);
    expect(
      privateImports(
        resolve(root, 'hr/nested/use-case.ts'),
        "import { Own } from '../hr.repository';",
        root,
      ),
    ).toEqual([]);
  });
  it.each([
    "export { Private } from '../../finance/private.repository';",
    "const load = () => import('../../finance/private.repository');",
    "type Private = import('../../finance/private.repository').Private;",
    "import privateModule = require('../../finance/private.repository');",
    "const privateModule = require('../../finance/private.repository');",
    String.raw`import { Private } from '../../finance/private.repositor\u0079';`,
  ])('detects cross-module references in %s', (source) => {
    const root = resolve('synthetic/src');
    expect(
      privateImports(resolve(root, 'hr/nested/use-case.ts'), source, root),
    ).toEqual(['../../finance/private.repository']);
  });

  it('allows public services and paths that normalize to the importing module', () => {
    const root = resolve('synthetic/src');
    expect(
      privateImports(
        resolve(root, 'hr/nested/use-case.ts'),
        "export { Public } from '../../finance/finance.service'; import('.././hr.repository');",
        root,
      ),
    ).toEqual([]);
  });
});
