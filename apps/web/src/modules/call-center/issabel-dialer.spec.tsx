import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IssabelDialer, normalizeDialNumber } from './issabel-dialer';
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: vi.fn() }));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
describe('Issabel Call Center dialer', () => {
  it('normalizes Persian/Arabic phone digits without accepting dialplan syntax', () => {
    expect(normalizeDialNumber('۰۹۱۲ (۰۰۰) ۰۰۰۱')).toBe('09120000001');
    expect(normalizeDialNumber('+٩٨-٩١٢')).toBe('+98912');
    expect(normalizeDialNumber('101@from-internal')).toContain('@');
  });
  it('does not expose dialing controls without configured provider/current authority', () => {
    expect(
      renderToStaticMarkup(<IssabelDialer branchId="one" allowed={false} />),
    ).toBe('');
    expect(renderToStaticMarkup(<IssabelDialer branchId="one" allowed />)).toBe(
      '',
    );
  });
});
