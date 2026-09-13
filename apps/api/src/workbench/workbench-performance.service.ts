import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  WorkbenchPerformanceSectionV1,
  WorkbenchPerformanceResponseV1,
  WorkbenchSalesPerformanceV1,
  WorkbenchJobActivityV1,
  SalesContractSummary,
  WorkbenchActivityV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { HrSelfPerformanceService } from '../hr/hr-self-performance.service';
import { IamService } from '../iam/iam.service';
import { SalesService } from '../sales/sales.service';
import { CustomerService } from '../customers/customer.service';

const salesPermissions = [
  'sales.contracts.read.own',
  'sales.contracts.read.branch',
  'sales.contracts.read.all',
];
const activityModules = [
  { key: 'sales', label: 'فروش', permissions: salesPermissions },
  { key: 'customers', label: 'مشتریان', permissions: ['customers.read'] },
  {
    key: 'reservations',
    label: 'رزرواسیون',
    permissions: ['reservations.read'],
  },
  { key: 'finance', label: 'مالی', permissions: ['finance.read'] },
  {
    key: 'hr',
    label: 'منابع انسانی',
    permissions: ['hr.read', 'hr.manage', 'hr.self', 'hr.team'],
  },
  {
    key: 'documents',
    label: 'اسناد',
    permissions: ['documents.metadata.read'],
  },
  {
    key: 'customer_affairs',
    label: 'امور مشتریان',
    permissions: ['customer_affairs.ticket.read'],
  },
  { key: 'workbench', label: 'میزکار', permissions: [] },
];

@Injectable()
export class WorkbenchPerformanceService {
  constructor(
    @Inject(HrSelfPerformanceService)
    private readonly hr: HrSelfPerformanceService,
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(CustomerService) private readonly customers: CustomerService,
  ) {}

  async get(
    actor: AuthenticatedActor,
    daysInput = '30',
  ): Promise<WorkbenchPerformanceResponseV1> {
    if (!['30', '90', '365'].includes(daysInput))
      throw new BadRequestException('بازه عملکرد معتبر نیست.');
    const days = Number(daysInput);
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - days + 1);
    from.setUTCHours(0, 0, 0, 0);
    const period = { from: from.toISOString(), to: to.toISOString(), days };
    const [hr, sales, activity] = await Promise.all([
      section(() => this.hr.get(actor)),
      section(() =>
        this.ownSales(actor, period.from.slice(0, 10), period.to.slice(0, 10)),
      ),
      section(() => this.ownActivity(actor, period.from, period.to)),
    ]);
    return { generatedAt: to.toISOString(), period, hr, sales, activity };
  }

  private async ownSales(
    actor: AuthenticatedActor,
    from: string,
    to: string,
  ): Promise<WorkbenchSalesPerformanceV1> {
    if (!actor.permissions.some((p) => salesPermissions.includes(p)))
      throw new ForbiddenException(
        'آمار فروش متناسب با دسترسی شغلی نمایش داده می‌شود.',
      );
    const contracts = new Map<string, SalesContractSummary>();
    let partial = false;
    // Use the owner's stable, bounded public export projection; never query Sales tables.
    for (const branchId of [...new Set(actor.branchIds)]) {
      const remaining = 1000 - contracts.size;
      if (remaining <= 0) {
        partial = true;
        break;
      }
      const response = await this.sales.list(
        {
          ownerUserId: actor.userId,
          branchId,
          createdFrom: from,
          createdTo: to,
          sortBy: 'createdAt',
          sortDirection: 'desc',
        },
        actor,
        remaining,
      );
      if (response.data.length > remaining) partial = true;
      for (const row of response.data.slice(0, remaining)) {
        if (row.ownerUserId === actor.userId && row.branchId === branchId)
          contracts.set(row.id, row);
      }
    }
    const confirmed = [...contracts.values()].filter((row) =>
      [
        'CONFIRMED',
        'SENT_TO_RESERVATIONS',
        'IN_PROGRESS',
        'COMPLETED',
      ].includes(row.status),
    );
    const amounts = new Map<string, Prisma.Decimal>();
    for (const row of confirmed)
      for (const balance of row.balances) {
        amounts.set(
          balance.currencyCode,
          (amounts.get(balance.currencyCode) ?? new Prisma.Decimal(0)).plus(
            balance.amount,
          ),
        );
      }
    return {
      contracts: contracts.size,
      confirmedContracts: confirmed.length,
      customers: new Set(confirmed.map((row) => row.customerId)).size,
      amounts: [...amounts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currencyCode, value]) => ({
          currencyCode,
          amount: value.toFixed(),
        })),
      partial,
    };
  }

  private async ownActivity(
    actor: AuthenticatedActor,
    from: string,
    to: string,
  ): Promise<WorkbenchJobActivityV1> {
    const allowed = activityModules.filter(
      (module) =>
        !module.permissions.length ||
        actor.permissions.some((p) => module.permissions.includes(p)),
    );
    const response = await this.iam.listSelfActivity(actor);
    const sourceRows: WorkbenchActivityV1[] = [...response.data];
    if (allowed.some((module) => module.key === 'hr'))
      sourceRows.push(...(await this.hr.activity(actor, from, to)));
    if (allowed.some((module) => module.key === 'sales')) {
      const customerIds = new Set<string>();
      let remaining = 20;
      for (const branchId of [...new Set(actor.branchIds)]) {
        if (!remaining) break;
        const contracts = await this.sales.list(
          {
            ownerUserId: actor.userId,
            branchId,
            createdFrom: from.slice(0, 10),
            createdTo: to.slice(0, 10),
            sortBy: 'createdAt',
            sortDirection: 'desc',
          },
          actor,
          remaining,
        );
        for (const contract of contracts.data.slice(0, remaining)) {
          if (
            contract.ownerUserId !== actor.userId ||
            contract.branchId !== branchId
          )
            continue;
          const history = await this.sales.history(contract.id, actor);
          customerIds.add(contract.customerId);
          sourceRows.push(
            ...history.data
              .filter((event) => event.changedByUserId === actor.userId)
              .map((event) => ({
                id: event.id,
                action: `sales.status.${event.toStatus.toLowerCase()}`,
                entityType: 'SalesContract',
                entityId: null,
                occurredAt: event.changedAt.toISOString(),
              })),
          );
        }
        remaining = Math.max(0, remaining - contracts.data.length);
      }
      if (actor.permissions.includes('customers.read')) {
        for (const customerId of customerIds) {
          const response = await this.customers.activity(customerId, actor);
          sourceRows.push(
            ...response.data
              .filter(
                (event) =>
                  event.actor.userId === actor.userId &&
                  actor.branchIds.includes(event.actorBranchId),
              )
              .map((event) => ({
                id: event.id,
                action: `customers.${event.type}`,
                entityType: 'Customer',
                entityId: null,
                occurredAt: event.occurredAt,
              })),
          );
        }
      }
    }
    const rows = sourceRows.filter(
      (row) => row.occurredAt >= from && row.occurredAt <= to,
    );
    const recent = rows.flatMap((row) => {
      const module = allowed.find((item) =>
        row.action.startsWith(`${item.key}.`),
      );
      return module
        ? [{ ...row, entityId: null, moduleLabel: module.label }]
        : [];
    });
    return {
      modules: allowed.map((module) => ({
        key: module.key,
        label: module.label,
        count: recent.filter((row) => row.moduleLabel === module.label).length,
      })),
      recent: recent
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 20),
      sourceLimit: 100,
    };
  }
}

async function section<T>(
  read: () => Promise<T>,
): Promise<WorkbenchPerformanceSectionV1<T>> {
  try {
    return { status: 'ready', data: await read() };
  } catch (error) {
    return error instanceof ForbiddenException
      ? { status: 'forbidden', message: error.message }
      : {
          status: 'error',
          message: 'دریافت اطلاعات این بخش انجام نشد؛ دوباره تلاش کنید.',
        };
  }
}
