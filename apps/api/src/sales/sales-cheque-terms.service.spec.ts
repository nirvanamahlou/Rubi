import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesContractDetail,
  SalesContractCreateRequest,
  SalesPaymentTerms,
} from '@nora/contracts';
import { SalesService } from './sales.service';
import type { SalesRepository } from './sales.repository';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';

const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: [
    'sales.contracts.read.own',
    'sales.contracts.update.own',
    'sales.payments.create',
  ],
} as unknown as AuthenticatedActor;
function setup(terms: SalesPaymentTerms | null) {
  const repository = {
    findById: vi.fn().mockResolvedValue({
      id: 'contract',
      branchId: 'branch',
      ownerUserId: 'owner',
      paymentTerms: terms,
    }),
    addPayment: vi.fn().mockResolvedValue('created'),
    updateDraft: vi.fn(),
  };
  const service = new SalesService(
    repository as unknown as SalesRepository,
    {} as SalesCustomersPublicAdapter,
    {} as SalesTicketAvailabilityPort,
  );
  vi.spyOn(service, 'detail').mockResolvedValue({
    data: {} as SalesContractDetail,
  });
  return { service, repository };
}
const payment = {
  version: 1,
  method: 'CHECK' as const,
  amount: '100',
  currencyCode: 'USD',
  dueAt: '2026-11-01T00:00:00Z',
  check: {
    bankId: '10000000-0000-4000-8000-000000000005',
    secureIdentifier: 'synthetic',
    ownerName: 'Test',
    dueDate: '2026-11-01',
  },
};
describe('persisted sale payment policy', () => {
  it('prevents removing saved terms through the draft-update endpoint', async () => {
    const { service, repository } = setup({
      version: 1,
      mode: 'CHECK',
      plans: [],
    });
    await expect(
      service.update(
        'contract',
        {
          version: 1,
          paymentTerms: null,
        } as unknown as SalesContractCreateRequest & { version: number },
        actor,
      ),
    ).rejects.toThrow('قابل حذف');
    expect(repository.updateDraft).not.toHaveBeenCalled();
  });
  it('rejects new cheque payments on recorded cash sales before persistence', async () => {
    const { service, repository } = setup({
      version: 1,
      mode: 'CASH',
      plans: [],
    });
    await expect(
      service.addPayment('contract', payment, actor, 'synthetic-key'),
    ).rejects.toThrow('فروش نقدی');
    expect(repository.addPayment).not.toHaveBeenCalled();
  });
  it('preserves cheque-payment support for legacy contracts without stored terms', async () => {
    const { service, repository } = setup(null);
    await expect(
      service.addPayment('contract', payment, actor, 'synthetic-key'),
    ).resolves.toHaveProperty('meta.idempotentReplay', false);
    expect(repository.addPayment).toHaveBeenCalledOnce();
  });
});
