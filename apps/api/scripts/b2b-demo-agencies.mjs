// Explicit local-only expansion requested by the owner; existing seed defaults stay bounded.
export async function demoAgencyNames(master, defaults) {
  if (process.env.B2B_DEMO_ALL_EXISTING !== '1') return defaults;
  const rows = [];
  for (let page = 1; ; page++) {
    const result = await master.list('organizations', {
      search: '',
      status: 'active',
      sortBy: 'code',
      sortDirection: 'asc',
      page,
      pageSize: 100,
    });
    rows.push(...result.data);
    if (rows.length >= result.meta.total) break;
  }
  const agencies = rows.filter((r) =>
    String(r.attributes.roleCodes).split(',').includes('AGENCY'),
  );
  if (new Set(agencies.map((r) => r.name)).size !== agencies.length)
    throw Error('Duplicate agency names require ID-based selection');
  return agencies.map((r) => r.name);
}
