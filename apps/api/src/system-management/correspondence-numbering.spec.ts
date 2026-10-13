import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import {
  CorrespondenceNumberingService,
  CorrespondenceNumberingController,
  correspondenceDateParts,
  validateCorrespondenceNumberInput,
} from './correspondence-numbering';
import { ACCESS_CONTROLS_KEY } from '../iam/iam.constants';

const input = {
  companyId: 'niayesh',
  date: '2026-10-12',
  idempotencyKey: 'e2f54a79-2722-413f-b85f-d3f171b015d9',
};
function setup(existing: { issuedValue: string } | null = null) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    systemNumberingScheme: {
      upsert: vi.fn().mockResolvedValue({ id: 'scheme', isActive: true }),
    },
    systemIssuedNumber: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({ id: 'issued' }),
    },
    systemNumberingSequence: {
      upsert: vi.fn().mockResolvedValue({ lastValue: 42n }),
    },
    systemAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const transaction = vi.fn(
    (operation: (value: typeof tx) => Promise<unknown>) => operation(tx),
  );
  const service = new CorrespondenceNumberingService({
    client: { $transaction: transaction },
  } as unknown as DatabaseService);
  return { tx, transaction, service };
}
describe('correspondence numbering', () => {
  it('requires authenticated correspondence screen access on the controller', () => {
    expect(
      Reflect.getMetadata('__guards__', CorrespondenceNumberingController),
    ).toHaveLength(2);
    expect(
      Reflect.getMetadata(
        ACCESS_CONTROLS_KEY,
        CorrespondenceNumberingController,
      ),
    ).toEqual(['correspondence.home']);
  });
  it('rejects impossible dates, inherited object names and malformed replay keys before writing', () => {
    for (const value of [
      { ...input, date: '2026-02-30' },
      { ...input, date: 'not-a-date' },
      { ...input, companyId: 'toString' },
      { ...input, idempotencyKey: 'short' },
    ])
      expect(() => validateCorrespondenceNumberInput(value)).toThrow();
  });
  it('respects the Tehran date and Persian year boundary', () => {
    expect(
      correspondenceDateParts(new Date('2026-10-12T12:00:00+03:30')),
    ).toEqual(['1405', '07', '20']);
    expect(correspondenceDateParts(new Date('2026-10-11T21:00:00Z'))).toEqual([
      '1405',
      '07',
      '20',
    ]);
  });
  it('allocates a date-bearing company number and audit in one transaction', async () => {
    const { service, tx } = setup();
    expect(await service.issue(input, 'actor')).toEqual({
      contract: 'correspondence.number.v1',
      number: 'NS/1405/07/20/000042',
      date: '1405/07/20',
    });
    expect(
      tx.systemIssuedNumber.create.mock.calls[0]![0].data.idempotencyKey,
    ).toBe(`actor:${input.idempotencyKey}`);
    expect(tx.systemAuditEvent.create).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });
  it('replays a lost response without consuming another sequence or changing the date', async () => {
    const { service, tx } = setup({ issuedValue: 'NS/1405/07/19/000041' });
    expect((await service.issue(input, 'actor')).number).toBe(
      'NS/1405/07/19/000041',
    );
    expect(tx.systemNumberingSequence.upsert).not.toHaveBeenCalled();
    expect(tx.systemIssuedNumber.create).not.toHaveBeenCalled();
    expect(tx.systemAuditEvent.create).not.toHaveBeenCalled();
  });
});
