import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HeaderToday } from './header-today';

describe('header date integration', () => {
  it('uses a stable server placeholder instead of freezing the build date', () => {
    const markup = renderToStaticMarkup(createElement(HeaderToday));
    expect(markup).toContain('تاریخ امروز');
    expect(markup).toContain('data-header-today');
    expect(markup).toContain('dir="rtl"');
    expect(markup).not.toContain('dateTime=');
    expect(markup).not.toContain('datetime=');
    expect(markup).toContain('truncate');
  });

  it('keeps the date in the header without replacing user, company or notification controls', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'app-shell.tsx'),
      'utf8',
    );
    const header = source.slice(
      source.indexOf('<header'),
      source.indexOf('</header>'),
    );
    expect(header).toContain('<HeaderToday />');
    expect(header.indexOf('<HeaderToday />')).toBeLessThan(
      header.indexOf('<HeaderActions />'),
    );
    expect(header).toContain(
      'className="hidden shrink-0 whitespace-nowrap lg:flex"',
    );
    expect(header).not.toContain('justify-end px-4 pb-1');
    expect(header).toContain('<LegalEntityContextSelector />');
    expect(header).toContain('<HeaderActions />');
    expect(source).toContain('<UserMenu />');
    expect(source).toContain('<NotificationCenter />');
    expect(source).toContain('getNavigationBreadcrumbs');
  });
});
