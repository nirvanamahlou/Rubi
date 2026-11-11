/** Accounting tests only run on named local fixtures or the explicit disposable CI service. */
export function accountingTestUrl(variable: string) {
  return (
    process.env[variable] ??
    (process.env.CI === 'true' &&
    process.env.NORA_RUN_LEDGER_PARITY_POSTGRES_TESTS === '1'
      ? process.env.DATABASE_URL
      : undefined)
  );
}
export function assertAccountingTestDatabase(
  url: string,
  port: string,
  name: string,
) {
  const target = new URL(url);
  if (
    [...target.searchParams].some(
      ([key, value]) => key !== 'schema' || value !== 'public',
    )
  )
    throw new Error('Accounting test connection overrides are forbidden');
  const local =
    target.hostname === '127.0.0.1' &&
    target.port === port &&
    target.pathname === `/${name}`;
  const ci =
    process.env.CI === 'true' &&
    process.env.NORA_RUN_LEDGER_PARITY_POSTGRES_TESTS === '1' &&
    target.hostname === '127.0.0.1' &&
    target.port === '5432' &&
    target.pathname === '/nora_ci' &&
    target.username === 'nora_ci';
  if (!local && !ci)
    throw new Error('Dedicated synthetic accounting test database required');
}
