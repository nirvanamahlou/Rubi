import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import Redis from 'ioredis';
import { createGateway } from './provider.mjs';

const path = process.env.NORA_IDENTITY_CONFIG_FILE;
if (!path) throw Error('NORA_IDENTITY_CONFIG_FILE is required');
const config = JSON.parse(await readFile(path, 'utf8'));
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});
await redis.connect();
const { handler } = createGateway(config, redis);
const server = createServer((req, res) => {
  void handler(req, res);
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.maxHeadersCount = 50;
server.listen(Number(process.env.PORT || 19130), '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(() => {
      void redis.quit();
    }),
  );
