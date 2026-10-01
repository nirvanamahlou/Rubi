import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { MasterDataService } from './master-data.service';
import type { MasterDataRepository } from './master-data.repository';
import type { MasterDataContactCrypto } from './master-data-contact.crypto';
const broker = '11111111-1111-4111-8111-111111111111',
  branch = '22222222-2222-4222-8222-222222222222';
const actor = {
  userId: broker,
  branchIds: [branch],
  permissions: ['reservations.documents.manage'],
} as unknown as AuthenticatedActor;
const row = (id: string, attributes: Record<string, unknown> = {}) => ({
  id,
  code: 'LEADER',
  name: 'Synthetic leader',
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...attributes,
});
function fixture() {
  const find = vi
    .fn()
    .mockResolvedValue(
      row('leader', {
        brokerId: broker,
        englishName: 'Saved leader',
        welcomeSignCode: 'SYNTHETIC BOARD',
        languages: ['English'],
        primaryPhoneEncrypted: 'phone',
      }),
    );
  const list = vi
    .fn()
    .mockResolvedValue({
      rows: [row('linked', { brokerId: broker }), row('unlinked')],
      total: 2,
    });
  const recordVoucherLeaderRead = vi.fn();
  const decrypt = vi
    .fn()
    .mockImplementation((_kind, field) =>
      field.encrypted ? '+905550000000' : null,
    );
  const service = new MasterDataService(
    { find, list, recordVoucherLeaderRead } as unknown as MasterDataRepository,
    { decrypt } as unknown as MasterDataContactCrypto,
  );
  return { service, find, list, recordVoucherLeaderRead, decrypt };
}
describe('purpose-bound voucher leader projection', () => {
  it('lists only leaders explicitly linked to the selected broker without disclosing contacts', async () => {
    const { service, list } = fixture();
    const result = await service.voucherLeaderChoices(broker);
    expect(result.data).toEqual([{ id: 'linked', name: 'Synthetic leader' }]);
    expect(list.mock.calls[0]?.[1]).toMatchObject({ status: 'active' });
  });
  it('rejects wrong broker and branch before decrypting or auditing a disclosure', async () => {
    const { service, decrypt, recordVoucherLeaderRead } = fixture();
    await expect(
      service.voucherLeaderReference('leader', 'other', actor, branch),
    ).rejects.toThrow('متصل');
    await expect(
      service.voucherLeaderReference('leader', broker, actor, 'other'),
    ).rejects.toThrow();
    await expect(
      service.voucherLeaderReference(
        'leader',
        broker,
        { ...actor, permissions: [] },
        branch,
      ),
    ).rejects.toThrow();
    expect(decrypt).not.toHaveBeenCalled();
    expect(recordVoucherLeaderRead).not.toHaveBeenCalled();
  });
  it('returns stored name, decrypted phone and board and audits identifiers only', async () => {
    const { service, recordVoucherLeaderRead } = fixture();
    await expect(
      service.voucherLeaderReference('leader', broker, actor, branch),
    ).resolves.toMatchObject({
      name: 'Saved leader',
      phone: '+905550000000',
      board: 'SYNTHETIC BOARD',
    });
    expect(recordVoucherLeaderRead).toHaveBeenCalledWith({
      leaderId: 'leader',
      actorUserId: actor.userId,
      actorBranchId: branch,
    });
    expect(JSON.stringify(recordVoucherLeaderRead.mock.calls)).not.toContain(
      '+90555',
    );
  });
});
