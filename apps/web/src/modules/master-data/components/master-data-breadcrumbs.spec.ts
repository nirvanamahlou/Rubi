import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '@/components/ui/surfaces';

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
    const pageHeaderTag = source.match(/<PageHeader\b[^>]*>/s)?.[0];
    expect(pageHeaderTag).toBeDefined();
    expect(pageHeaderTag).not.toMatch(/\beyebrow\s*=/);
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
    const pageHeaderTag = source.match(/<PageHeader\b[^>]*>/s)?.[0];
    expect(pageHeaderTag).not.toMatch(/\beyebrow\s*=/);
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
