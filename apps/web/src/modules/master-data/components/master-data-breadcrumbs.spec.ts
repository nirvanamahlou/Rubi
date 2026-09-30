import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '@/components/ui/surfaces';

function pageHeaderAttributes(source: string): readonly string[][] {
  const sourceFile = ts.createSourceFile(
    'profile.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const results: string[][] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === 'PageHeader'
    ) {
      results.push(
        node.attributes.properties.flatMap((property) =>
          ts.isJsxAttribute(property)
            ? [property.name.getText(sourceFile)]
            : [],
        ),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return results;
}

describe('Master Data page navigation', () => {
  it.each([
    'finance',
    'geography',
    'accommodation',
    'suppliers',
    'transportation',
    'insurance',
    'travel-services',
    'sales-references',
    'live',
  ])('does not duplicate the shell breadcrumb in the %s header', (name) => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/master-data/components',
        `master-data-${name}-workspace.tsx`,
      ),
      'utf8',
    );
    const headers = pageHeaderAttributes(source);
    expect(headers).toHaveLength(1);
    expect(headers[0]).not.toContain('eyebrow');
    expect(source).toContain('href="/master-data"');
  });

  it('allows profile identity eyebrows without restoring PageHeader breadcrumbs', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/master-data/components/master-data-finance-workspace.tsx',
      ),
      'utf8',
    );
    expect(source).toMatch(/<MasterDataProfileIdentity[\s\S]*?eyebrow=/);
    expect(pageHeaderAttributes(source)[0]).not.toContain('eyebrow');
  });

  it('parses attributes after nested actions and arrow expressions', () => {
    const valid = pageHeaderAttributes(`
      const view = <PageHeader
        actions={<Button onClick={() => value > 0}>بازگشت</Button>}
        title="عنوان"
      />;
    `);
    expect(valid).toEqual([['actions', 'title']]);

    const invalid = pageHeaderAttributes(`
      const view = <PageHeader
        actions={<Button onClick={() => value > 0}>بازگشت</Button>}
        title="عنوان"
        eyebrow="اطلاعات پایه"
      />;
    `);
    expect(invalid[0]).toContain('eyebrow');
  });

  it('retains the title and navigation action without a page description', () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        title: 'ترمینال‌ها',
        description: 'تعریف ترمینال‌های فرودگاه',
        actions: createElement('a', { href: '/master-data' }, 'همه بخش‌ها'),
      }),
    );
    expect(html).toMatch(/<h1\b[^>]*>ترمینال‌ها<\/h1>/);
    expect(html).not.toContain('تعریف ترمینال‌های فرودگاه');
    expect(html).toContain('<a href="/master-data">همه بخش‌ها</a>');
    expect(html).not.toContain('text-primary');
  });
});
