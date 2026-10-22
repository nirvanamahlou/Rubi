require('../apps/api/node_modules/reflect-metadata');
const { randomUUID, randomBytes } = require('crypto'),
  http = require('http');
const { ConfigService } = require('../apps/api/node_modules/@nestjs/config');
const { createDatabaseClient } = require('../packages/database/dist');
const {
  CallCenterCrypto,
} = require('../apps/api/dist/customer-affairs/call-center.crypto');
const {
  CallCenterService,
} = require('../apps/api/dist/customer-affairs/call-center.service');
const {
  CallCenterTelephonyService,
} = require('../apps/api/dist/customer-affairs/call-center-telephony.service');
const {
  IamCallCenterDirectory,
} = require('../apps/api/dist/iam/iam-call-center-directory');
const {
  TelephonyIntegrationService,
} = require('../apps/api/dist/integrations/telephony.service');
const { TelephonyWorker } = require('../apps/worker/dist/telephony-worker');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const u = new URL(process.env.DATABASE_URL);
  if (
    !['localhost', '127.0.0.1'].includes(u.hostname) ||
    !['/nora_ci', '/nora_call_center_package_one_test_1019'].includes(
      u.pathname,
    )
  )
    throw Error('Explicit disposable database required');
  const db = createDatabaseClient(u.toString());
  let worker, server;
  try {
    const connection = await db.integrationTelephonyConnection.findFirstOrThrow(
      {
        where: { name: 'Synthetic connection' },
        orderBy: { createdAt: 'desc' },
      },
    );
    const config = new ConfigService({
      NODE_ENV: 'test',
      TELEPHONY_SYNTHETIC_ENABLED: 'true',
      CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
        'base64',
      ),
      CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
        'base64',
      ),
      CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
    });
    const database = { client: db },
      crypto = new CallCenterCrypto(config),
      directory = new IamCallCenterDirectory(database),
      domain = new CallCenterTelephonyService(
        database,
        crypto,
        new CallCenterService(database, crypto),
        directory,
      ),
      service = new TelephonyIntegrationService(
        database,
        config,
        domain,
        { canManage: () => false },
        directory,
        {},
      );
    const secret = randomBytes(32).toString('hex');
    server = http.createServer(async (req, res) => {
      if (req.headers.authorization !== 'Bearer ' + secret) {
        res.writeHead(401);
        return res.end();
      }
      try {
        const match = req.url.match(/([0-9a-f-]{36})\/process$/);
        const data = match
          ? await service.process(match[1])
          : await service.pending();
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(data));
      } catch {
        res.writeHead(503);
        res.end('{}');
      }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const settings = new ConfigService({
      TELEPHONY_API_URL: `http://127.0.0.1:${server.address().port}/api/v1`,
      TELEPHONY_WORKER_SECRET: secret,
      REDIS_URL: process.env.REDIS_URL,
      WORKER_QUEUE_NAME: 'rubi-telephony-proof-' + randomUUID(),
    });
    const event = () => {
      const id = randomUUID();
      return {
        schemaVersion: 1,
        connectionId: connection.id,
        externalEventId: randomUUID(),
        externalCallId: id,
        rootCallId: id,
        legId: 'one',
        kind: 'RINGING',
        direction: 'IN',
        caller: { kind: 'WITHHELD', value: null },
        destination: { kind: 'UNKNOWN', value: null },
        companyLine: null,
        extension: '101',
        queue: null,
        occurredAt: new Date().toISOString(),
        sequence: 1,
        terminalForCall: false,
        endReason: null,
        recordingReference: null,
      };
    };
    const first = event(),
      row = await service.receive(first);
    if (
      (
        await db.integrationTelephonyInbox.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).status !== 'PENDING'
    )
      throw Error('Not durable pending');
    const awaitDone = async (id) => {
      for (let i = 0; i < 60; i++) {
        if (
          (
            await db.integrationTelephonyInbox.findUniqueOrThrow({
              where: { id },
            })
          ).status === 'DONE'
        )
          return;
        await sleep(300);
      }
      throw Error('Worker did not drain durable inbox');
    };
    worker = new TelephonyWorker(settings);
    worker.onModuleInit();
    await awaitDone(row.id);
    await worker.onModuleDestroy();
    worker = null;
    const second = await service.receive(event());
    await sleep(500);
    if (
      (
        await db.integrationTelephonyInbox.findUniqueOrThrow({
          where: { id: second.id },
        })
      ).status !== 'PENDING'
    )
      throw Error('Stopped worker unexpectedly processed');
    worker = new TelephonyWorker(settings);
    worker.onModuleInit();
    await awaitDone(second.id);
    await service.receive(first);
    const count = await db.callCenterTelephonySession.count({
      where: {
        connectionId: connection.id,
        rootFingerprint: crypto.fingerprint(
          'telephony:root:' + connection.id + ':' + first.rootCallId,
        ),
      },
    });
    if (count !== 1) throw Error('Duplicate business call');
    console.log(
      'PASS: durable Inbox -> real BullMQ/Redis -> Worker HTTP transport -> transactional Call Center projection; stopped Worker recovery and duplicate suppression.',
    );
  } finally {
    await worker?.onModuleDestroy();
    await new Promise((r) => (server ? server.close(r) : r()));
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error('Pipeline proof failed:', e.message);
  process.exitCode = 1;
});
