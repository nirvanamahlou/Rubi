import 'reflect-metadata';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReservationMailService } from './reservation-mail.service';

function fixture(
  transaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({ $queryRaw: vi.fn().mockResolvedValue([]) }),
  ),
) {
  type D = ConstructorParameters<typeof ReservationMailService>;
  const service = new ReservationMailService(
    { client: { $transaction: transaction } } as unknown as D[0],
    {} as D[1],
    {} as D[2],
    {} as D[3],
  );
  return { service, transaction };
}
beforeEach(() => {
  vi.useFakeTimers();
  for (const [k, v] of Object.entries({
    RESERVATION_MAIL_ENABLED: 'true',
    RESERVATION_MAIL_KEY_BASE64: Buffer.alloc(32, 1).toString('base64'),
    RESERVATION_SMTP_HOST: 'smtp.example.test',
    RESERVATION_SMTP_PORT: '465',
    RESERVATION_SMTP_TLS: 'implicit',
    RESERVATION_SMTP_USER: 'synthetic',
    RESERVATION_SMTP_PASSWORD: 'synthetic',
    RESERVATION_MAIL_FROM: 'erp@example.test',
    RESERVATION_MAIL_FROM_NAME: 'Synthetic',
    RESERVATION_MAIL_REPLY_TO: 'erp@example.test',
  }))
    vi.stubEnv(k, v);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('coalesces committed wake requests and starts on the next event-loop turn instead of the five-second poll', async () => {
  const { service } = fixture();
  const sweep = vi.spyOn(service, 'sweep').mockResolvedValue();
  for (let i = 0; i < 100; i++) service.wake();
  expect(sweep).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(0);
  expect(sweep).toHaveBeenCalledOnce();
  service.onModuleDestroy();
});
it('remembers a wake received during an active sweep without overlapping claims', async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const transaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
    if (++calls === 1) await held;
    return cb({ $queryRaw: vi.fn().mockResolvedValue([]) });
  });
  const { service } = fixture(transaction);
  service.wake();
  await vi.advanceTimersByTimeAsync(0);
  expect(transaction).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 100; i++) service.wake();
  await vi.advanceTimersByTimeAsync(1);
  expect(transaction).toHaveBeenCalledTimes(1);
  release();
  await vi.runAllTimersAsync();
  expect(transaction).toHaveBeenCalledTimes(4);
  service.onModuleDestroy();
});
it('does no work when mail is disabled and cancels pending wakes on shutdown', async () => {
  const { service, transaction } = fixture();
  vi.stubEnv('RESERVATION_MAIL_ENABLED', 'false');
  service.wake();
  await vi.runAllTimersAsync();
  expect(transaction).not.toHaveBeenCalled();
  vi.stubEnv('RESERVATION_MAIL_ENABLED', 'true');
  service.wake();
  service.onModuleDestroy();
  await vi.runAllTimersAsync();
  service.wake();
  await vi.runAllTimersAsync();
  expect(transaction).not.toHaveBeenCalled();
});
it('keeps five-second recovery polling without increasing idle database traffic', async () => {
  const { service } = fixture();
  const sweep = vi.spyOn(service, 'sweep').mockResolvedValue();
  service.onModuleInit();
  await vi.advanceTimersByTimeAsync(0);
  expect(sweep).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(4999);
  expect(sweep).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(2);
  expect(sweep).toHaveBeenCalledTimes(2);
  service.onModuleDestroy();
});
it('drains due rows serially before another poll and stops when the queue is empty', async () => {
  let remaining = 2;
  const claim = vi.fn(() =>
    remaining-- > 0
      ? [
          {
            id: 'synthetic-mail',
            envelope: 'never decrypted for cancelled intake',
            actorUserId: 'actor',
            attempts: 1,
            intakeId: 'intake',
          },
        ]
      : [],
  );
  const tx = {
    $queryRaw: vi.fn(async (sql: { strings: readonly string[] }) =>
      sql.strings.join('').includes('WITH candidate') ? claim() : [],
    ),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx));
  type D = ConstructorParameters<typeof ReservationMailService>;
  const service = new ReservationMailService(
    {
      client: {
        $transaction: transaction,
        reservationWorkflowRevision: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ state: { supplierStatus: 'CANCELLED' } }),
        },
      },
    } as unknown as D[0],
    {} as D[1],
    {} as D[2],
    { createWithinTransaction: vi.fn() } as unknown as D[3],
  );
  service.wake();
  await vi.runAllTimersAsync();
  expect(claim).toHaveBeenCalledTimes(3);
  expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
  service.onModuleDestroy();
});
