import type * as React from 'react';
import type * as MasterDataClient from '../api/client';
import type { MasterDataRecord } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  index: 0,
  setters: [] as ReturnType<typeof vi.fn>[],
  states: null as unknown[] | null,
}));
const client = vi.hoisted(() => ({ previewLogo: vi.fn() }));

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof React>();
  return {
    ...original,
    useEffect: (effect: () => void | (() => void)) => {
      if (hooks.states) hooks.effects.push(effect);
      else original.useEffect(effect);
    },
    useState: (initial: unknown) => {
      if (!hooks.states) return original.useState(initial);
      const index = hooks.index++;
      return [hooks.states[index], (hooks.setters[index] ??= vi.fn())];
    },
  };
});
vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof MasterDataClient>();
  return {
    ...original,
    masterDataApi: {
      ...original.masterDataApi,
      previewLogo: client.previewLogo,
    },
  };
});

import { MasterDataApiError } from '../api/client';
import { MasterDataLogoImage } from './master-data-logo-image';

const record: MasterDataRecord = {
  id: 'record-1',
  resource: 'airlines',
  code: 'AIR-1',
  name: 'نیروانا',
  status: 'active',
  attributes: { logoFileReference: 'private-document-id' },
  version: 1,
  createdAt: '2026-10-21T00:00:00.000Z',
  updatedAt: '2026-10-21T00:00:00.000Z',
};
const imageKey = 'airlines/record-1/private-document-id';

function render(
  states: unknown[],
  props: Partial<React.ComponentProps<typeof MasterDataLogoImage>> = {},
) {
  hooks.effects = [];
  hooks.index = 0;
  hooks.setters = [];
  hooks.states = states;
  const tree = MasterDataLogoImage({ record, ...props });
  hooks.states = null;
  return {
    effect: hooks.effects[0],
    html: renderToStaticMarkup(tree),
    setters: hooks.setters,
  };
}

afterEach(() => {
  hooks.effects = [];
  hooks.index = 0;
  hooks.setters = [];
  hooks.states = null;
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MasterDataLogoImage table fallbacks', () => {
  it('shows an accessible compact loading state without exposing a direct file reference', () => {
    const { html } = render([null, null, 0]);

    expect(html).toContain('role="status"');
    expect(html).toContain('در حال دریافت لوگوی نیروانا');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('private-document-id');
  });

  it.each([
    [
      'pending',
      'لوگو در حال بررسی امنیتی است؛ نمایش آن خودکار انجام می‌شود.',
      'لوگوی نیروانا در حال بررسی امنیتی است.',
    ],
    [
      'error',
      'دسترسی به لوگو ممکن نیست.',
      'نمایش لوگوی نیروانا ممکن نیست: دسترسی به لوگو ممکن نیست.',
    ],
  ] as const)(
    'shows an accessible %s state in the table',
    (kind, message, label) => {
      const { html } = render([null, { key: imageKey, kind, message }, 0]);

      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain(`title="${label}"`);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('private-document-id');
    },
  );

  it('keeps the detailed error and retry action in the upload surface', () => {
    const message = 'بارگیری لوگو ناموفق بود.';
    const { html } = render(
      [null, { key: imageKey, kind: 'error', message }, 0],
      { showError: true },
    );

    expect(html).toContain(message);
    expect(html).toContain('تلاش دوباره');
    expect(html).not.toContain('aria-label="نمایش لوگوی');
  });
});

describe('MasterDataLogoImage authenticated blob lifecycle', () => {
  it('bounds pending-scan retries and then reports the unresolved error', async () => {
    vi.useFakeTimers();
    client.previewLogo.mockRejectedValue(
      new MasterDataApiError('اسکن هنوز تمام نشده است.', 409),
    );
    const { effect, setters } = render([null, null, 0]);

    const cleanup = effect?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(setters[1]).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'pending' }),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.previewLogo).toHaveBeenCalledTimes(13);
    expect(setters[1]).toHaveBeenLastCalledWith({
      key: imageKey,
      kind: 'error',
      message: 'اسکن هنوز تمام نشده است.',
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(client.previewLogo.mock.calls[0]?.[0]).toEqual({
      resource: 'airlines',
      recordId: 'record-1',
    });
    const signal = client.previewLogo.mock.calls[0]?.[1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    if (typeof cleanup === 'function') cleanup();
    expect(signal.aborted).toBe(true);
  });

  it('previews a local selection with an object URL and revokes it on cleanup', async () => {
    const createObjectURL = vi.fn(() => 'blob:local-logo');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const file = {
      lastModified: 42,
      name: 'logo.png',
      size: 4,
    } as File;
    const { effect, setters } = render([null, null, 0], {
      pending: { kind: 'replace', file },
    });

    const cleanup = effect?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(client.previewLogo).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(setters[0]).toHaveBeenCalledWith({
      key: 'local:logo.png:4:42',
      url: 'blob:local-logo',
    });
    expect(setters[1]).toHaveBeenCalledWith(null);
    if (typeof cleanup === 'function') cleanup();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-logo');
  });
});
