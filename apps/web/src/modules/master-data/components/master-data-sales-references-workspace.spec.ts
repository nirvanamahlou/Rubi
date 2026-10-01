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

function visibleCells(row: ts.JsxElement) {
  return row.children.flatMap((child): string[] => {
    if (ts.isJsxElement(child)) return [jsxName(child.openingElement.tagName)];
    if (ts.isJsxSelfClosingElement(child)) return [jsxName(child.tagName)];
    return [];
  });
}

function tableShape() {
  const table = firstElement(sourceFile, 'table');
  const headerRow = firstElement(firstElement(table, 'thead'), 'tr');
  const bodyRow = firstElement(firstElement(table, 'tbody'), 'tr');
  const headers = headerRow.children
    .filter(ts.isJsxElement)
    .filter((element) => jsxName(element.openingElement.tagName) === 'th')
    .map((element) =>
      element.children
        .filter(ts.isJsxText)
        .map((text) => text.text.trim())
        .join(''),
    );
  return {
    headers,
    cells: visibleCells(bodyRow).filter(
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

  it('removes table metadata columns from both resources and keeps rows aligned', () => {
    expect(tableShape()).toEqual({
      headers: ['ردیف', 'کد', 'لوگو', 'عنوان', 'توضیحات', 'وضعیت', 'عملیات'],
      cells: 7,
    });
    const table = source.slice(
      source.indexOf('<table'),
      source.indexOf('</table>'),
    );
    for (const label of ['ترتیب نمایش', 'استفاده در رکوردها', 'آخرین تغییر'])
      expect(table).not.toContain(label);
    expect(source).not.toContain('showDisplayOrder');
    expect(source).toContain('label="ترتیب نمایش"');
    expect(source).toContain("selected, 'displayOrder', '0'");
  });
});
