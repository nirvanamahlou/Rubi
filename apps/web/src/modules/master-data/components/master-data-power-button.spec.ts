import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@rubi/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const handlers = vi.hoisted(() => ({
  click: undefined as undefined | (() => void),
}));
vi.mock('@/components/ui/button', () => ({
  Button: (props: { onClick: () => void; children: ReactNode }) => {
    handlers.click = props.onClick;
    return createElement('button', props);
  },
}));
vi.mock('../api/client', () => ({ masterDataApi: { setStatus: vi.fn() } }));
import { masterDataApi } from '../api/client';
import { MasterDataPowerButton } from './master-data-power-button';
const record: MasterDataRecord = {
  id: 'reference',
  resource: 'countries',
  code: 'TR',
  name: 'ترکیه',
  status: 'active',
  version: 7,
  attributes: {},
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
describe('power status action', () => {
  beforeEach(() => vi.clearAllMocks());
  it('is clickable, labeled, and uses a power icon', () => {
    const html = renderToStaticMarkup(
      createElement(MasterDataPowerButton, { record, onChanged: vi.fn() }),
    );
    expect(html).toContain('غیرفعال‌سازی ترکیه');
    expect(html).toContain('lucide-power');
    expect(html).not.toContain('disabled');
  });
  it('sends the actual record resource/version once and refreshes on success', async () => {
    let finish!: () => void;
    vi.mocked(masterDataApi.setStatus).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({ data: { ...record, status: 'inactive', version: 8 } });
        }),
    );
    const refresh = vi.fn();
    renderToStaticMarkup(
      createElement(MasterDataPowerButton, { record, onChanged: refresh }),
    );
    handlers.click!();
    handlers.click!();
    expect(masterDataApi.setStatus).toHaveBeenCalledExactlyOnceWith(
      'countries',
      'reference',
      'inactive',
      7,
    );
    finish();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
  it('reactivates an inactive record, but never refreshes as success after a denied write', async () => {
    vi.mocked(masterDataApi.setStatus).mockRejectedValue(
      new Error('مجوز ندارید'),
    );
    const refresh = vi.fn();
    renderToStaticMarkup(
      createElement(MasterDataPowerButton, {
        record: { ...record, status: 'inactive' },
        onChanged: refresh,
      }),
    );
    handlers.click!();
    await vi.waitFor(() =>
      expect(masterDataApi.setStatus).toHaveBeenCalledWith(
        'countries',
        'reference',
        'active',
        7,
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
