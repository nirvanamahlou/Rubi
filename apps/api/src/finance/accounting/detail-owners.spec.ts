import { describe, expect, it, vi } from 'vitest';
import { detailOwnerKind, financeCodingProfiles } from '@nora/contracts';
import { resolveDetailOwner, saveDetailOwner } from './detail-owners';

const book = {
  id: 'a6b56f40-494c-400e-b30f-09ec5caf46f7',
  branchId: 'b5fd4212-950f-4183-ab1b-a46c8f668440',
  baseCurrency: 'IRR',
};

describe('personnel detail references', () => {
  it.each([
    {
      staffKind: 'person',
      firstName: 'Synthetic',
      lastName: 'Person',
      position: 'Finance',
      title: 'Synthetic Person',
    },
    {
      staffKind: 'site',
      firstName: 'Synthetic Site',
      lastName: '',
      position: 'سایت',
      title: 'Synthetic Site',
    },
  ])('saves and resolves a $staffKind in the selected book', async (input) => {
    const create = vi.fn();
    const database = {
      accountingConfiguration: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
        findMany: vi.fn(async () => [
          {
            ...create.mock.calls[0]![0].data,
            version: 1,
          },
        ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const tx = database as unknown as Parameters<typeof saveDetailOwner>[0];
    const row = await saveDetailOwner(
      tx,
      book,
      {
        ownerKind: 'STAFF',
        code: '00007',
        title: 'Untrusted',
        attributes: {
          ...input,
          ...(input.staffKind === 'site'
            ? { position: 'Untrusted', lastName: 'Ignored' }
            : {}),
        },
      },
      undefined,
      'unused',
    );
    expect(row).toMatchObject({
      title: input.title,
      code: '00007',
      configurationId: row.id,
      attributes: {
        staffKind: input.staffKind,
        firstName: input.firstName,
        lastName: input.lastName,
        position: input.position,
      },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookId: book.id,
          kind: 'detail-owner-staff',
        }),
      }),
    );
    const profile = financeCodingProfiles[0];
    expect(detailOwnerKind('پرسنل')).toBeUndefined();
    await expect(
      resolveDetailOwner(
        tx,
        book,
        {
          title: profile.title,
          code: profile.typeCode,
        },
        { sourceConfigurationId: row.id },
        null,
      ),
    ).resolves.toEqual(row);
    expect(database.accountingConfiguration.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { bookId: book.id, kind: 'detail-owner-staff', id: row.id },
      }),
    );
  });
});
