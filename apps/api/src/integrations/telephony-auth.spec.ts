import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { TelephonyWorkerGuard } from './telephony.controller';
describe('telephony machine authentication', () => {
  const context = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as never;
  it('fails closed with absent, malformed, wrong and multibyte credentials', () => {
    const guard = new TelephonyWorkerGuard(
      new ConfigService({ TELEPHONY_WORKER_SECRET: 'x'.repeat(32) }),
    );
    for (const header of [
      undefined,
      'Bearer bad',
      'Bearer ' + 'ی'.repeat(32),
      'Bearer ' + 'y'.repeat(32),
    ])
      expect(() => guard.canActivate(context(header))).toThrow();
    expect(guard.canActivate(context('Bearer ' + 'x'.repeat(32)))).toBe(true);
    expect(() =>
      new TelephonyWorkerGuard(new ConfigService({})).canActivate(context()),
    ).toThrow();
  });
});
