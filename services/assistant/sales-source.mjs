const iso = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));
const uuid = (value) =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;
export function validSalesSource(value) {
  if (typeof value?.routeNamesComplete !== 'boolean') return false;
  if (
    !value ||
    value.version !== 1 ||
    value.source !== 'sales.assistant.weekly.v1' ||
    value.scope !== 'ALL_AUTHORIZED_SALES' ||
    value.timeBasis !== 'CREATED_AT' ||
    value.timeZone !== 'Asia/Tehran' ||
    !iso(value.observedAt) ||
    (value.sourceUpdatedAt !== null && !iso(value.sourceUpdatedAt))
  )
    return false;
  if (
    value.coverage?.rowLimit !== 5000 ||
    value.coverage?.routeBasis !== 'PRIMARY_CONTRACT_ROUTE' ||
    value.coverage?.truncated !== false
  )
    return false;
  if (
    JSON.stringify(value.unavailable) !==
    JSON.stringify([
      'NET_SALES_REFUND_SOURCE_PENDING',
      'CONTACT_COHORT_SOURCE_PENDING',
      'MULTI_ROUTE_PROJECTION_PENDING',
    ])
  )
    return false;
  for (const period of [value.current, value.previous]) {
    if (
      !period ||
      !iso(period.startUtc) ||
      !iso(period.endUtc) ||
      !count(period.contractCount) ||
      period.contractCount > 5000 ||
      !count(period.passengerCount) ||
      !Array.isArray(period.routes) ||
      period.routes.length > 5000
    )
      return false;
    const days =
      (Date.parse(period.endUtc) - Date.parse(period.startUtc)) / 86400000;
    if (days < 6.95 || days > 7.05) return false;
    let contracts = 0,
      passengers = 0;
    const unique = new Set();
    for (const row of period.routes) {
      if (
        !row ||
        ![row.originName, row.destinationName].every(
          (name) =>
            name === null ||
            (typeof name === 'string' &&
              name.trim().length > 0 &&
              name.length <= 200),
        )
      )
        return false;
      if (
        !row ||
        !uuid(row.originId) ||
        !uuid(row.destinationId) ||
        !count(row.contractCount) ||
        !row.contractCount ||
        !count(row.passengerCount)
      )
        return false;
      const key = `${row.originId}:${row.destinationId}`;
      if (unique.has(key)) return false;
      unique.add(key);
      contracts += row.contractCount;
      passengers += row.passengerCount;
    }
    if (
      contracts !== period.contractCount ||
      passengers !== period.passengerCount
    )
      return false;
  }
  const namesComplete = [
    ...value.current.routes,
    ...value.previous.routes,
  ].every((row) => row.originName !== null && row.destinationName !== null);
  return (
    value.routeNamesComplete === namesComplete &&
    value.previous.endUtc === value.current.startUtc &&
    value.current.contractCount + value.previous.contractCount <= 5000
  );
}
export function projectSalesSource(value) {
  const period = (input) => ({
    startUtc: input.startUtc,
    endUtc: input.endUtc,
    contractCount: input.contractCount,
    passengerCount: input.passengerCount,
    routes: input.routes.map((row) => ({
      originId: row.originId,
      destinationId: row.destinationId,
      originName: row.originName,
      destinationName: row.destinationName,
      contractCount: row.contractCount,
      passengerCount: row.passengerCount,
    })),
  });
  return {
    version: 1,
    source: value.source,
    scope: value.scope,
    timeBasis: value.timeBasis,
    timeZone: value.timeZone,
    observedAt: value.observedAt,
    sourceUpdatedAt: value.sourceUpdatedAt,
    routeNamesComplete: value.routeNamesComplete,
    current: period(value.current),
    previous: period(value.previous),
    coverage: {
      rowLimit: 5000,
      routeBasis: 'PRIMARY_CONTRACT_ROUTE',
      truncated: false,
    },
    unavailable: [
      'NET_SALES_REFUND_SOURCE_PENDING',
      'CONTACT_COHORT_SOURCE_PENDING',
      'MULTI_ROUTE_PROJECTION_PENDING',
    ],
  };
}
