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
    expect(source).toContain('<PageHeader');
    expect(source).not.toMatch(/\beyebrow\s*=/);
    expect(source).toContain('href="/master-data"');
  });

  it('retains the title, description and navigation action without the blue caption', () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        title: 'ترمینال‌ها',
        description: 'تعریف ترمینال‌های فرودگاه',
        actions: createElement('a', { href: '/master-data' }, 'همه بخش‌ها'),
      }),
    );
    expect(html).toMatch(/<h1\b[^>]*>ترمینال‌ها<\/h1>/);
    expect(html).toContain('تعریف ترمینال‌های فرودگاه');
    expect(html).toContain('<a href="/master-data">همه بخش‌ها</a>');
    expect(html).not.toContain('text-primary');
  });
});
