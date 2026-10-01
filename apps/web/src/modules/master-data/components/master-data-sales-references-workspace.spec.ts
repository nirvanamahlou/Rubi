import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { getMasterDataColumnFilters } from '@nora/contracts';

import { getMasterDataSection } from '../model/sections';
import {
  effectiveSalesReferenceColumnFilters,
  visibleSalesReferenceColumnFilterIndexes,
} from './master-data-sales-references-workspace';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-sales-references-workspace.tsx',
  ),
  'utf8',
);

const sourceFile = ts.createSourceFile(
  'master-data-sales-references-workspace.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function jsxName(node: ts.JsxTagNameExpression) {
  return node.getText(sourceFile);
}

function firstElement(root: ts.Node, tag: string): ts.JsxElement {
  let result: ts.JsxElement | undefined;
  const visit = (node: ts.Node) => {
    if (result) return;
    if (ts.isJsxElement(node) && jsxName(node.openingElement.tagName) === tag) {
      result = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  if (!result) throw new Error(`${tag} not found`);
  return result;
}

function unwrap(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
}

function visibleCells(row: ts.JsxElement, showDisplayOrder: boolean) {
  return row.children.flatMap((child): string[] => {
    if (ts.isJsxElement(child)) return [jsxName(child.openingElement.tagName)];
    if (ts.isJsxSelfClosingElement(child)) return [jsxName(child.tagName)];
    if (!ts.isJsxExpression(child) || !child.expression) return [];
    const expression = unwrap(child.expression);
    if (
      !ts.isConditionalExpression(expression) ||
      expression.condition.getText(sourceFile) !== 'showDisplayOrder'
    )
      return [];
    const branch = unwrap(
      showDisplayOrder ? expression.whenTrue : expression.whenFalse,
    );
    return ts.isJsxElement(branch)
      ? [jsxName(branch.openingElement.tagName)]
      : [];
  });
}

function tableShape(showDisplayOrder: boolean) {
  const table = firstElement(sourceFile, 'table');
  const headerRow = firstElement(firstElement(table, 'thead'), 'tr');
  const bodyRow = firstElement(firstElement(table, 'tbody'), 'tr');
  return {
    headers: visibleCells(headerRow, showDisplayOrder).filter(
      (name) => name === 'th',
    ).length,
    cells: visibleCells(bodyRow, showDisplayOrder).filter(
      (name) => name === 'td' || name === 'MasterDataLogoCell',
    ).length,
  };
}

describe('sales references workspace', () => {
  it('keeps only the two requested tabs without a standalone profile section', () => {
    for (const label of ['نحوه آشنایی', 'کانال فروش'])
      expect(source).toContain(label);
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
    expect(source).not.toContain('profile-tab');
  });

  it('removes the three requested references and keeps tabs aligned with the hub', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('type SalesReferenceResource'),
    );
    const resources = [...tabs.matchAll(/resource: '([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(resources).toEqual(
      getMasterDataSection('sales-references')?.resources,
    );
    expect(resources).toHaveLength(2);
    for (const resource of [
      'lead-sources',
      'customer-types',
      'campaign-types',
      'lost-reasons',
      'tags',
    ])
      expect(tabs).not.toContain(resource);
  });

  it('uses the exact four KPI names from the mockup', () => {
    for (const label of ['کل موارد', 'فعال', 'استفاده‌شده', 'نیازمند بازبینی'])
      expect(source).toContain(label);
  });

  it('keeps consumer usage behind public contracts', () => {
    expect(source).toContain('در انتظار قرارداد Aggregate');
    expect(source).toContain('Query مستقیم');
    expect(source).toContain("value: '—'");
    expect(source).not.toContain('customerApi');
  });

  it('hides and drops only the acquaintance English-name filter', () => {
    const staleFilters = {
      columnFilter1: 'ACQ',
      columnFilter2: 'Referral',
    };

    expect(
      visibleSalesReferenceColumnFilterIndexes('acquaintance-methods'),
    ).toEqual([0]);
    expect(
      effectiveSalesReferenceColumnFilters(
        'acquaintance-methods',
        staleFilters,
      ),
    ).toEqual({ columnFilter1: 'ACQ' });
    expect(
      effectiveSalesReferenceColumnFilters('acquaintance-methods', {
        columnFilter2: 'Referral',
      }),
    ).toEqual({});
    expect(visibleSalesReferenceColumnFilterIndexes('sales-channels')).toEqual([
      0, 1,
    ]);
    expect(
      effectiveSalesReferenceColumnFilters('sales-channels', staleFilters),
    ).toEqual(staleFilters);
    expect(source.match(/\.\.\.effectiveColumnFilters/g)).toHaveLength(2);
    expect(getMasterDataColumnFilters('acquaintance-methods')).toMatchObject([
      { label: 'کد', path: ['code'] },
      { label: 'نام انگلیسی', path: ['englishName'] },
    ]);
    expect(getMasterDataColumnFilters('sales-channels')).toMatchObject([
      { label: 'کد', path: ['code'] },
      { label: 'نام انگلیسی', path: ['englishName'] },
    ]);
    expect(source).toMatch(
      /const effectiveColumnFilters = useMemo\(\s*\(\) => effectiveSalesReferenceColumnFilters\(resource, columnFilters\)/,
    );
    expect(source).toMatch(
      /const visibleColumnFilterIndexes =\s*visibleSalesReferenceColumnFilterIndexes\(resource\)/,
    );
    expect(source).toMatch(
      /columnFilterControls\.filter\(\(_, index\) =>\s*visibleColumnFilterIndexes\.includes\(index\)/,
    );
    expect(source).toContain('{visibleColumnFilterControls}');
    expect(source).toContain('id="sales-reference-search"');
    expect(source).toContain('label="عنوان انگلیسی"');
    expect(source).toContain("value={attribute(selected, 'englishName')}");
  });

  it('removes display order only from acquaintance rows while keeping both tables aligned', () => {
    expect(tableShape(false)).toEqual({ headers: 9, cells: 9 });
    expect(tableShape(true)).toEqual({ headers: 10, cells: 10 });
    expect(source.match(/showDisplayOrder \? \(/g)).toHaveLength(2);
    expect(source).toContain(
      "const showDisplayOrder = resource === 'sales-channels';",
    );
    expect(source).toMatch(
      /showDisplayOrder \? \(\s*<th[^>]*>ترتیب نمایش<\/th>/,
    );
    expect(source).toMatch(
      /showDisplayOrder \? \([\s\S]*?<td[^>]*>[\s\S]*?attribute\(record, 'displayOrder', '0'\)[\s\S]*?<\/td>/,
    );
    expect(source).toContain('label="ترتیب نمایش"');
    expect(source).toContain("selected, 'displayOrder', '0'");
  });
});
