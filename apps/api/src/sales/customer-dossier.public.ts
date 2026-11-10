import {
  canViewRoute,
  type AuthenticatedActor,
  type CustomerDossierSection,
  type CustomerDossierRow,
} from '@nora/contracts';
import type { DatabaseClient, Prisma } from '@nora/database';

export function dossierSalesScope(
  actor: AuthenticatedActor,
  customerId: string,
  company: Prisma.SalesContractWhereInput,
): Prisma.SalesContractWhereInput | null {
  const p = actor.permissions;
  if (
    !canViewRoute(p, '/sales') ||
    !p.some((x) =>
      [
        'sales.contracts.read.all',
        'sales.contracts.read.branch',
        'sales.contracts.read.own',
      ].includes(x),
    )
  )
    return null;
  return {
    AND: [
      company,
      { branchId: { in: actor.branchIds } },
      ...(!p.includes('sales.contracts.read.all') &&
      !p.includes('sales.contracts.read.branch')
        ? [{ ownerUserId: actor.userId }]
        : []),
      {
        OR: [
          { customerId },
          { payerCustomerId: customerId },
          { passengers: { some: { customerId } } },
        ],
      },
    ],
  };
}
export function dossierSection(
  id: CustomerDossierSection['id'],
  rows: CustomerDossierRow[],
): CustomerDossierSection {
  return {
    id,
    state: 'ready',
    rows: rows.slice(0, 50),
    hasMore: rows.length > 50,
  };
}
export async function readSalesCustomerDossier(
  db: DatabaseClient,
  actor: AuthenticatedActor,
  customerId: string,
  scope: Prisma.SalesContractWhereInput | null,
): Promise<CustomerDossierSection[]> {
  if (!scope)
    return ['contracts', 'services', 'payments', 'checks'].map((id) => ({
      id: id as CustomerDossierSection['id'],
      state: 'forbidden',
      rows: [],
      hasMore: false,
    }));
  const contracts = await db.salesContract.findMany({
    where: scope,
    select: { id: true, contractNumber: true, status: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 51,
  });
  const services = await db.salesContractService.findMany({
    where: {
      contract: scope,
      OR: [
        { contract: { customerId } },
        { contract: { payerCustomerId: customerId } },
        { allocations: { some: { passenger: { customerId } } } },
      ],
    },
    select: {
      id: true,
      kind: true,
      createdAt: true,
      contract: { select: { contractNumber: true, status: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 51,
  });
  const result = [
    dossierSection(
      'contracts',
      contracts.map((r) => ({
        id: r.id,
        reference: r.contractNumber,
        status: r.status,
        occurredAt: r.createdAt.toISOString(),
      })),
    ),
    dossierSection(
      'services',
      services.map((r) => ({
        id: r.id,
        reference: r.contract.contractNumber,
        status: r.kind,
        occurredAt: r.createdAt.toISOString(),
      })),
    ),
  ];
  const financial =
    actor.permissions.includes('sales.payments.read') &&
    actor.permissions.includes('finance.read') &&
    canViewRoute(actor.permissions, '/finance');
  for (const id of ['payments', 'checks'] as const) {
    if (!financial) {
      result.push({ id, state: 'forbidden', rows: [], hasMore: false });
      continue;
    }
    const rows = await db.salesContractPaymentEntry.findMany({
      where: {
        contract: {
          AND: [
            scope,
            { OR: [{ customerId }, { payerCustomerId: customerId }] },
          ],
        },
        ...(id === 'checks' ? { method: 'CHECK' as const } : {}),
      },
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        status: true,
        createdAt: true,
        contract: { select: { contractNumber: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    result.push(
      dossierSection(
        id,
        rows.map((r) => ({
          id: r.id,
          reference: r.contract.contractNumber,
          status: r.status,
          occurredAt: r.createdAt.toISOString(),
          amount: r.amount.toString(),
          currencyCode: r.currencyCode,
        })),
      ),
    );
  }
  return result;
}
