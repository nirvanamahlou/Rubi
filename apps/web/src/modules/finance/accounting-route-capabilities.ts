import type { AccountingParityDefinition } from './components/accounting-parity-definitions';
import { internalAccountingReportKind } from './accounting-internal-report-model';

/** Capabilities describe the actual internal command, never full source parity. */
export function accountingRouteCapabilities(
  definition: AccountingParityDefinition,
) {
  const { route, implementation, evidenceStatus } = definition;
  const blocked = evidenceStatus === 'source-error';
  const list = route.includes('/lists/');
  const draftForms = [
    'taxpayer-system/settings',
    'taxpayer-system/cancellation-invoice',
    'taxpayer-system/operations/batch-schedules',
  ];
  const draftLists = [
    'taxpayer-system/lists/settings',
    'taxpayer-system/lists/cancellations',
    'taxpayer-system/lists/batch-schedules',
  ];
  const storage =
    !blocked &&
    !list &&
    (draftForms.includes(route) ||
      [
        'configuration',
        'ledger',
        'accounts',
        'details',
        'account-groups',
        'detail-groups',
        'mapping',
        'detail-conversion',
        'journal-edit',
        'template-list',
        'tax-reference',
        'taxpayer-seller',
      ].includes(implementation));
  const execution =
    !blocked &&
    [
      'journal-edit',
      'journal-review',
      'journal-posting',
      'journal-deleted',
      'numbering',
      'move-drafts',
      'revaluation',
      'year-end-closing',
      'year-end-opening',
      'year-end-final',
      'year-end-nature-adjustment',
    ].includes(implementation);
  const reporting =
    !blocked &&
    (!!internalAccountingReportKind(route) ||
      draftLists.includes(route) ||
      [
        'statement-list',
        'trial-balance',
        'turnover-report',
        'analytical-report',
        'chart-report',
        'journal-line-report',
        'journal-list',
        'configuration-list',
      ].includes(implementation) ||
      route === 'general-ledger/documents/lists/revaluations' ||
      route === 'general-ledger/documents/lists/gl-vouchers');
  return {
    observedForm: evidenceStatus === 'observed-layout',
    storage,
    execution,
    reporting,
    externalRequired:
      route.startsWith('taxpayer-system/') &&
      route !== 'taxpayer-system/seller-information',
    externalConnected: false as const,
    fullSourceParityVerified: false as const,
    completeness: blocked
      ? ('source-blocked' as const)
      : storage || execution || reporting
        ? ('partial' as const)
        : ('evidence-only' as const),
  };
}
