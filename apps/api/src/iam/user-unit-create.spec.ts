import { describe, expect, it, vi } from 'vitest';
import { IamService } from './iam.service';
vi.mock('argon2', () => ({
  hash: vi.fn(async () => 'synthetic-hash'),
  verify: vi.fn(),
}));

function setup() {
  const client = {
    $queryRaw: vi.fn(async () => []),
    user: {
      findUnique: vi.fn(async () => ({
        status: 'ACTIVE',
        branches: [{ branchId: 'branch' }],
        roles: [
          {
            role: {
              isActive: true,
              code: 'staff',
              permissions: [{ permission: { code: 'iam.users.manage' } }],
            },
          },
        ],
      })),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'new-user' })),
    },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (callback) => callback(client));
  const service = Object.create(IamService.prototype);
  service.database = { client };
  service.managedAccess = vi.fn(async () => null);
  service.assertRolesAssignable = vi.fn();
  service.audit = vi.fn();
  service.units = { assertAssignable: vi.fn() };
  const dto = {
    username: 'synthetic',
    displayName: 'Synthetic User',
    password: '12345678',
    roleIds: [],
    branchIds: ['branch'],
    organizationUnitId: 'unit',
  };
  return { service, client, dto };
}
describe('create user with HR unit', () => {
  it('rechecks live operator status before linking a unit', async () => {
    const { service, client, dto } = setup();
    client.user.findUnique.mockResolvedValue({
      status: 'INACTIVE',
      branches: [],
      roles: [],
    });
    await expect(
      service.createUser(dto, { userId: 'operator' }, {}),
    ).rejects.toMatchObject({ status: 403 });
    expect(service.units.assertAssignable).not.toHaveBeenCalled();
    expect(client.user.create).not.toHaveBeenCalled();
  });
  it('resolves and stores the unit in the same creation transaction', async () => {
    const { service, client, dto } = setup();
    await service.createUser(dto, { userId: 'operator' }, {});
    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(service.units.assertAssignable).toHaveBeenCalledWith(
      client,
      'unit',
      expect.objectContaining({ userId: 'operator', branchIds: ['branch'] }),
      ['branch'],
    );
    expect(client.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profile: { create: { organizationUnitId: 'unit' } },
          roles: { create: [] },
        }),
      }),
    );
  });
  it('does not create the account if the selected unit is invalid', async () => {
    const { service, client, dto } = setup();
    service.units.assertAssignable.mockRejectedValue(new Error('invalid unit'));
    await expect(
      service.createUser(dto, { userId: 'operator' }, {}),
    ).rejects.toThrow('invalid unit');
    expect(client.user.create).not.toHaveBeenCalled();
    expect(service.audit).not.toHaveBeenCalled();
  });
  it('keeps the old creation contract valid without a selected unit', async () => {
    const { service, client, dto } = setup();
    await service.createUser(
      { ...dto, organizationUnitId: undefined },
      { userId: 'operator' },
      {},
    );
    expect(service.units.assertAssignable).not.toHaveBeenCalled();
    expect(client.user.create.mock.calls[0]?.[0]).not.toHaveProperty(
      'data.profile',
    );
  });
});
