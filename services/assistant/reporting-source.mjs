const text = (x, max = 500) => typeof x === 'string' && x.length <= max;
const record = (x) => x && !Array.isArray(x) && typeof x === 'object';
const date = (x) => text(x) && Number.isFinite(Date.parse(x));
export function validCatalog(body) {
  return (
    Array.isArray(body) &&
    body.length <= 100 &&
    new Set(body.map((x) => x?.code)).size === body.length &&
    body.every(
      (x) =>
        record(x) &&
        /^RPT-\d{3}$/.test(x.code) &&
        text(x.title) &&
        text(x.grain) &&
        Number.isInteger(x.version) &&
        x.version > 0 &&
        ['READY', 'PENDING_CONNECTION'].includes(x.producerStatus),
    )
  );
}
export function projectCatalog(body) {
  return {
    source: 'reports.catalog.v1',
    reports: body.map(({ code, title, grain, version, producerStatus }) => ({
      code,
      title,
      grain,
      version,
      producerStatus,
    })),
    notice: 'READY describes source capability, not proof that records exist.',
  };
}
export function validDashboard(body) {
  if (
    !record(body) ||
    !['ready', 'empty', 'blocked'].includes(body.state) ||
    !text(body.message, 2000) ||
    !record(body.metrics) ||
    !record(body.visuals)
  )
    return false;
  if (body.state !== 'ready')
    return (
      Object.keys(body.metrics).length === 0 &&
      Object.keys(body.visuals).length === 0
    );
  if (
    !record(body.metadata) ||
    !date(body.metadata.generatedAt) ||
    !date(body.metadata.dataAsOf) ||
    body.metadata.timezone !== 'Asia/Tehran' ||
    ![
      'reporting.dashboard.native.v1',
      'reporting.dashboard.travel.v1',
    ].includes(body.metadata.reportVersion)
  )
    return false;
  return (
    Object.keys(body.metrics).length <= 100 &&
    Object.values(body.metrics).every(
      (x) =>
        record(x) &&
        text(x.value, 200) &&
        text(x.unit, 100) &&
        text(x.detail, 2000),
    ) &&
    Object.keys(body.visuals).length <= 100 &&
    Object.values(body.visuals).every(
      (x) =>
        record(x) &&
        Array.isArray(x.labels) &&
        x.labels.length <= 400 &&
        x.labels.every((v) => text(v)) &&
        Array.isArray(x.values) &&
        x.values.length === x.labels.length &&
        x.values.every(Number.isFinite),
    )
  );
}
export function projectDashboard(body) {
  const meta = body.metadata;
  return {
    source: 'reports.dashboard.projection.v1',
    state: body.state,
    message: body.message,
    metadata: meta
      ? {
          generatedAt: meta.generatedAt,
          dataAsOf: meta.dataAsOf,
          timezone: meta.timezone,
          dateBasis: meta.dateBasis,
          currencyFxBasis: meta.currencyFxBasis,
          reportVersion: meta.reportVersion,
        }
      : null,
    metrics: Object.fromEntries(
      Object.entries(body.metrics).map(([id, x]) => [
        id,
        { value: x.value, unit: x.unit, detail: x.detail },
      ]),
    ),
    // Keep charts in the authoritative ERP dashboard; never collapse currency series into one model total.
    charts: Object.keys(body.visuals),
    href: '/dashboard',
    notice:
      'Observed ERP metrics only; no forecast, accounting certification or currency conversion is inferred.',
  };
}
