import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  createPublicKey,
  verify,
} from 'node:crypto';
import Redis from 'ioredis';
import { createGateway, checkedConfig } from '../src/provider.mjs';
import { encryptedAdapter } from '../src/storage.mjs';

test('local issuer cannot be enabled in production', () => {
  assert.throws(() =>
    checkedConfig({
      localDevelopment: true,
      issuer: 'http://nora.localhost:19130',
      apiOrigin: 'http://127.0.0.1',
      browserLoginUrl: 'http://nora.localhost:3100/login',
      redirectUri: 'http://niyayesh.localhost:18025/callback',
    }),
  );
});

test(
  'actual OIDC code flow, encrypted Redis, atomic consumption and revocation',
  { skip: !process.env.NORA_TEST_REDIS_URL, timeout: 60000 },
  async (t) => {
    const redis = new Redis(process.env.NORA_TEST_REDIS_URL, {
      maxRetriesPerRequest: 1,
    });
    await new Promise((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
    });
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = privateKey.export({ format: 'jwk' });
    Object.assign(jwk, { kid: 'unit-key', use: 'sig', alg: 'RS256' });
    const actor = {
      userId: randomUUID(),
      sessionId: randomUUID(),
      branchId: randomUUID(),
    };
    let active = true;
    const config = {
      localDevelopment: true,
      issuer: 'http://nora.localhost:19130',
      apiOrigin: 'http://127.0.0.1',
      browserLoginUrl: 'http://nora.localhost:3100/login',
      redirectUri: 'http://niyayesh.localhost:18025/callback',
      clientId: 'site-test',
      clientSecret: randomBytes(32).toString('base64url'),
      serviceSecret: randomBytes(32).toString('base64url'),
      encryptionKey: randomBytes(32).toString('base64'),
      cookieKeys: [randomBytes(32).toString('base64url')],
      jwks: { keys: [jwk] },
    };
    const claims = {
      active: true,
      sub: actor.userId,
      nora_session: actor.sessionId,
      nora_branch: actor.branchId,
      nora_actor: actor.userId,
      nora_system: 'site-test',
      nora_organization: 'test-org',
      nora_permissions: ['catalog'],
      nora_grants: ['panel.login', 'countries.read'],
      nora_provision: true,
    };
    const gateway = createGateway(config, redis, async (url, init) => {
      if (url.endsWith('/access'))
        return new Response(
          JSON.stringify({ ...actor, branchIds: [actor.branchId] }),
        );
      assert.equal(
        init.headers.authorization,
        'Bearer ' + config.serviceSecret,
      );
      return new Response(JSON.stringify({ ...claims, active }));
    });
    const server = createServer((req, res) => void gateway.handler(req, res));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const jar = new Map();
    jar.set('nora_access', 'test-cookie-not-a-real-token');
    const call = (path, { body, headers = {} } = {}) =>
      new Promise((resolve, reject) => {
        const req = request(
          {
            host: '127.0.0.1',
            port: server.address().port,
            path,
            method: body ? 'POST' : 'GET',
            headers: {
              Host: 'nora.localhost:19130',
              Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
              ...headers,
            },
          },
          (res) => {
            for (const cookie of res.headers['set-cookie'] ?? []) {
              const [item] = cookie.split(';');
              const i = item.indexOf('=');
              jar.set(item.slice(0, i), item.slice(i + 1));
            }
            let content = '';
            res.on('data', (c) => (content += c));
            res.on('end', () =>
              resolve({
                status: res.statusCode,
                headers: res.headers,
                text: content,
              }),
            );
          },
        );
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    async function authorization() {
      const verifier = randomBytes(32).toString('base64url');
      const state = randomBytes(24).toString('base64url'),
        nonce = randomBytes(24).toString('base64url');
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid nora_site',
        code_challenge: createHash('sha256')
          .update(verifier)
          .digest('base64url'),
        code_challenge_method: 'S256',
        state,
        nonce,
        prompt: 'login',
        nora_branch: actor.branchId,
        claims: JSON.stringify({
          id_token: Object.fromEntries(
            Object.keys(claims)
              .filter((k) => k.startsWith('nora_'))
              .map((k) => [k, { essential: true }]),
          ),
        }),
      });
      let response = await call('/auth?' + params);
      for (let n = 0; n < 8; n++) {
        assert.equal(
          response.status,
          303,
          `authorization redirect step ${n} failed (${response.status})`,
        );
        const target = new URL(response.headers.location, config.issuer);
        if (target.hostname === 'niyayesh.localhost') {
          assert.equal(target.searchParams.get('state'), state);
          assert.ok(
            target.searchParams.get('code'),
            'authorization code must exist',
          );
          return { code: target.searchParams.get('code'), verifier, nonce };
        }
        response = await call(target.pathname + target.search);
      }
      throw Error('Authorization did not finish');
    }
    const exchange = (flow, verifier = flow.verifier) =>
      call('/token', {
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: flow.code,
          redirect_uri: config.redirectUri,
          code_verifier: verifier,
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(config.clientId + ':' + config.clientSecret).toString(
              'base64',
            ),
        },
      });
    try {
      await t.test(
        'confidential code exchange and current UserInfo',
        async () => {
          const flow = await authorization();
          const response = await exchange(flow);
          assert.equal(response.status, 200);
          const token = JSON.parse(response.text);
          const [head, body, signature] = token.id_token.split('.');
          assert.ok(
            verify(
              'RSA-SHA256',
              Buffer.from(head + '.' + body),
              createPublicKey(privateKey),
              Buffer.from(signature, 'base64url'),
            ),
          );
          const id = JSON.parse(Buffer.from(body, 'base64url'));
          assert.equal(id.iss, config.issuer);
          assert.equal(id.sub, actor.userId);
          assert.equal(id.nonce, flow.nonce);
          assert.equal(id.nora_session, actor.sessionId);
          assert.deepEqual(id.nora_grants, claims.nora_grants);
          const info = await call('/me', {
            headers: { Authorization: 'Bearer ' + token.access_token },
          });
          assert.equal(info.status, 200);
          assert.equal(JSON.parse(info.text).sub, actor.userId);
          active = false;
          assert.notEqual(
            (
              await call('/me', {
                headers: { Authorization: 'Bearer ' + token.access_token },
              })
            ).status,
            200,
          );
          active = true;
          assert.equal((await exchange(flow)).status, 400);
        },
      );
      await t.test('wrong PKCE is rejected', async () => {
        const flow = await authorization();
        assert.equal(
          (await exchange(flow, randomBytes(32).toString('base64url'))).status,
          400,
        );
      });
      await t.test(
        'concurrent redemption produces only one token response',
        async () => {
          const flow = await authorization();
          const results = await Promise.all([exchange(flow), exchange(flow)]);
          assert.equal(results.filter((r) => r.status === 200).length, 1);
        },
      );
      await t.test(
        'protocol records are encrypted and consumption is atomic',
        async () => {
          const Adapter = encryptedAdapter(redis, config.encryptionKey);
          const adapter = new Adapter('Test');
          const id = randomUUID();
          await adapter.upsert(id, { privateValue: 'secret-test-value' }, 60);
          assert.equal(
            (await adapter.find(id)).privateValue,
            'secret-test-value',
          );
          const results = await Promise.allSettled([
            adapter.consume(id),
            adapter.consume(id),
          ]);
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          await adapter.destroy(id);
          assert.equal(await adapter.find(id), undefined);
        },
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await redis.quit();
      if (oldEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = oldEnv;
    }
  },
);
