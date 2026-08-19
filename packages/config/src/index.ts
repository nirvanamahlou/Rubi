import { URL } from 'node:url';

export function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
}

export function parseRedisUrl(value: string): RedisConnectionOptions {
  const url = new URL(value);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis or rediss protocol.');
  }

  const port = url.port === '' ? 6379 : Number(url.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error('REDIS_URL contains an invalid port.');
  }

  return {
    host: url.hostname,
    port,
    ...(url.username.length > 0
      ? { username: decodeURIComponent(url.username) }
      : {}),
    ...(url.password.length > 0
      ? { password: decodeURIComponent(url.password) }
      : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
