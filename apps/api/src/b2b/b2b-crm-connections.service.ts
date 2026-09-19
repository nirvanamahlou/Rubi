import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  B2bCrmConnectionsV1,
  B2bCrmReservationV1,
  B2bCrmSalesContractV1,
  B2bCrmSalesPaymentV1,
  CustomerSummary,
  B2bFinanceExposureV1,
  FinancePartyExposurePortV1,
  IamPermissionCode,
  SalesContractDetail,
  SalesContractSummary,
} from '@nora/contracts';

import { CustomerService } from '../customers/customer.service';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import { SalesService } from '../sales/sales.service';
import { FINANCE_PARTY_EXPOSURE_PORT } from './finance-exposure.port';

const pageSize = 100;
const maxPages = 100;
const salesReadPermissions = [
  'sales.contracts.read.own',
  'sales.contracts.read.branch',
  'sales.contracts.read.all',
] satisfies readonly IamPermissionCode[];

function branchOf(actor: AuthenticatedActor, requested?: string) {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه انتخاب‌شده در دامنه دسترسی کاربر نیست.');
  return branchId;
}

function hasAny(
  actor: AuthenticatedActor,
  permissions: readonly IamPermissionCode[],
) {
  return permissions.some((permission) =>
    actor.permissions.includes(permission),
  );
}

async function limitedMap<T, R>(
  rows: readonly T[],
  concurrency: number,
  task: (row: T) => Promise<R>,
) {
  const result: R[] = [];
  for (let index = 0; index < rows.length; index += concurrency)
    result.push(
      ...(await Promise.all(rows.slice(index, index + concurrency).map(task))),
    );
  return result;
}

function presentContract(row: SalesContractSummary): B2bCrmSalesContractV1 {
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    customerId: row.customerId,
    customerNameSnapshot: row.customerNameSnapshot,
    status: row.status,
    settlementStatus: row.settlementStatus,
    reservationStatus: row.reservationStatus,
    balances: row.balances,
    updatedAt: row.updatedAt,
  };
}

function presentPayments(row: SalesContractDetail): B2bCrmSalesPaymentV1[] {
  return row.payments.map((payment) => ({
    id: payment.id,
    contractId: row.id,
    contractNumber: row.contractNumber,
    amount: payment.amount,
    currencyCode: payment.currencyCode,
    dueAt: payment.dueAt,
    method: payment.method,
    description: payment.description ?? null,
    paymentReference: payment.paymentReference ?? null,
    check: payment.check
      ? {
          secureIdentifier: payment.check.secureIdentifier,
          ownerName: payment.check.ownerName,
          dueDate: payment.check.dueDate,
        }
      : null,
    status: payment.status,
    createdAt: payment.createdAt,
  }));
}

function reservationStatus(row: {
  workflow: unknown;
  status: string;
}): B2bCrmReservationV1['status'] {
  const workflow = row.workflow as {
    supplierStatus?: string;
    voucherIssued?: boolean;
  } | null;
  if (workflow?.supplierStatus === 'CANCELLED') return 'CANCELLED';
  if (workflow?.voucherIssued) return 'VOUCHER_ISSUED';
  if (workflow?.supplierStatus === 'CONFIRMED') return 'SUPPLIER_CONFIRMED';
  if (workflow?.supplierStatus === 'REQUESTED') return 'WAITING_SUPPLIER';
  return 'NEW';
}

@Injectable()
export class B2bCrmConnectionsService {
  constructor(
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
    @Inject(MasterOrganizationDirectory)
    private readonly organizations: MasterOrganizationDirectory,
    @Inject(FINANCE_PARTY_EXPOSURE_PORT)
    private readonly financeExposure: FinancePartyExposurePortV1,
  ) {}

  private async assertOrganization(organizationId: string) {
    const agency = await this.organizations.agencyReference(organizationId);
    const organization =
      agency ??
      (await this.organizations.cooperationReference(
        organizationId,
        'CORPORATE_CUSTOMER',
      ));
    if (!organization)
      throw new NotFoundException('آژانس یا مشتری سازمانی یافت نشد.');
  }

  private async allCustomers(actor: AuthenticatedActor, branchId: string) {
    const result: CustomerSummary[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await this.customers.list(
        {
          search: '',
          kind: 'organization',
          status: 'all',
          role: 'customer',
          branchId,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
          page,
          pageSize,
        },
        actor,
      );
      result.push(...response.data);
      if (
        result.length >= response.meta.total ||
        response.data.length < pageSize
      )
        return result;
    }
    throw new Error('CUSTOMERS_PAGE_LIMIT');
  }

  private async allSales(actor: AuthenticatedActor, branchId: string) {
    const result: SalesContractSummary[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await this.sales.list(
        {
          branchId,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
          page,
          pageSize,
        },
        actor,
      );
      result.push(...response.data);
      if (
        result.length >= response.meta.total ||
        response.data.length < pageSize
      )
        return result;
    }
    throw new Error('SALES_PAGE_LIMIT');
  }

  private async relatedReservations(
    contracts: ReadonlyMap<string, B2bCrmSalesContractV1>,
    branchId: string,
  ): Promise<B2bCrmReservationV1[]> {
    const result: B2bCrmReservationV1[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const rows = await this.reservations.list([branchId], {
        page: String(page),
      });
      for (const row of rows) {
        const contract = contracts.get(row.contractId);
        if (!contract) continue;
        result.push({
          id: row.id,
          contractId: row.contractId,
          contractNumber: row.snapshot.contractNumber,
          customerNameSnapshot: contract.customerNameSnapshot,
          passengerCount: row.snapshot.passengerIds.length,
          services: row.snapshot.serviceSelections.map(
            (service) => service.kind,
          ),
          status: reservationStatus(row),
          receivedAt: row.receivedAt,
        });
      }
      if (rows.length < pageSize) return result;
    }
    throw new Error('RESERVATIONS_PAGE_LIMIT');
  }

  async get(
    organizationId: string,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ): Promise<B2bCrmConnectionsV1> {
    if (!actor.permissions.includes('b2b.agency.read'))
      throw new ForbiddenException('مجوز مشاهده پرونده سازمان را ندارید.');
    const branchId = branchOf(actor, requestedBranch);
    await this.assertOrganization(organizationId);
    const unavailableSources: B2bCrmConnectionsV1['unavailableSources'] = {};
    let linkedCustomers: CustomerSummary[] = [];
    let linkedContracts: SalesContractSummary[] = [];
    let payments: B2bCrmSalesPaymentV1[] = [];
    let reservations: B2bCrmReservationV1[] = [];

    if (actor.permissions.includes('customers.read')) {
      try {
        linkedCustomers = (await this.allCustomers(actor, branchId)).filter(
          (customer) => customer.organizationId === organizationId,
        );
      } catch {
        unavailableSources.CUSTOMERS =
          'دریافت مشتریان سازمانی از سرویس مالک ناموفق بود.';
      }
    } else {
      unavailableSources.CUSTOMERS = 'مجوز مشاهده مشتریان موجود نیست.';
    }

    if (unavailableSources.CUSTOMERS) {
      unavailableSources.SALES =
        'تطبیق قرارداد فروش بدون مرجع مشتری سازمانی ممکن نیست.';
      unavailableSources.SALES_PAYMENTS =
        'دریافت پرداخت بدون قرارداد فروش مرتبط ممکن نیست.';
      unavailableSources.RESERVATIONS =
        'تطبیق رزرو بدون مرجع مشتری و قرارداد فروش ممکن نیست.';
    } else if (hasAny(actor, salesReadPermissions)) {
      try {
        const customerIds = new Set(linkedCustomers.map((row) => row.id));
        linkedContracts = (await this.allSales(actor, branchId)).filter(
          (contract) => customerIds.has(contract.customerId),
        );
      } catch {
        unavailableSources.SALES =
          'دریافت قراردادهای فروش از سرویس مالک ناموفق بود.';
        unavailableSources.RESERVATIONS =
          'تطبیق رزرو بدون قرارداد فروش مرتبط ممکن نیست.';
      }
    } else {
      unavailableSources.SALES = 'مجوز مشاهده قراردادهای فروش موجود نیست.';
      unavailableSources.RESERVATIONS =
        'تطبیق رزرو بدون مجوز مشاهده قرارداد فروش ممکن نیست.';
    }

    if (!unavailableSources.SALES) {
      if (actor.permissions.includes('sales.payments.read')) {
        try {
          const details = await limitedMap(linkedContracts, 4, (contract) =>
            this.sales
              .detail(contract.id, actor)
              .then((response) => response.data),
          );
          payments = details.flatMap(presentPayments);
        } catch {
          unavailableSources.SALES_PAYMENTS =
            'دریافت پرداخت‌های فروش از سرویس مالک ناموفق بود.';
        }
      } else {
        unavailableSources.SALES_PAYMENTS =
          'مجوز مشاهده پرداخت‌های فروش موجود نیست.';
      }

      if (actor.permissions.includes('reservations.read')) {
        try {
          reservations = await this.relatedReservations(
            new Map(
              linkedContracts.map((row) => [row.id, presentContract(row)]),
            ),
            branchId,
          );
        } catch {
          unavailableSources.RESERVATIONS =
            'دریافت رزروها از سرویس مالک ناموفق بود.';
        }
      } else {
        unavailableSources.RESERVATIONS = 'مجوز مشاهده رزرواسیون موجود نیست.';
      }
    }

    let financeExposure: B2bFinanceExposureV1 = {
      status: 'UNAVAILABLE',
      reason: 'NO_EXPOSURE_SNAPSHOT',
    };
    if (actor.permissions.includes('b2b.credit.read')) {
      try {
        financeExposure = await this.financeExposure.getPartyExposure({
          organizationId,
          branchId,
          currencyCode: null,
        });
      } catch {
        unavailableSources.FINANCE = 'دریافت مانده از سرویس مالی ناموفق بود.';
      }
    }
    if (financeExposure.status === 'UNAVAILABLE')
      unavailableSources.FINANCE ??= actor.permissions.includes(
        'b2b.credit.read',
      )
        ? 'سرویس دفترکل مالی سازمان هنوز داده قابل استفاده منتشر نکرده است.'
        : 'مجوز مشاهده اعتبار سازمان موجود نیست.';

    return {
      version: 1,
      organizationId,
      branchId,
      customers: linkedCustomers.map(({ id, displayName, status }) => ({
        id,
        displayName,
        status,
      })),
      contracts: linkedContracts.map(presentContract),
      payments,
      reservations,
      financeExposure,
      unavailableSources,
      observedAt: new Date().toISOString(),
    };
  }
}
