import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { errors } from 'oidc-provider';

export function encryptedAdapter(redis, secret) {
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32)
    throw Error('A persistent 32-byte encryption key is required');
  const prefix = 'nora-oidc:v1:';
  const name = (model, id) =>
    prefix + createHash('sha256').update(`${model}:${id}`).digest('hex');
  const encode = (value) => {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const bytes = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([nonce, cipher.getAuthTag(), bytes]).toString(
      'base64',
    );
  };
  const decode = (value) => {
    const bytes = Buffer.from(value, 'base64');
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString(),
    );
  };
  return class Adapter {
    constructor(model) {
      this.model = model;
    }
    async upsert(id, payload, expiresIn = 900) {
      if (this.model === 'Client') throw Error('Dynamic clients are disabled');
      const ttl = Math.min(Math.max(Math.ceil(expiresIn), 1), 1800);
      const record = name(this.model, id);
      const transaction = redis
        .multi()
        .hset(record, 'data', encode(payload))
        .expire(record, ttl);
      if (payload.uid)
        transaction.set(
          name(`${this.model}:uid`, payload.uid),
          encode(id),
          'EX',
          ttl,
        );
      if (payload.userCode)
        transaction.set(
          name(`${this.model}:userCode`, payload.userCode),
          encode(id),
          'EX',
          ttl,
        );
      if (payload.grantId)
        transaction
          .sadd(name('grant-members', payload.grantId), record)
          .expire(name('grant-members', payload.grantId), 1800);
      const result = await transaction.exec();
      if (!result || result.some(([error]) => error))
        throw Error('Protocol storage failed');
    }
    async find(id) {
      if (this.model === 'Client') return undefined;
      const row = await redis.hgetall(name(this.model, id));
      if (!row.data) return undefined;
      const payload = decode(row.data);
      if (row.consumed) payload.consumed = Number(row.consumed);
      return payload;
    }
    async findByUid(uid) {
      const id = await redis.get(name(`${this.model}:uid`, uid));
      return id ? this.find(decode(id)) : undefined;
    }
    async findByUserCode(code) {
      const id = await redis.get(name(`${this.model}:userCode`, code));
      return id ? this.find(decode(id)) : undefined;
    }
    async consume(id) {
      const consumed = await redis.eval(
        `if redis.call('EXISTS',KEYS[1])==0 then return 0 end
        if redis.call('HEXISTS',KEYS[1],'consumed')==1 then return 0 end
        redis.call('HSET',KEYS[1],'consumed',ARGV[1]); return 1`,
        1,
        name(this.model, id),
        String(Math.floor(Date.now() / 1000)),
      );
      if (consumed !== 1)
        throw new errors.InvalidGrant('Protocol artifact already consumed');
    }
    async destroy(id) {
      await redis.del(name(this.model, id));
    }
    async revokeByGrantId(id) {
      const set = name('grant-members', id);
      const keys = await redis.smembers(set);
      await redis.del(set, name('GrantBinding', id), ...keys);
    }
  };
}
