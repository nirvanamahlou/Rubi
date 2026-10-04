import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-suppliers-workspace.tsx',
  ),
  'utf8',
);

const sourceFile = ts.createSourceFile(
  'master-data-suppliers-workspace.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function jsxName(node: ts.JsxTagNameExpression): string {
  return node.getText(sourceFile);
}

function tableContract(label: string) {
  let result: { headers: string[]; cells: number } | undefined;
  const visit = (node: ts.Node) => {
    if (
      !ts.isJsxElement(node) ||
      jsxName(node.openingElement.tagName) !== 'table'
    ) {
      ts.forEachChild(node, visit);
      return;
    }
    const ariaLabel = node.openingElement.attributes.properties.find(
      (property): property is ts.JsxAttribute =>
        ts.isJsxAttribute(property) &&
        property.name.getText(sourceFile) === 'aria-label',
    );
    if (!ariaLabel?.initializer || !ts.isStringLiteral(ariaLabel.initializer))
      return;
    if (ariaLabel.initializer.text !== label) return;

    let headers: string[] = [];
    let cells = 0;
    const inspect = (child: ts.Node) => {
      if (
        ts.isArrayLiteralExpression(child) &&
        child.elements.every(ts.isStringLiteral) &&
        child.elements.some(
          (element) => ts.isStringLiteral(element) && element.text === 'عملیات',
        )
      )
        headers = child.elements.map((element) =>
          ts.isStringLiteral(element) ? element.text : '',
        );
      if (
        ts.isJsxElement(child) &&
        jsxName(child.openingElement.tagName) === 'tbody'
      ) {
        const row = child.children
          .flatMap((item) =>
            ts.isJsxExpression(item) && item.expression
              ? [item.expression]
              : [],
          )
          .flatMap((expression) => {
            let found: ts.JsxElement[] = [];
            const findRow = (candidate: ts.Node) => {
              if (
                ts.isJsxElement(candidate) &&
                jsxName(candidate.openingElement.tagName) === 'tr'
              )
                found = [candidate];
              else ts.forEachChild(candidate, findRow);
            };
            findRow(expression);
            return found;
          })[0];
        if (row)
          cells = row.children.filter(
            (item) =>
              (ts.isJsxElement(item) &&
                jsxName(item.openingElement.tagName) === 'td') ||
              (ts.isJsxSelfClosingElement(item) &&
                jsxName(item.tagName) === 'MasterDataLogoCell'),
          ).length;
      }
      ts.forEachChild(child, inspect);
    };
    inspect(node);
    result = { headers, cells };
  };
  visit(sourceFile);
  if (!result) throw new Error(`Table not found: ${label}`);
  return result;
}

describe('organizations and suppliers workspace', () => {
  it('removes the purchase restriction columns only from supplier and broker lists', () => {
    const suppliers = tableContract('فهرست تأمین‌کنندگان');
    const brokers = tableContract('فهرست کارگزاران');

    expect(suppliers.headers).toEqual([
      'کد',
      'لوگو',
      'تأمین‌کننده',
      'کشور / شهر',
      'خدمات قابل ارائه',
      'Provider ID',
      'وضعیت همکاری',
      'عملیات',
    ]);
    expect(suppliers.cells).toBe(suppliers.headers.length);
    expect(brokers.headers).toEqual([
      'کد',
      'لوگو',
      'کارگزار',
      'سازمان / نوع',
      'کشور / شهر',
      'تماس اصلی',
      'خدمات',
      'وضعیت',
      'عملیات',
    ]);
    expect(brokers.headers).not.toContain('محدودیت خرید');
    expect(brokers.cells).toBe(brokers.headers.length);
    expect(source).toContain('label="محدودیت خرید"');
  });

  it('keeps profiles in popups and removes standalone profile/contact tabs', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const tabCopy'),
    );

    expect(tabs).toContain("id: 'suppliers'");
    expect(tabs).toContain("id: 'brokers'");
    expect(tabs).toContain("id: 'collaboration'");
    expect(tabs).not.toContain("id: 'supplier-profile'");
    expect(tabs).not.toContain("id: 'broker-profile'");
    expect(tabs).not.toContain("id: 'contacts'");
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('keeps every KPI label aligned with the approved mockup', () => {
    for (const label of [
      'کل تأمین‌کنندگان',
      'همکاری فعال',
      'متصل به Provider/API',
      'کل کارگزاران',
      'پروفایل فعال',
      'شهرهای تحت پوشش',
      'دارای خدمات',
      'دارای تماس اصلی',
      'در حال بررسی',
      'تعلیق خرید',
      'پایان همکاری',
    ])
      expect(source).toContain(label);
    expect(source).not.toContain('پروفایل غیرفعال');
  });

  it('keeps established summaries independent from fourth KPI failures', () => {
    expect(source).toContain('Promise.allSettled([');
    expect(source).toContain("summaryResult.status === 'fulfilled'");
    expect(source).toContain("fourthKpiResult.status === 'fulfilled'");
    expect(source).toContain('setSummary(summaryResult.value.data)');
    expect(source).toContain('setFourthKpis(null)');
  });

  it('uses real APIs and leaves module-owned metrics unknown', () => {
    expect(source).toContain('organizationSupplierSummary');
    expect(source).not.toContain('unmaskOrganizationContact');
    expect(source).not.toContain("label: 'طرف قرارداد'");
    expect(source).not.toContain('سپهر سفر');
    expect(source).not.toContain('CTR-');
  });

  it('keeps collaboration editing in source forms and removes direct status actions', () => {
    expect(source).not.toContain('تعریف وضعیت');
    expect(source).toContain("formMode && tab !== 'collaboration'");
    const actions = source.slice(
      source.indexOf('const rowActions'),
      source.indexOf('function renderProfile'),
    );
    const writeGuard = actions.indexOf("tab !== 'collaboration'");
    expect(writeGuard).toBeGreaterThan(actions.indexOf('openProfile(record)'));
    expect(writeGuard).toBeLessThan(actions.indexOf("setFormMode('edit')"));
    expect(actions).not.toContain('<MasterDataPowerButton');
    expect(source).not.toContain('تازه‌سازی وضعیت‌ها');
    expect(source).toContain('onRefresh={() =>');
  });

  it('reads both source lists and provides pagination for the collaboration board', () => {
    expect(source).toContain('loadSupplierCollaborationPage(masterDataApi, {');
    expect(source).toMatch(
      /groupSupplierCollaborationRecords\(\s*records,\s*collaborationRecords/,
    );
    expect(source).toContain('page >= collaborationPageCount');
    expect(source).not.toContain('pageSize: 100');
    expect(source).toContain('laneRecords.length.toLocaleString');
    expect(source).toContain('if (sequence !== loadSequence.current) return;');
  });
});
