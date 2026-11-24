import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export function apiInventory(
  root: string,
  models: ReadonlyMap<string, string>,
) {
  const records: object[] = [];
  const delegates = new Map(
    [...models].map(([table, model]) => [
      model.charAt(0).toLowerCase() + model.slice(1),
      table,
    ]),
  );
  function visit(folder: string) {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort(
      (a, b) => (a.name < b.name ? -1 : 1),
    )) {
      const file = join(folder, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (
        !entry.name.endsWith('.ts') ||
        /\.(spec|test|d)\.ts$/.test(entry.name)
      )
        continue;
      const code = readFileSync(file, 'utf8');
      const projection = entry.name.endsWith('.public.ts');
      if (!projection && !code.includes('@Controller(')) continue;
      const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
      const module = relative(root, file).split(sep)[0];
      const source = file.split(sep).join('/');
      if (projection) {
        const tables = new Set<string>();
        function collect(node: ts.Node) {
          if (ts.isPropertyAccessExpression(node)) {
            const table = delegates.get(node.name.text);
            if (table) tables.add(table);
          }
          ts.forEachChild(node, collect);
        }
        collect(ast);
        records.push({
          kind: 'producer-file',
          id: source,
          module,
          tableNameReferences: [...tables].sort(),
          access: 'internal-only',
        });
      }
      for (const statement of ast.statements) {
        if (!ts.isClassDeclaration(statement)) continue;
        const decorators = (node: ts.ClassDeclaration | ts.MethodDeclaration) =>
          (ts.getDecorators(node) ?? [])
            .map((d) => d.expression)
            .filter(ts.isCallExpression);
        const controller = decorators(statement).find(
          (d) => d.expression.getText(ast) === 'Controller',
        );
        if (!controller) continue;
        function routePart(call: ts.CallExpression) {
          if (!call.arguments.length) return '';
          return ts.isStringLiteralLike(call.arguments[0])
            ? call.arguments[0].text
            : null;
        }
        for (const member of statement.members) {
          if (!ts.isMethodDeclaration(member)) continue;
          const calls = new Set<string>();
          function collectCalls(node: ts.Node) {
            if (
              ts.isCallExpression(node) &&
              ts.isPropertyAccessExpression(node.expression)
            ) {
              const receiver = node.expression.expression;
              if (
                ts.isPropertyAccessExpression(receiver) &&
                receiver.expression.kind === ts.SyntaxKind.ThisKeyword
              )
                calls.add(receiver.name.text + '.' + node.expression.name.text);
            }
            ts.forEachChild(node, collectCalls);
          }
          if (member.body) collectCalls(member.body);
          for (const call of decorators(member)) {
            const method = call.expression.getText(ast).toUpperCase();
            if (
              ![
                'GET',
                'POST',
                'PUT',
                'PATCH',
                'DELETE',
                'HEAD',
                'OPTIONS',
                'ALL',
                'SSE',
              ].includes(method)
            )
              continue;
            const parts = [routePart(controller), routePart(call)];
            const route = parts.includes(null)
              ? null
              : '/' + parts.filter(Boolean).join('/');
            records.push({
              kind: 'api-route',
              id: source + '#' + member.name.getText(ast),
              method,
              route,
              directCalls: [...calls].sort(),
              module,
              access: 'inventory-only',
            });
          }
        }
      }
    }
  }
  visit(root);
  return records;
}
