import { describe, expect, it, vi } from 'vitest';
import type { DatabaseClient } from '../src/client';
import {
  repairPackagePricingAccess,
  TOUR_PRICING_REPAIR_GRANTS,
} from '../src/package-pricing-access-repair';
import { PERMISSION_SEED_DATA } from '../src/permission-seed-data';

const userId = '00000000-0000-4000-8000-000000000091';
const input = {
  userId,
  roleCode: 'synthetic_pricing_operator',
  reason: 'Owner-approved local pricing repair',
};

function fixture() {
  const codes = new Set<string>();
  const grants = new Set<string>(['ticket_catalog.read']);
  const audits: unknown[] = [];
  const role = {
    id: 'role-test',
    isActive: true,
    isSystem: false,
    users: [{ userId }],
  };
  const user = { status: 'ACTIVE' };
  let auditFailure = false;
  const tx = {
    user: { findUnique: vi.fn(async () => user) },
    role: {
      findUnique: vi.fn(async () => ({
        ...role,
        permissions: [...grants].map((code) => ({ permission: { code } })),
      })),
    },
    permission: {
      findMany: vi.fn(async () => [...codes].map((code) => ({ code }))),
      upsert: vi.fn(async ({ create }: { create: { code: string } }) => {
        codes.add(create.code);
      }),
      findUniqueOrThrow: vi.fn(
        async ({ where }: { where: { code: string } }) => ({ id: where.code }),
      ),
    },
    rolePermission: {
      upsert: vi.fn(
        async ({ create }: { create: { permissionId: string } }) => {
          grants.add(create.permissionId);
        },
      ),
    },
    auditEvent: {
      create: vi.fn(async (entry: unknown) => {
        if (auditFailure) throw new Error('Audit failed');
        audits.push(entry);
      }),
    },
  };
  const transaction = vi.fn(
    async (callback: (value: typeof tx) => Promise<unknown>) => {
      const oldCodes = [...codes];
      const oldGrants = [...grants];
      try {
        return await callback(tx);
      } catch (error) {
        codes.clear();
        oldCodes.forEach((code) => codes.add(code));
        grants.clear();
        oldGrants.forEach((code) => grants.add(code));
        throw error;
      }
    },
  );
  return {
    database: { $transaction: transaction } as unknown as DatabaseClient,
    codes,
    grants,
    audits,
    role,
    user,
    tx,
    transaction,
    failAudit: () => {
      auditFailure = true;
    },
  };
}

describe('bounded package pricing access repair', () => {
  it('previews missing catalog and grants without any writes', async () => {
    const f = fixture();
    const result = await repairPackagePricingAccess(f.database, input);
    expect(result.applied).toBe(false);
    expect(result.catalogAdded).toEqual(
      PERMISSION_SEED_DATA.filter(([code]) =>
        code.startsWith('package_pricing.'),
      ).map(([code]) => code),
    );
    expect(result.grantsAdded).toEqual(TOUR_PRICING_REPAIR_GRANTS);
    expect(f.codes.size).toBe(0);
    expect([...f.grants]).toEqual(['ticket_catalog.read']);
    expect(f.tx.permission.upsert).not.toHaveBeenCalled();
    expect(f.audits).toEqual([]);
  });

  it('adds only four approved grants atomically and records one audit', async () => {
    const f = fixture();
    await repairPackagePricingAccess(f.database, { ...input, apply: true });
    expect([...f.grants]).toEqual([
      'ticket_catalog.read',
      ...TOUR_PRICING_REPAIR_GRANTS,
    ]);
    expect(f.grants.has('package_pricing.publish')).toBe(false);
    expect(f.grants.has('finance.receipt.approve')).toBe(false);
    expect(f.audits).toHaveLength(1);
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(f.tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: userId,
          entityId: 'role-test',
          outcome: 'SUCCESS',
        }),
      }),
    );
  });

  it('is idempotent and preserves all existing permissions and role membership', async () => {
    const f = fixture();
    f.grants.add('customers.read');
    await repairPackagePricingAccess(f.database, { ...input, apply: true });
    const result = await repairPackagePricingAccess(f.database, {
      ...input,
      apply: true,
    });
    expect(result.catalogAdded).toEqual([]);
    expect(result.grantsAdded).toEqual([]);
    expect(f.grants.has('customers.read')).toBe(true);
    expect(f.audits).toHaveLength(1);
    expect(f.role.users).toEqual([{ userId }]);
  });

  it.each([
    'inactive user',
    'inactive role',
    'system role',
    'shared role',
    'wrong user',
  ])('rejects %s before writing', async (scenario) => {
    const f = fixture();
    if (scenario === 'inactive user') f.user.status = 'DISABLED';
    if (scenario === 'inactive role') f.role.isActive = false;
    if (scenario === 'system role') f.role.isSystem = true;
    if (scenario === 'shared role')
      f.role.users.push({ userId: 'another-user' });
    if (scenario === 'wrong user') f.role.users = [{ userId: 'another-user' }];
    await expect(
      repairPackagePricingAccess(f.database, { ...input, apply: true }),
    ).rejects.toThrow('exclusively assigned');
    expect(f.tx.permission.upsert).not.toHaveBeenCalled();
    expect(f.audits).toEqual([]);
  });

  it('does not leave partial grants when auditing fails', async () => {
    const f = fixture();
    f.failAudit();
    await expect(
      repairPackagePricingAccess(f.database, { ...input, apply: true }),
    ).rejects.toThrow('Audit failed');
    expect(f.codes.size).toBe(0);
    expect([...f.grants]).toEqual(['ticket_catalog.read']);
  });

  it.each(['', '   ', 'x'.repeat(121)])(
    'rejects invalid reason before opening a transaction',
    async (reason) => {
      const f = fixture();
      await expect(
        repairPackagePricingAccess(f.database, { ...input, reason }),
      ).rejects.toThrow('Invalid repair');
      expect(f.transaction).not.toHaveBeenCalled();
    },
  );
});
