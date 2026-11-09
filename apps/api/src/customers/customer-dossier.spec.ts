import { describe, it, expect, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  dossierSalesScope,
  readSalesCustomerDossier,
} from '../sales/customer-dossier.public';
import { readAffairsCustomerDossier } from '../customer-affairs/customer-dossier.public';
import { readReservationCustomerDossier } from '../reservations/customer-dossier.public';
import { CustomerDossierService } from './customer-dossier.service';
const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [
    'customers.read',
    'sales.contracts.read.own',
    'sales.payments.read',
    'finance.read',
    'reservations.read',
    'customer_affairs.lead.read',
    'customer_affairs.ticket.read',
  ],
};
function database() {
  return {
    salesContract: { findMany: vi.fn().mockResolvedValue([]) },
    salesContractService: { findMany: vi.fn().mockResolvedValue([]) },
    salesContractPaymentEntry: { findMany: vi.fn().mockResolvedValue([]) },
    customerAffairsLead: { findMany: vi.fn().mockResolvedValue([]) },
    customerAffairsTicket: { findMany: vi.fn().mockResolvedValue([]) },
    reservationTicketDocument: { findMany: vi.fn().mockResolvedValue([]) },
    reservationInsurancePolicy: { findMany: vi.fn().mockResolvedValue([]) },
    reservationIntake: { findMany: vi.fn().mockResolvedValue([]) },
  };
}
describe('customer dossier authorization', () => {
  it('requires contract read authority and preserves company, archive, branch and own scope', () => {
    expect(
      dossierSalesScope(
        { ...actor, permissions: ['customers.read'] },
        'customer',
        { legalEntityId: 'company' },
      ),
    ).toBeNull();
    const scope = dossierSalesScope(actor, 'customer', {
      legalEntityId: 'company',
      hiddenAt: null,
    });
    expect(scope).toMatchObject({
      AND: expect.arrayContaining([
        { legalEntityId: 'company', hiddenAt: null },
        { branchId: { in: ['branch'] } },
        { ownerUserId: 'user' },
        {
          OR: [
            { customerId: 'customer' },
            { payerCustomerId: 'customer' },
            { passengers: { some: { customerId: 'customer' } } },
          ],
        },
      ]),
    });
  });
  it('does not query denied sources or expose counts', async () => {
    const db = database();
    const denied = {
      ...actor,
      permissions: ['customers.read'] as AuthenticatedActor['permissions'],
    };
    const sections = [
      ...(await readSalesCustomerDossier(
        db as never,
        denied,
        'customer',
        null,
      )),
      ...(await readAffairsCustomerDossier(db as never, denied, 'customer')),
      ...(await readReservationCustomerDossier(
        db as never,
        denied,
        'customer',
        null,
      )),
    ];
    expect(sections).toHaveLength(9);
    expect(
      sections.every(
        (s) => s.state === 'forbidden' && !s.rows.length && !s.hasMore,
      ),
    ).toBe(true);
    for (const table of Object.values(db))
      expect(table.findMany).not.toHaveBeenCalled();
  });
  it('keeps finance restricted to the actual buyer or payer, not fellow passengers', async () => {
    const db = database();
    await readSalesCustomerDossier(db as never, actor, 'customer', {
      hiddenAt: null,
    });
    expect(db.salesContractPaymentEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contract: {
            AND: [
              { hiddenAt: null },
              {
                OR: [
                  { customerId: 'customer' },
                  { payerCustomerId: 'customer' },
                ],
              },
            ],
          },
        }),
      }),
    );
    const select =
      db.salesContractPaymentEntry.findMany.mock.calls[0]![0].select;
    expect(select).not.toHaveProperty('checkSecureIdentifier');
    expect(select).not.toHaveProperty('paymentReference');
  });
  it('filters exact customer and branches and excludes internal workbench tickets', async () => {
    const db = database();
    await readAffairsCustomerDossier(db as never, actor, 'customer');
    expect(db.customerAffairsLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 'customer', branchId: { in: ['branch'] } },
      }),
    );
    expect(db.customerAffairsTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'customer',
          NOT: [
            { category: 'CALL_CENTER_REQUEST' },
            { category: { startsWith: 'WORKBENCH_' } },
          ],
        }),
      }),
    );
  });
  it('requires exact passenger identity for insurance and tickets', async () => {
    const db = database();
    await readReservationCustomerDossier(db as never, actor, 'customer', [
      'contract',
    ]);
    for (const table of [
      db.reservationTicketDocument,
      db.reservationInsurancePolicy,
    ])
      expect(table.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customerId: 'customer',
            intake: {
              branchId: { in: ['branch'] },
              contractId: { in: ['contract'] },
            },
          },
        }),
      );
  });
  it('does not fabricate issued vouchers from hotel bookings', async () => {
    const db = database();
    db.reservationIntake.findMany.mockResolvedValue([
      {
        id: 'one',
        receivedAt: new Date(),
        workflowRevisions: [{ state: { voucherIssued: false } }],
      },
    ] as never);
    const sections = await readReservationCustomerDossier(
      db as never,
      actor,
      'customer',
      ['contract'],
    );
    expect(sections.find((s) => s.id === 'vouchers')?.rows).toEqual([]);
  });
  it('returns unavailable instead of incomplete reservation history on bounded overflow', async () => {
    const db = database();
    const sections = await readReservationCustomerDossier(
      db as never,
      actor,
      'customer',
      Array.from({ length: 1001 }, (_, i) => String(i)),
    );
    expect(sections.every((s) => s.state === 'unavailable')).toBe(true);
    expect(db.reservationIntake.findMany).not.toHaveBeenCalled();
  });
  it('rejects foreign or nonexistent customers before querying any other source', async () => {
    const db = database();
    const customers = { find: vi.fn().mockResolvedValue(null) };
    const company = { where: vi.fn() };
    const service = new CustomerDossierService(
      { client: db } as never,
      customers as never,
      company as never,
    );
    await expect(service.read('foreign', actor)).rejects.toThrow();
    expect(customers.find).toHaveBeenCalledWith('foreign', ['branch']);
    expect(company.where).not.toHaveBeenCalled();
  });
  it('isolates an owner failure without presenting it as an empty successful section', async () => {
    const db = database();
    db.customerAffairsLead.findMany.mockRejectedValue(
      new Error('private database detail'),
    );
    const service = new CustomerDossierService(
      { client: db } as never,
      { find: async () => ({ id: 'customer' }) } as never,
      { where: async () => ({ hiddenAt: null }) } as never,
    );
    const result = await service.read('customer', actor);
    expect(result.data.sections).toHaveLength(9);
    expect(result.data.sections.find((s) => s.id === 'requests')?.state).toBe(
      'unavailable',
    );
    expect(JSON.stringify(result)).not.toContain('private database detail');
  });
});
