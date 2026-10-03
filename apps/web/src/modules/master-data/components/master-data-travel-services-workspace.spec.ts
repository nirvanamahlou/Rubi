import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

import { getMasterDataSection } from '../model/sections';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-travel-services-workspace.tsx',
  ),
  'utf8',
);
const travelReferenceModelSource = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/model/travel-reference-form.ts',
  ),
  'utf8',
);

const sourceFile = ts.createSourceFile(
  'master-data-travel-services-workspace.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const resources = [
  'leaders',
  'tour-types',
  'transfer-types',
  'visa-services',
] as const;

function travelTableContracts() {
  const headers = new Map<string, string[]>();
  const cells = new Map<string, number>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === 'headers' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isArrayLiteralExpression(property.initializer) ||
          !property.initializer.elements.every(ts.isStringLiteral)
        )
          continue;
        headers.set(
          property.name.getText(sourceFile).replaceAll("'", ''),
          property.initializer.elements.map((element) =>
            ts.isStringLiteral(element) ? element.text : '',
          ),
        );
      }
    }
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.getText(sourceFile) === 'cells' &&
      node.body
    ) {
      for (const statement of node.body.statements) {
        if (
          ts.isIfStatement(statement) &&
          ts.isReturnStatement(statement.thenStatement) &&
          statement.thenStatement.expression &&
          ts.isArrayLiteralExpression(statement.thenStatement.expression)
        ) {
          const match = statement.expression
            .getText(sourceFile)
            .match(/^resource === '([^']+)'$/);
          if (match?.[1])
            cells.set(
              match[1],
              statement.thenStatement.expression.elements.length + 3,
            );
        }
        if (
          ts.isReturnStatement(statement) &&
          statement.expression &&
          ts.isArrayLiteralExpression(statement.expression)
        )
          cells.set('visa-services', statement.expression.elements.length + 3);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.fromEntries(
    resources.map((resource) => {
      const resourceHeaders = headers.get(resource);
      const resourceCells = cells.get(resource);
      if (!resourceHeaders || resourceCells === undefined)
        throw new Error(`${resource} table contract not found`);
      return [resource, { headers: resourceHeaders, cells: resourceCells }];
    }),
  );
}

describe('travel services workspace', () => {
  it('keeps the remaining mockup tabs and their exact KPI labels', () => {
    for (const label of [
      'لیدرها',
      'نوع تور',
      'نوع ترانسفر',
      'ویزا',
      'کل لیدرها',
      'مقصدها',
      'مدرک ناقص',
      'داخلی',
      'خارجی',
      'اختصاصی',
      'اشتراکی',
      'کشورها',
    ])
      expect(source).toContain(label);
  });

  it('removes CIP and bus navigation and keeps tabs aligned with the hub card', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('type TravelResource'),
    );
    const resources = [...tabs.matchAll(/resource: '([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(resources).toEqual(
      getMasterDataSection('tours-travel-services')?.resources,
    );
    expect(resources).toHaveLength(4);
    for (const resource of ['cip-services', 'bus-companies', 'bus-types'])
      expect(source).not.toContain(resource);
    expect(source).not.toContain('setAirports');
  });

  it('opens every profile from the list without a standalone profile tab', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const rules'),
    );
    expect(tabs).not.toContain('پروفایل');
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('uses backend summaries and never embeds mockup sample records', () => {
    expect(source).toContain('masterDataApi.travelServicesSummary()');
    expect(source).not.toContain('سارا احمدی');
    expect(source).not.toContain('Marhaba Elite');
    expect(source).not.toMatch(/value:\s*(?:86|74|48|41|26|23)\b/);
  });

  it('removes Usage from every travel table while preserving exact alignment', () => {
    const tables = travelTableContracts();
    expect(tables).toEqual({
      leaders: {
        headers: [
          'کد',
          'لوگو',
          'نام فارسی / انگلیسی',
          'کشور و شهر فعالیت',
          'تماس',
          'زبان‌ها',
          'تخصص و مقصد',
          'وضعیت',
          'عملیات',
        ],
        cells: 9,
      },
      'tour-types': {
        headers: [
          'کد',
          'لوگو',
          'عنوان فارسی',
          'عنوان انگلیسی',
          'دامنه',
          'شرح',
          'وضعیت',
          'عملیات',
        ],
        cells: 8,
      },
      'transfer-types': {
        headers: [
          'کد',
          'لوگو',
          'عنوان',
          'وسیله',
          'شیوه سرویس',
          'ظرفیت پیشنهادی',
          'شرح',
          'وضعیت',
          'عملیات',
        ],
        cells: 9,
      },
      'visa-services': {
        headers: [
          'کد',
          'لوگو',
          'عنوان',
          'کشور مقصد',
          'نوع ویزا',
          'Provider',
          'مدت اعتبار مرجع',
          'مدارک راهنما',
          'وضعیت',
          'عملیات',
        ],
        cells: 10,
      },
    });
    for (const table of Object.values(tables)) {
      expect(table.headers).not.toContain('استفاده');
      expect(table.cells).toBe(table.headers.length);
    }
    expect(tables.leaders?.headers).not.toContain('مدارک');
    expect(tables['visa-services']?.headers).toContain('مدارک راهنما');
    expect(tables['tour-types']?.headers).not.toContain('آخرین تغییر');
    expect(source).toContain('label="استفاده"');
    expect(source).toContain('tourTypeUsageLabel(selected)');
    expect(travelReferenceModelSource).toContain(
      'export function transferUsageLabel',
    );
    expect(source).toContain('label="آخرین تغییر"');
    expect(source).toContain('tourTypeUpdatedLabel(selected, tourActorNames)');
    expect(source).toContain("'updatedAt',");
  });
});
