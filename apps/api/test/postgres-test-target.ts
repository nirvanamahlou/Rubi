/** Dedicated test containers let both PCs run the same opt-in PostgreSQL suite.
 * Existing random database-name guards remain mandatory in every caller.
 */
export function postgresTestTarget(env: NodeJS.ProcessEnv = process.env): {
  container: string;
  port: string;
  user: string;
} {
  const container = env.RUBI_TEST_POSTGRES_CONTAINER;
  const port = env.RUBI_TEST_POSTGRES_PORT;
  const user = env.RUBI_TEST_POSTGRES_USER;
  if (!container && !port && !user)
    return { container: 'rubi-postgres-1', port: '55432', user: 'rubi_local' };
  if (
    !container ||
    !/^rubi-test-[a-z0-9][a-z0-9-]{0,60}$/.test(container) ||
    !port ||
    !/^\d{4,5}$/.test(port) ||
    Number(port) < 1024 ||
    Number(port) > 65535 ||
    ['5432', '5434'].includes(port) ||
    !user ||
    !/^[a-z_][a-z0-9_]{0,62}$/.test(user)
  )
    throw new Error(
      'A complete dedicated local test PostgreSQL target is required.',
    );
  return { container, port, user };
}
