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

const sourceFile = ts.createSourceFile(
  'master-data-travel-services-workspace.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function tourTableContract() {
  let headers: string[] | undefined;
  let cells: number | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sourceFile).replaceAll("'", '');
      if (
        name === 'tour-types' &&
        ts.isArrayLiteralExpression(node.initializer) &&
        node.initializer.elements.every(ts.isStringLiteral)
      )
        headers = node.initializer.elements
          .filter(ts.isStringLiteral)
          .map((element) => element.text);
    }
    if (
      ts.isIfStatement(node) &&
      node.expression.getText(sourceFile) === "resource === 'tour-types'"
    ) {
      const returnStatement = node.thenStatement;
      if (
        ts.isReturnStatement(returnStatement) &&
        returnStatement.expression &&
        ts.isArrayLiteralExpression(returnStatement.expression)
      )
        cells = returnStatement.expression.elements.length;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!headers || cells === undefined)
    throw new Error('Tour Types table contract not found');
  return { headers, cells: cells + 3 };
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

  it('removes only the Tour Types last-change table column', () => {
    const table = tourTableContract();
    expect(table).toEqual({
      headers: [
        'کد',
        'لوگو',
        'عنوان فارسی',
        'عنوان انگلیسی',
        'دامنه',
        'شرح',
        'استفاده',
        'وضعیت',
        'عملیات',
      ],
      cells: 9,
    });
    expect(table.headers).not.toContain('آخرین تغییر');
    expect(source).toContain('label="آخرین تغییر"');
    expect(source).toContain('tourTypeUpdatedLabel(selected, tourActorNames)');
    expect(source).toContain("'updatedAt',");
  });
});
