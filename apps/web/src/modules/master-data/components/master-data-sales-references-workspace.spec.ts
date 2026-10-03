import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

import { getMasterDataSection } from '../model/sections';
import { getMasterDataDefinition } from '../model/catalog';
import {
  appendUniqueSalesReferenceSummaryPage,
  countEnglishTitles,
  hasValidSalesReferenceSummaryProgress,
  isCurrentSalesReferenceSummaryRequest,
  salesReferenceKpiItems,
  salesReferenceExportColumns,
} from './master-data-sales-references-workspace';
import type { MasterDataRecord } from '@nora/contracts';

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

function className(element: ts.JsxElement) {
  const attribute = element.openingElement.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) &&
      property.name.getText(sourceFile) === 'className',
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : '';
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
  it('submits one canonical Excel column set for both resources', () => {
    const expected = [
      'code',
      'name',
      'englishName',
      'description',
      'displayOrder',
      'status',
      'updatedAt',
    ];

    for (const resource of [
      'acquaintance-methods',
      'sales-channels',
    ] as const) {
      const columns = salesReferenceExportColumns(
        getMasterDataDefinition(resource).fields,
      );
      expect(columns).toEqual(expected);
      expect(new Set(columns).size).toBe(columns.length);
    }

    expect(source).toContain(
      'columns: salesReferenceExportColumns(definition.fields)',
    );
    expect(source).toContain('resource,');
    expect(source.match(/\.\.\.columnFilters/g)).toHaveLength(2);
  });

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

  it('uses a truthful global English-title KPI on both tabs', () => {
    const record = (
      resource: 'acquaintance-methods' | 'sales-channels',
      englishName: unknown,
      status: 'active' | 'inactive' = 'active',
    ) =>
      ({
        id: `${resource}-${String(englishName)}`,
        resource,
        code: 'REF-1',
        name: 'مرجع',
        status,
        attributes: { englishName },
        version: 1,
        createdAt: '2026-10-03T00:00:00.000Z',
        updatedAt: '2026-10-03T00:00:00.000Z',
      }) as MasterDataRecord;
    const rows = [
      record('acquaintance-methods', 'Referral'),
      record('acquaintance-methods', ' Referral '),
      record('acquaintance-methods', ''),
      record('acquaintance-methods', '   '),
      record('acquaintance-methods', null),
      record('acquaintance-methods', 42),
    ];

    expect(countEnglishTitles(rows)).toBe(2);
    for (const resource of [
      'acquaintance-methods',
      'sales-channels',
    ] as const) {
      const cards = salesReferenceKpiItems(resource, rows, 'ready');
      expect(cards.map((card) => card.label)).toEqual([
        'کل موارد',
        'فعال',
        'استفاده‌شده',
        'دارای عنوان انگلیسی',
      ]);
      expect(cards[3]).toMatchObject({
        value: 2,
        hint: 'در کل اطلاعات پایه',
      });
      expect(salesReferenceKpiItems(resource, [], 'ready')[3]?.value).toBe(0);
      expect(salesReferenceKpiItems(resource, rows, 'loading')[3]?.value).toBe(
        '—',
      );
      expect(salesReferenceKpiItems(resource, rows, 'error')[3]?.value).toBe(
        '—',
      );
    }
    expect(source).not.toContain("label: 'نیازمند بازبینی'");
  });

  it('rejects incomplete or malformed global summary pagination', () => {
    expect(hasValidSalesReferenceSummaryProgress(0, 0, 0)).toBe(true);
    expect(hasValidSalesReferenceSummaryProgress(2, 2, 4)).toBe(true);
    expect(hasValidSalesReferenceSummaryProgress(0, 2, 4)).toBe(false);
    expect(hasValidSalesReferenceSummaryProgress(2, 5, 4)).toBe(false);
    for (const total of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(hasValidSalesReferenceSummaryProgress(1, 1, total)).toBe(false);
    const firstPage = [
      {
        id: 'one',
        attributes: {},
      } as MasterDataRecord,
      {
        id: 'two',
        attributes: {},
      } as MasterDataRecord,
    ];
    const rows: MasterDataRecord[] = [];
    const seenIds = new Set<string>();
    expect(
      appendUniqueSalesReferenceSummaryPage(rows, seenIds, firstPage),
    ).toBe(true);
    expect(
      appendUniqueSalesReferenceSummaryPage(rows, seenIds, [firstPage[0]!]),
    ).toBe(false);
    expect(rows.map((record) => record.id)).toEqual(['one', 'two']);
    expect(
      appendUniqueSalesReferenceSummaryPage([], new Set(), [
        firstPage[0]!,
        firstPage[0]!,
      ]),
    ).toBe(false);
    expect(
      isCurrentSalesReferenceSummaryRequest(
        3,
        3,
        'acquaintance-methods',
        'acquaintance-methods',
      ),
    ).toBe(true);
    expect(
      isCurrentSalesReferenceSummaryRequest(
        3,
        4,
        'acquaintance-methods',
        'acquaintance-methods',
      ),
    ).toBe(false);
    expect(
      isCurrentSalesReferenceSummaryRequest(
        3,
        3,
        'acquaintance-methods',
        'sales-channels',
      ),
    ).toBe(false);
    expect(source).toContain('summaryRequestRef.current += 1');
    expect(source).toContain('summaryResourceRef.current = next');
    expect(source).toContain("setSummaryState('loading')");
    expect(source).toContain("setSummaryState('error')");
  });

  it('keeps consumer usage behind public contracts', () => {
    expect(source).toContain('در انتظار قرارداد Aggregate');
    expect(source).toContain('Query مستقیم');
    expect(source).toContain("value: '—'");
    expect(source).not.toContain('customerApi');
  });

  it('uses the shared English-free controls and payload on both resources', () => {
    expect(source.match(/\.\.\.columnFilters/g)).toHaveLength(2);
    expect(source).toContain('{columnFilterControls}');
    expect(source).not.toContain('effectiveSalesReferenceColumnFilters');
    expect(source).not.toContain('visibleSalesReferenceColumnFilterIndexes');
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

  it('centers only code and operations while preserving action behavior', () => {
    const table = firstElement(sourceFile, 'table');
    const headerRow = firstElement(firstElement(table, 'thead'), 'tr');
    const headers = headerRow.children.filter(ts.isJsxElement);
    const codeHeader = headers.find((element) =>
      element.getText(sourceFile).includes('>کد<'),
    )!;
    const operationsHeader = headers.find((element) =>
      element.getText(sourceFile).includes('>عملیات<'),
    )!;
    const bodyRow = firstElement(firstElement(table, 'tbody'), 'tr');
    const cells = bodyRow.children.filter(
      (child): child is ts.JsxElement | ts.JsxSelfClosingElement =>
        ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child),
    );
    const codeCell = cells[1] as ts.JsxElement;
    const operationsCell = cells[6] as ts.JsxElement;
    const actions = firstElement(operationsCell, 'div');

    expect(className(codeHeader)).toContain('text-center');
    expect(className(operationsHeader)).toContain('text-center');
    expect(className(codeCell)).toContain('text-center');
    expect(codeCell.openingElement.attributes.getText(sourceFile)).toContain(
      'dir="ltr"',
    );
    expect(className(operationsCell)).toContain('text-center');
    expect(className(actions)).toContain('justify-center');

    const actionSource = operationsCell.getText(sourceFile);
    expect(actionSource.indexOf('openProfile(record)')).toBeLessThan(
      actionSource.indexOf("setFormMode('edit')"),
    );
    expect(actionSource.indexOf("setFormMode('edit')")).toBeLessThan(
      actionSource.indexOf('<MasterDataDeleteButton'),
    );
    for (const label of ['ردیف', 'لوگو', 'عنوان', 'توضیحات', 'وضعیت']) {
      const header = headers.find((element) =>
        element.getText(sourceFile).includes(`>${label}<`),
      )!;
      expect(className(header)).toContain('text-start');
    }
  });

  it('removes only version and Persian title from shared View details', () => {
    const profile = source.slice(
      source.indexOf('{selected ? ('),
      source.lastIndexOf('</MasterDataProfileDialog>'),
    );

    expect(profile).not.toContain('label="نسخه"');
    expect(profile).not.toContain('label="عنوان فارسی"');
    expect(profile).not.toContain('selected.version.toLocaleString');
    expect(profile).toContain('title={selected.name}');
    for (const label of ['عنوان انگلیسی', 'ترتیب نمایش', 'توضیحات'])
      expect(profile).toContain(`label="${label}"`);
    expect(source).toContain('version: selected.version');
    expect(source).toContain('<MasterDataLiveForm');
  });
});
