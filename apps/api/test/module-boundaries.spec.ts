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
  return source.statements.flatMap((node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      return [];
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith('.') || !/repository(?:$|[./-])/.test(specifier))
      return [];
    const target = resolve(dirname(file), specifier);
    return relative(root, target).split(sep)[0] !== owner ? [specifier] : [];
  });
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
      if (!source.includes('repository')) return [];
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
});
