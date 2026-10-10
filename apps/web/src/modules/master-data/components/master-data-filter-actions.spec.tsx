import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MasterDataFilterActions } from './master-data-filter-actions';

describe('MasterDataFilterActions', () => {
  it('renders clear and refresh as bordered background buttons in a bottom-left action row', () => {
    const html = renderToStaticMarkup(
      createElement(MasterDataFilterActions, {
        onClear: vi.fn(),
        onRefresh: vi.fn(),
      }),
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('col-span-full');
    expect(html).toContain('justify-end');
    expect(html).toContain('border-t');
    expect(html).toContain('xl:col-auto');
    expect(html).toContain('xl:w-auto');
    expect(html).toContain('xl:border-t-0');
    expect(html).toContain('bg-background');
    expect(html).toContain('bg-primary/5');
    expect(html).toContain('پاک‌کردن');
    expect(html).toContain('aria-label="تازه‌سازی"');
    expect(html).not.toContain('>تازه‌سازی</button>');
  });

  it('keeps the shared filter bar compact and responsive without clipping date controls', () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/master-data/components/master-data-filter-bar.module.css',
      ),
      'utf8',
    );

    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('repeat(2, minmax(0, 1fr))');
    expect(css).toContain('repeat(3, minmax(0, 1fr))');
    expect(css).toContain('repeat(auto-fit, minmax(10.5rem, 1fr))');
    expect(css).toMatch(/\.filterBar > fieldset[\s\S]*grid-column: span 2/);
    expect(css).not.toMatch(/\.filterBar\s*\{[^}]*overflow\s*:/s);
    expect(css).not.toMatch(
      /\.filterBar\s*>\s*fieldset\s*\{[^}]*overflow\s*:/s,
    );
  });

  it.each([
    'master-data-finance-workspace.tsx',
    'master-data-geography-workspace.tsx',
    'master-data-suppliers-workspace.tsx',
    'master-data-accommodation-workspace.tsx',
    'master-data-transportation-workspace.tsx',
    'master-data-insurance-workspace.tsx',
    'master-data-travel-services-workspace.tsx',
    'master-data-sales-references-workspace.tsx',
    'master-data-live-workspace.tsx',
    'master-data-workspace.tsx',
  ])('uses the shared filter action row in %s', (fileName) => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/master-data/components', fileName),
      'utf8',
    );

    expect(source).toContain('<MasterDataFilterActions');
    expect(source).not.toMatch(
      /<Button[\s\S]{0,500}variant="ghost"[\s\S]{0,100}پاک‌کردن/,
    );
  });
});
