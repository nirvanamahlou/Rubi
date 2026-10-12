const iso = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));
export const conversionBasis =
  'UNIQUE_LEADS_WITH_LOGGED_CALL_TO_ACCEPTED_CONFIRMED_CONTRACT_AS_OF_REQUEST';
export function validConversionSource(value) {
  return (
    value?.version === 1 &&
    value.source === 'customer-affairs.assistant.call-conversion.v1' &&
    value.scope === 'AUTHORIZED_BRANCHES' &&
    Number.isSafeInteger(value.branchCount) &&
    value.branchCount >= 0 &&
    value.timeZone === 'Asia/Tehran' &&
    iso(value.observedAt) &&
    (value.sourceUpdatedAt === null || iso(value.sourceUpdatedAt)) &&
    value.basis === conversionBasis &&
    value.coverage?.rowLimitPerPeriod === 5000 &&
    value.coverage.answeredCallVerified === false &&
    value.coverage.attributionComplete === false &&
    [value.current, value.previous].every(
      (period) =>
        period &&
        iso(period.startUtc) &&
        iso(period.endUtc) &&
        Math.abs(
          (Date.parse(period.endUtc) - Date.parse(period.startUtc)) / 86400000 -
            7,
        ) <= 0.05 &&
        Number.isSafeInteger(period.contactedLeads) &&
        period.contactedLeads >= 0 &&
        period.contactedLeads <= 5000 &&
        Number.isSafeInteger(period.convertedLeads) &&
        period.convertedLeads >= 0 &&
        period.convertedLeads <= period.contactedLeads &&
        period.conversionBasisPoints ===
          (period.contactedLeads
            ? Math.round(
                (period.convertedLeads * 10000) / period.contactedLeads,
              )
            : null),
    ) &&
    value.previous.endUtc === value.current.startUtc
  );
}
export function projectConversionSource(value) {
  const period = (row) => ({
    startUtc: row.startUtc,
    endUtc: row.endUtc,
    contactedLeads: row.contactedLeads,
    convertedLeads: row.convertedLeads,
    conversionBasisPoints: row.conversionBasisPoints,
  });
  return {
    version: 1,
    source: value.source,
    scope: value.scope,
    branchCount: value.branchCount,
    timeZone: value.timeZone,
    observedAt: value.observedAt,
    sourceUpdatedAt: value.sourceUpdatedAt,
    current: period(value.current),
    previous: period(value.previous),
    basis: conversionBasis,
    coverage: {
      rowLimitPerPeriod: 5000,
      answeredCallVerified: false,
      attributionComplete: false,
    },
  };
}
