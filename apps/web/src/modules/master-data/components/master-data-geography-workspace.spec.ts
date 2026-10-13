import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-geography-workspace.tsx',
  ),
  'utf8',
);

function resourceArray(functionName: string, resource: string) {
  const file = ts.createSourceFile(
    'master-data-geography-workspace.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let result: ts.ArrayLiteralExpression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === functionName &&
      node.body
    ) {
      for (const statement of node.body.statements) {
        if (
          ts.isIfStatement(statement) &&
          statement.expression.getText(file).includes(`'${resource}'`)
        ) {
          const returnStatement = ts.isReturnStatement(statement.thenStatement)
            ? statement.thenStatement
            : ts.isBlock(statement.thenStatement)
              ? statement.thenStatement.statements.find(ts.isReturnStatement)
              : undefined;
          if (
            returnStatement?.expression &&
            ts.isArrayLiteralExpression(returnStatement.expression)
          )
            result = returnStatement.expression;
        }
      }
    }
    if (!result) ts.forEachChild(node, visit);
  }
  visit(file);
  if (!result) throw new Error(`Missing ${functionName} array for ${resource}`);
  return { file, array: result };
}

describe('Master Data geography workspace terminal filters', () => {
  it('keeps country and region tables aligned without last-change cells', () => {
    const cellsStart = source.indexOf('function recordCells');
    for (const [resource, next, expectedHeaderCount] of [
      ['countries', 'regions', 8],
      ['regions', 'cities', 10],
    ] as const) {
      const headerArray = resourceArray('geographyColumns', resource);
      const headers = headerArray.array.elements.map((element) =>
        element.getText(headerArray.file).slice(1, -1),
      );
      const cellArray = resourceArray('recordCells', resource);
      const cells = source.slice(
        source.indexOf(`if (resource === '${resource}')`, cellsStart),
        source.indexOf(`if (resource === '${next}')`, cellsStart),
      );
      expect(headers).toHaveLength(expectedHeaderCount);
      expect(cellArray.array.elements).toHaveLength(expectedHeaderCount - 1); // shared actions cell
      expect(headers).not.toContain('آخرین تغییر');
      expect(cells).not.toContain('record.updatedAt');
    }
    expect(source).toContain(
      '<SelectItem value="updatedAt">آخرین تغییر</SelectItem>',
    );
  });

  it('uses independent rail terminals for the visible tab and keeps aviation nested', () => {
    expect(source).toContain("resource: 'rail-terminals'");
    expect(source).toContain('openCreate(resource)');
    expect(source).toContain('loadAirportTerminals(formParent.id)');
    expect(source).toContain("openRelatedCreate('terminals', airport)");
    expect(source).toContain("formDefinition.key === 'terminals'");
  });

  it('removes airport list filtering without leaving hidden query state', () => {
    expect(source).not.toContain('const [airportId, setAirportId] = useState');
    expect(source).not.toContain("airportId !== 'all'");
    expect(source).not.toContain('setAirportId(');
    expect(source).not.toContain('aria-label="فیلتر فرودگاه"');
    expect(source).not.toContain('همه فرودگاه‌ها');
  });

  it('preserves terminal type filtering and airport-backed creation paths', () => {
    expect(source).toContain('aria-label="فیلتر نوع ترمینال"');
    expect(source).toContain("terminalType !== 'all'");
    expect(source).toContain('setTerminalType(value as typeof terminalType)');
    expect(source).toContain('airportId: id');
    expect(source).toContain('setFormInitialValues({ airportId: parent.id })');
    expect(source).toContain("setLockedFormFields(['airportId'])");
    expect(source).toContain('id="terminal-parent-airport"');
    expect(source).toMatch(
      /masterDataApi\.detail\(\s*'airports',\s*selectedAirportId,?\s*\)/,
    );
  });
});
