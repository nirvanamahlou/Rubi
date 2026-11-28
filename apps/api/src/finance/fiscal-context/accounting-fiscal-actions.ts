/** Reference definitions are shared across years. Transaction actions fail closed. */
export const accountingFiscalMetadataActions = new Set([
  'save-book',
  'save-configuration',
  'save-treasury-instrument',
  'save-beneficiary',
  'tax-reference-import',
  'tax-map-save',
  'save-period',
  'delete-period',
  'set-default-period',
  'save-account',
  'save-detail',
  'save-detail-owner',
  'setup-finance-coding-types',
  'save-account-group',
  'save-detail-group',
  'save-template',
  'save-fx',
  'approve-fx',
  'delete-base-record',
  'save-subsidiary-mappings',
  'save-detail-type-conversion',
  'delete-detail-type-conversion',
  'standard-map',
  'standard-unmap',
  'standard-code-save',
  'standard-code-delete',
  'financial-rule-save',
  'financial-rule-disable',
  'add-line-default-description',
]);
export function fiscalYearIndependentRequest(
  path: string,
  method: string,
  action?: string,
) {
  if (
    method === 'GET' &&
    (path === '/finance/accounting/journal-register' ||
      /^\/finance\/source-contracts\/[^/]+\/read$/.test(path) ||
      /^\/finance\/accounting\/books\/[^/]+\/journals\/[^/]+\/read$/.test(
        path,
      ) ||
      /^\/finance\/accounting\/books\/[^/]+\/detail-code-suggestion$/.test(
        path,
      ))
  )
    return true;
  if (action && accountingFiscalMetadataActions.has(action)) return true;
  if (
    /^\/finance\/accounting\/books\/[^/]+\/reports\/analytical\/(?:standard-mapping|treasury-instruments|beneficiaries|tax-mapping|detail-owners)$/.test(
      path,
    ) &&
    method === 'GET'
  )
    return true;
  if (
    /^\/finance\/(?:banks(?:\/|$)|exchange-offices(?:\/|$)|settlement-accounts$|payment-methods$|account-banks$|paying-suppliers$|purchase-fx-quote$|followup(?:\/|$))/.test(
      path,
    )
  )
    return true;
  if (
    /^\/finance\/accounting\/books\/[^/]+\/(?:taxpayer\/seller|taxpayer\/drafts\/(?:settings|schedules))$/.test(
      path,
    )
  )
    return true;
  if (
    /^\/finance\/accounting\/books\/[^/]+\/tax\/(?:thresholds|aggregation|identity)(?:\/|$)/.test(
      path,
    )
  )
    return true;
  return (
    /^\/finance\/accounting\/books(?:\/[^/]+)?$/.test(path) &&
    ['GET', 'POST'].includes(method)
  );
}
