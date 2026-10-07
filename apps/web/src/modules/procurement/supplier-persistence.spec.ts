import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { persistSupplierProfile } from './supplier-persistence';

const record: MasterDataRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  resource: 'suppliers',
  code: 'SUP-1',
  name: 'تأمین‌کننده',
  status: 'active',
  attributes: {},
  version: 1,
  createdAt: '2026-10-07T00:00:00Z',
  updatedAt: '2026-10-07T00:00:00Z',
};
afterEach(() => vi.restoreAllMocks());
describe('supplier logo save recovery', () => {
  it('keeps the persisted identity and version on upload failure so retry updates instead of duplicating', async () => {
    vi.spyOn(masterDataApi, 'create').mockResolvedValue({ data: record });
    const upload = vi
      .spyOn(masterDataApi, 'uploadLogo')
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce({
        data: {
          ...record,
          version: 3,
          attributes: { logoFileReference: 'image' },
        },
      });
    vi.spyOn(masterDataApi, 'update').mockResolvedValue({
      data: { ...record, version: 2 },
    });
    const onSaved = vi.fn();
    const input = {
      resource: 'suppliers' as const,
      values: { name: record.name },
      title: record.name,
      logoChange: {
        kind: 'replace' as const,
        file: new File(['png'], 'logo.png', { type: 'image/png' }),
      },
    };
    await expect(persistSupplierProfile(input, onSaved)).rejects.toThrow(
      'upload failed',
    );
    expect(onSaved).toHaveBeenCalledWith(record);
    const result = await persistSupplierProfile(
      { ...input, existing: onSaved.mock.calls[0]![0] },
      onSaved,
    );
    expect(masterDataApi.create).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenLastCalledWith(
      expect.objectContaining({ recordId: record.id, version: 2 }),
    );
    expect(result.data.attributes.logoFileReference).toBe('image');
  });
  it('retains an old logo and surfaces failed replacement', async () => {
    const old = { ...record, attributes: { logoFileReference: 'old' } };
    vi.spyOn(masterDataApi, 'persistWithLogo').mockResolvedValue({
      data: { ...old, version: 2 },
      warning: 'failed replacement',
    });
    await expect(
      persistSupplierProfile(
        {
          resource: 'suppliers',
          existing: old,
          values: {},
          title: old.name,
          logoChange: {
            kind: 'replace',
            file: new File(['png'], 'logo.png', { type: 'image/png' }),
          },
        },
        vi.fn(),
      ),
    ).rejects.toThrow('failed replacement');
  });
  it('accepts the attached logo while preserving an old-archive warning', async () => {
    vi.spyOn(masterDataApi, 'persistWithLogo').mockResolvedValue({
      data: { ...record, attributes: { logoFileReference: 'new' } },
      warning: 'archive needs retry',
    });
    await expect(
      persistSupplierProfile(
        {
          resource: 'suppliers',
          values: {},
          title: record.name,
          logoChange: {
            kind: 'replace',
            file: new File(['png'], 'logo.png', { type: 'image/png' }),
          },
        },
        vi.fn(),
      ),
    ).resolves.toMatchObject({ warning: 'archive needs retry' });
  });
});
