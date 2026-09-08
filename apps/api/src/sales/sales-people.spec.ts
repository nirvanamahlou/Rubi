import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';
import type { CustomerService } from '../customers/customer.service';
import { SalesCustomersPublicAdapter } from './sales.adapters';

const actor = { userId: 'actor' } as AuthenticatedActor;
const person = {
  id: 'person',
  displayName: 'Synthetic',
  status: 'active',
  kind: 'person',
  roles: ['passenger'],
};
const setup = (data = person) => {
  const maskedDetail = vi.fn().mockResolvedValue({ data });
  return {
    maskedDetail,
    adapter: new SalesCustomersPublicAdapter({
      maskedDetail,
    } as unknown as CustomerService),
  };
};
describe('Sales buyer and passenger public validation', () => {
  it('accepts a legal buyer without treating the buyer as a passenger', async () => {
    const { adapter } = setup({
      ...person,
      kind: 'organization',
      roles: ['customer'],
    });
    await expect(adapter.resolveSnapshot('person', actor)).resolves.toEqual({
      id: 'person',
      displayName: 'Synthetic',
    });
    await expect(
      adapter.assertPassengers([{ customerId: 'person' }], actor),
    ).rejects.toThrow('هر مسافر');
  });
  it.each([
    { status: 'inactive' },
    { kind: 'organization' },
    { roles: ['customer'] },
  ])('rejects an invalid passenger %j', async (patch) => {
    const { adapter } = setup({ ...person, ...patch });
    await expect(
      adapter.assertPassengers([{ customerId: 'person' }], actor),
    ).rejects.toThrow('هر مسافر');
  });
  it('checks every passenger through the masked public API using the authenticated actor', async () => {
    const { adapter, maskedDetail } = setup();
    await adapter.assertPassengers(
      [{ customerId: 'first' }, { customerId: 'second' }],
      actor,
    );
    expect(maskedDetail).toHaveBeenNthCalledWith(1, 'first', actor);
    expect(maskedDetail).toHaveBeenNthCalledWith(2, 'second', actor);
  });
  it('propagates branch/permission failures and rejects inactive buyers', async () => {
    const { adapter, maskedDetail } = setup();
    maskedDetail.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(
      adapter.assertPassengers([{ customerId: 'person' }], actor),
    ).rejects.toThrow('Forbidden');
    await expect(
      setup({ ...person, status: 'inactive' }).adapter.resolveSnapshot(
        'person',
        actor,
      ),
    ).rejects.toThrow('غیرفعال');
  });
});
