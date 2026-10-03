import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const read = (name: string) =>
  readFileSync(
    resolve(process.cwd(), `src/modules/master-data/components/${name}`),
    'utf8',
  );
const occurrences = (source: string, value: string) =>
  source.split(value).length - 1;

function jsxElements(source: string, tagName: string) {
  const sourceFile = ts.createSourceFile(
    'renderer.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const elements: ts.JsxElement[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(sourceFile) === tagName
    )
      elements.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return elements.map((element) => element.getText(sourceFile));
}

describe('Master Data Operations table alignment', () => {
  it.each([
    ['master-data-accommodation-workspace.tsx', 0, 1, 1],
    ['master-data-finance-workspace.tsx', 3, 0, 3],
    ['master-data-geography-workspace.tsx', 0, 1, 1],
    ['master-data-insurance-workspace.tsx', 0, 4, 2],
    ['master-data-live-workspace.tsx', 1, 0, 1],
    ['master-data-suppliers-workspace.tsx', 0, 2, 2],
    ['master-data-transportation-workspace.tsx', 1, 0, 1],
    ['master-data-travel-services-workspace.tsx', 0, 1, 1],
    ['master-data-bank-profile.tsx', 1, 0, 1],
    ['master-data-sales-references-workspace.tsx', 1, 0, 1],
  ] as const)(
    'binds every Operations header and action cell structurally in %s',
    (file, directHeaderCount, mappedHeaderCount, actionCellCount) => {
      const source = read(file);
      const headers = jsxElements(source, 'th');
      const directHeaders = headers.filter((header) =>
        />\s*عملیات\s*<\/th>/.test(header),
      );
      const mappedHeaders = headers.filter(
        (header) =>
          header.includes("=== 'عملیات'") && header.includes('text-center'),
      );
      const actionCells = jsxElements(source, 'td').filter(
        (cell) =>
          cell.includes('text-center') &&
          (cell.includes('justify-center') ||
            cell.includes('{actions(record)}') ||
            cell.includes('{rowActions(record)}')),
      );

      expect(directHeaders).toHaveLength(directHeaderCount);
      expect(
        directHeaders.every((header) => header.includes('text-center')),
      ).toBe(true);
      expect(mappedHeaders).toHaveLength(mappedHeaderCount);
      expect(actionCells).toHaveLength(actionCellCount);
    },
  );

  it.each([
    ['master-data-accommodation-workspace.tsx', 'header', 1, 1],
    ['master-data-insurance-workspace.tsx', 'label', 1, 1],
    ['master-data-travel-services-workspace.tsx', 'label', 1, 1],
  ] as const)(
    'centers mapped Operations headers, cells and action groups in %s',
    (file, headerVariable, cells, groups) => {
      const source = read(file);
      expect(source).toContain(
        `${headerVariable} === 'عملیات' ? 'p-4 text-center' : 'p-4 text-start'`,
      );
      expect(
        occurrences(source, 'className="p-4 text-center"'),
      ).toBeGreaterThanOrEqual(cells);
      expect(
        occurrences(source, 'flex flex-wrap justify-center gap-2'),
      ).toBeGreaterThanOrEqual(groups);
    },
  );

  it('centers both Supplier and Broker Operations columns through their shared action helper', () => {
    const source = read('master-data-suppliers-workspace.tsx');
    expect(source).toContain(
      "head === 'عملیات' ? 'p-4 text-center' : 'p-4 text-start'",
    );
    expect(
      occurrences(
        source,
        '<td className="p-4 text-center">{rowActions(record)}</td>',
      ),
    ).toBe(2);
    const actions = source.slice(
      source.indexOf('const rowActions'),
      source.indexOf('function renderProfile'),
    );
    expect(actions).toContain('flex flex-wrap justify-center gap-2');
    expect(actions.indexOf('openProfile(record)')).toBeLessThan(
      actions.indexOf("setFormMode('edit')"),
    );
    expect(actions.indexOf("setFormMode('edit')")).toBeLessThan(
      actions.indexOf('<MasterDataDeleteButton'),
    );
    expect(actions).toContain("tab !== 'collaboration'");
  });

  it('centers the main Geography Operations column without changing expanded child cards', () => {
    const source = read('master-data-geography-workspace.tsx');
    expect(source).toContain(
      "column === 'عملیات' ? 'p-4 text-center' : 'p-4 text-start'",
    );
    const table = source.slice(
      source.indexOf('فهرست {definition.label}'),
      source.indexOf('expandedCountryId === record.id ? ('),
    );
    expect(table).toContain('<td className="p-4 text-center">');
    expect(table).toContain('flex flex-wrap justify-center gap-2');
    expect(table.indexOf("openRecord(record, 'view')")).toBeLessThan(
      table.indexOf("openRecord(record, 'edit')"),
    );
    expect(table.indexOf("openRecord(record, 'edit')")).toBeLessThan(
      table.indexOf('<MasterDataDeleteButton'),
    );
  });

  it.each([
    ['master-data-transportation-workspace.tsx', 1],
    ['master-data-live-workspace.tsx', 1],
  ] as const)('centers direct Operations markup in %s', (file, count) => {
    const source = read(file);
    expect(
      occurrences(source, '<th className="p-4 text-center">عملیات</th>'),
    ).toBe(count);
    expect(
      occurrences(source, '<td className="p-4 text-center">'),
    ).toBeGreaterThanOrEqual(count);
    expect(
      occurrences(source, 'flex flex-wrap justify-center gap-2'),
    ).toBeGreaterThanOrEqual(count);
  });

  it('centers all three Finance Operations tables including currency history', () => {
    const source = read('master-data-finance-workspace.tsx');
    expect(
      occurrences(source, '<th className="p-4 text-center">عملیات</th>'),
    ).toBe(3);
    expect(
      occurrences(source, '<td className="p-4 text-center">'),
    ).toBeGreaterThanOrEqual(3);
    expect(
      occurrences(source, 'flex flex-wrap justify-center gap-2'),
    ).toBeGreaterThanOrEqual(3);
    expect(source).toContain('onDeleted={loadCurrencyHistory}');
    expect(source).toContain('onClick={() => void showAudit(row)}');
  });

  it('centers the nested Bank Branch Operations column', () => {
    const source = read('master-data-bank-profile.tsx');
    expect(source).toContain('<th className="p-3 text-center">عملیات</th>');
    expect(source).toContain('<td className="p-3 text-center">');
    expect(source).toContain('<div className="flex justify-center gap-2">');
    expect(source.indexOf("setFormMode('view')")).toBeLessThan(
      source.indexOf("setFormMode('edit')"),
    );
  });

  it('keeps the already-centered Sales References table as the reference', () => {
    const source = read('master-data-sales-references-workspace.tsx');
    expect(source).toContain('<th className="p-4 text-center">عملیات</th>');
    expect(source).toContain('<td className="p-4 text-center">');
    expect(source).toContain('flex flex-wrap justify-center gap-2');
  });
});
