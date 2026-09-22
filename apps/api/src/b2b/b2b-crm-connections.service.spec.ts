import type {
  AuthenticatedActor,
  CustomerSummary,
  FinancePartyExposurePortV1,
  SalesContractDetail,
  SalesContractSummary,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CustomerService } from '../customers/customer.service';
import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { ReservationsPublicService } from '../reservations/reservations-public.service';
import type { SalesService } from '../sales/sales.service';
import { B2bCrmConnectionsService } from './b2b-crm-connections.service';

const organizationId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedActor = {
  userId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  branchIds: [branchId],
  permissions: [
    'b2b.agency.read',
    'b2b.credit.read',
    'customers.read',
    'sales.contracts.read.branch',
    'sales.payments.read',
    'reservations.read',
  ],
};

function customer(id: string, linkedOrganizationId: string): CustomerSummary {
  return {
    id,
    organizationId: linkedOrganizationId,
    displayName: 'سازمان هم‌نام',
    status: 'active',
  } as CustomerSummary;
}

function contract(id: string, customerId: string): SalesContractSummary {
  return {
    id,
    contractNumber: `SC-${id}`,
    customerId,
    customerNameSnapshot: 'سازمان هم‌نام',
    status: 'CONFIRMED',
    settlementStatus: 'PARTIALLY_SETTLED',
    reservationStatus: 'ACCEPTED',
    balances: [
      {
        amount: '120',
        currencyCode: 'USD',
        confirmedPaid: '20',
        pendingFinance: '0',
        outstanding: '100',
      },
    ],
    updatedAt: '2026-09-11T00:00:00.000Z',
  } as unknown as SalesContractSummary;
}

function setup() {
  const exactCustomer = customer('customer-exact', organizationId);
  const otherCustomer = customer(
    'customer-same-name',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  );
  const exactContract = contract('contract-exact', exactCustomer.id);
  const wrongContract = contract('contract-wrong', otherCustomer.id);
  const customers = {
    list: vi.fn().mockResolvedValue({
      data: [otherCustomer, exactCustomer],
      meta: { total: 2 },
    }),
  };
  const sales = {
    list: vi.fn().mockResolvedValue({
      data: [wrongContract, exactContract],
      meta: { total: 2 },
    }),
    detail: vi.fn().mockResolvedValue({
      data: {
        ...exactContract,
        payments: [
          {
            id: 'payment-1',
            amount: '20',
            currencyCode: 'USD',
            dueAt: '2026-09-05',
            method: 'BANK_TRANSFER',
            description: 'دریافت',
            paymentReference: 'BANK-1',
            check: null,
            status: 'FINANCE_CONFIRMED',
            createdAt: '2026-09-05T08:00:00.000Z',
          },
        ],
      } as unknown as SalesContractDetail,
    }),
  };
  const reservations = {
    list: vi.fn().mockResolvedValue([
      {
        id: 'reservation-wrong',
        contractId: wrongContract.id,
        status: 'QUEUED',
        receivedAt: '2026-09-10T00:00:00.000Z',
        workflow: null,
        snapshot: {
          contractNumber: wrongContract.contractNumber,
          passengerIds: ['p-1'],
          serviceSelections: [{ kind: 'HOTEL' }],
        },
      },
      {
        id: 'reservation-exact',
        contractId: exactContract.id,
        status: 'QUEUED',
        receivedAt: '2026-09-11T00:00:00.000Z',
        workflow: { supplierStatus: 'REQUESTED', voucherIssued: false },
        snapshot: {
          contractNumber: exactContract.contractNumber,
          passengerIds: ['p-1', 'p-2'],
          serviceSelections: [{ kind: 'FLIGHT' }, { kind: 'HOTEL' }],
        },
      },
    ]),
  };
  const organizations = {
    agencyReference: vi.fn().mockResolvedValue({ id: organizationId }),
    cooperationReference: vi.fn(),
  };
  const finance = {
    getPartyExposure: vi.fn().mockResolvedValue({
      status: 'UNAVAILABLE',
      reason: 'FINANCE_PORT_UNAVAILABLE',
    }),
  };
  const service = new B2bCrmConnectionsService(
    customers as unknown as CustomerService,
    sales as unknown as SalesService,
    reservations as unknown as ReservationsPublicService,
    organizations as unknown as MasterOrganizationDirectory,
    finance as unknown as FinancePartyExposurePortV1,
  );
  return {
    service,
    customers,
    sales,
    reservations,
    organizations,
    finance,
  };
}

describe('B2B CRM backend connection query', () => {
  it('joins owner services by exact IDs and returns a least-privilege projection', async () => {
    const fixture = setup();
    const result = await fixture.service.get(organizationId, actor, branchId);

    expect(result.version).toBe(1);
    expect(result.organizationId).toBe(organizationId);
    expect(result.customers.map((row) => row.id)).toEqual(['customer-exact']);
    expect(result.contracts.map((row) => row.id)).toEqual(['contract-exact']);
    expect(result.payments.map((row) => row.id)).toEqual(['payment-1']);
    expect(result.reservations).toEqual([
      expect.objectContaining({
        id: 'reservation-exact',
        contractId: 'contract-exact',
        passengerCount: 2,
        status: 'WAITING_SUPPLIER',
      }),
    ]);
    expect(fixture.sales.list).toHaveBeenCalledWith(
      expect.objectContaining({ branchId }),
      actor,
    );
    expect(fixture.reservations.list).toHaveBeenCalledWith([branchId], {
      page: '1',
    });
    expect(result.unavailableSources.FINANCE).toContain('دفترکل مالی');
    expect(result.contracts[0]).not.toHaveProperty('passengerNames');
  });

  it('does not call dependent services without customer permission', async () => {
    const fixture = setup();
    const result = await fixture.service.get(
      organizationId,
      { ...actor, permissions: ['b2b.agency.read'] },
      branchId,
    );

    expect(fixture.customers.list).not.toHaveBeenCalled();
    expect(fixture.sales.list).not.toHaveBeenCalled();
    expect(fixture.reservations.list).not.toHaveBeenCalled();
    expect(result.unavailableSources).toMatchObject({
      CUSTOMERS: expect.any(String),
      SALES: expect.any(String),
      SALES_PAYMENTS: expect.any(String),
      RESERVATIONS: expect.any(String),
      FINANCE: expect.any(String),
    });
  });

  it('rejects an unauthorized branch before reading an owner service', async () => {
    const fixture = setup();
    await expect(
      fixture.service.get(
        organizationId,
        actor,
        '99999999-9999-4999-8999-999999999999',
      ),
    ).rejects.toThrow('شعبه انتخاب‌شده');
    expect(fixture.organizations.agencyReference).not.toHaveBeenCalled();
    expect(fixture.customers.list).not.toHaveBeenCalled();
  });

  it('keeps successful customer data when the sales owner is unavailable', async () => {
    const fixture = setup();
    fixture.sales.list.mockRejectedValue(new Error('database details'));
    const result = await fixture.service.get(organizationId, actor, branchId);

    expect(result.customers).toHaveLength(1);
    expect(result.contracts).toEqual([]);
    expect(result.unavailableSources.SALES).toContain('سرویس مالک');
    expect(result.unavailableSources.SALES).not.toContain('database details');
    expect(fixture.reservations.list).not.toHaveBeenCalled();
  });
});
