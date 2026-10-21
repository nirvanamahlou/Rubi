import { canViewRoute, type AuthenticatedActor } from '@nora/contracts';
const workflows = {
  sales: {
    routes: [
      '/sales/contracts/new',
      '/sales',
      '/sales/ticket-prices',
      '/sales/pricing',
    ],
    permissions: [
      'sales.contracts.create',
      'sales.contracts.update.own',
      'sales.contracts.update.branch',
      'sales.contracts.read.own',
      'sales.contracts.read.branch',
      'sales.contracts.read.all',
      'package_pricing.read',
      'ticket_catalog.manage',
    ],
  },
  reservations: {
    routes: [
      '/reservations',
      '/reservations/foundation',
      '/reservations/operations',
      '/reservations/processing',
      '/reservations/hotel-rates',
    ],
    permissions: ['reservations.read'],
  },
  customers: {
    routes: ['/customers'],
    permissions: ['customers.read', 'customers.create', 'customers.update'],
  },
  organizations: {
    routes: ['/organizations'],
    permissions: [
      'b2b.agency.read',
      'b2b.agency.manage',
      'b2b.agreement.manage',
      'b2b.rate.manage',
    ],
  },
  accounting: {
    routes: [
      '/finance/accounting/general-ledger/base-information',
      '/finance/accounting/general-ledger/accounts',
      '/finance/accounting/general-ledger/documents',
      '/finance',
    ],
    permissions: ['finance.account.manage', 'finance.journal.read'],
  },
  marketing: {
    routes: ['/marketing'],
    permissions: [
      'marketing.read',
      'marketing.campaign.create',
      'marketing.campaign.update',
    ],
  },
  procurement: {
    routes: ['/purchases'],
    permissions: [
      'procurement.read.own',
      'procurement.read.unit',
      'procurement.read.all',
      'procurement.quote.manage',
    ],
  },
  'ticket-catalog': {
    routes: ['/ticket-management'],
    permissions: ['ticket_catalog.read', 'ticket_catalog.manage'],
  },
} as const;
export type SelectionWorkflow = keyof typeof workflows;
/** The consuming page AND its native authority are required; source grants are never added. */
export function canSelectForWorkflow(
  actor: AuthenticatedActor,
  workflow: string,
): workflow is SelectionWorkflow {
  if (!Object.hasOwn(workflows, workflow) || !actor.branchIds.length)
    return false;
  const rule = workflows[workflow as SelectionWorkflow];
  return (
    rule.permissions.some((permission) =>
      actor.permissions.some((code) => code === permission),
    ) && rule.routes.some((route) => canViewRoute(actor.permissions, route))
  );
}
