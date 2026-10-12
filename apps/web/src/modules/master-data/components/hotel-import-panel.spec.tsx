import { createElement, isValidElement, type ReactNode } from 'react';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DisplayLocaleContext } from '@/i18n/locale-context';
import { HotelImportPanel } from './hotel-import-panel';
import { masterDataApi } from '../api/client';
import { canonicalTestTree } from '@/i18n/test-tree';

const hooks = vi.hoisted(() => ({
  states: null as unknown[] | null,
  index: 0,
}));
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof React>();
  return {
    ...original,
    useState: (initial: unknown) =>
      hooks.states
        ? [hooks.states[hooks.index++], vi.fn()]
        : original.useState(initial),
    useEffect: (...args: Parameters<typeof original.useEffect>) => {
      if (!hooks.states) original.useEffect(...args);
    },
  };
});
vi.mock('../api/client', () => ({
  masterDataApi: { commitHotelImport: vi.fn() },
}));

function commitButton(node: ReactNode): (() => void) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = commitButton(child);
      if (found) return found;
    }
  }
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node))
    return;
  if (node.props.children === 'ثبت نهایی هتل‌ها') return node.props.onClick;
  return commitButton(node.props.children);
}

afterEach(() => {
  hooks.states = null;
  hooks.index = 0;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('hotel import template download', () => {
  it('commits the preview and refreshes hotels on LAN HTTP without randomUUID', async () => {
    const counts = {
      rows: 3,
      valid: 3,
      invalid: 0,
      duplicates: 0,
      created: 3,
      updated: 0,
      skipped: 0,
    };
    hooks.states = [
      [],
      [],
      'country-id',
      'city-id',
      null,
      {
        sessionId: 'session-id',
        previewToken: 'token',
        counts,
        rows: [],
        issues: [],
        security: {},
      },
      'SKIP',
      true,
      null,
      null,
    ];
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(12),
    });
    const result = {
      sessionId: 'session-id',
      status: 'COMPLETED' as const,
      counts,
      committedAt: '2026-10-12T00:00:00.000Z',
    };
    vi.mocked(masterDataApi.commitHotelImport).mockResolvedValue({
      data: result,
    });
    const onImported = vi.fn();
    const onClick = commitButton(
      canonicalTestTree(HotelImportPanel({ onImported })),
    );
    expect(onClick).toBeTypeOf('function');
    onClick!();
    await vi.waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({
        result,
        countryId: 'country-id',
        cityId: 'city-id',
      }),
    );
    expect(masterDataApi.commitHotelImport).toHaveBeenCalledWith('session-id', {
      previewToken: 'token',
      duplicateBehavior: 'SKIP',
      createMissingReferences: true,
      idempotencyKey: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
  });
  it.each(['fa', 'en'] as const)(
    'offers the original workbook in %s',
    (locale) => {
      const html = renderToStaticMarkup(
        createElement(
          DisplayLocaleContext.Provider,
          { value: locale },
          createElement(HotelImportPanel, { onImported: () => undefined }),
        ),
      );
      expect(html).toContain('href="/templates/hotel-master-template.xlsx"');
      expect(html).toContain('download="hotel-master-template.xlsx"');
      expect(html).toContain(
        locale === 'fa'
          ? 'دانلود قالب اکسل هتل‌ها'
          : 'Download hotel Excel template',
      );
    },
  );
});
