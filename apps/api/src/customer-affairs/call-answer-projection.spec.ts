import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CallCenterTelephonyService } from './call-center-telephony.service';
import type { TelephonyEventV1 } from '@nora/contracts';

describe('confirmed answering recipient projection', () => {
  it('persists a server directory snapshot with the same call and keeps operator notes', async () => {
    const event = {
      schemaVersion: 1,
      connectionId: 'pbx',
      externalCallId: 'call',
      rootCallId: null,
      legId: null,
      kind: 'ANSWERED',
      direction: 'IN',
      extension: '203',
      occurredAt: '2026-10-22T10:00:00Z',
      sequence: 1,
      caller: { kind: 'KNOWN', value: '12345678' },
      destination: { kind: 'UNKNOWN', value: null },
    } as TelephonyEventV1;
    const row = {
      id: 'session',
      callId: 'call',
      encryptedTechnical: null,
      keyVersion: 1,
      completed: true,
    };
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn(),
      callCenterTelephonySession: {
        findUnique: async () => row,
        update: async () => row,
      },
      callCenterCall: {
        findUniqueOrThrow: async () => ({ id: 'call', contactId: 'contact' }),
        update,
      },
      customerAffairsAuditEvent: { findFirst: async () => ({ id: 'saved' }) },
    };
    const recipient = {
      extension: '203',
      label: 'A / B — 203',
      shared: true,
      answeredAt: event.occurredAt,
    };
    const resolve = vi.fn().mockResolvedValue(recipient);
    const service = new CallCenterTelephonyService(
      {} as never,
      {
        fingerprint: () => 'root',
        decrypt: () => null,
        encrypt: (value: unknown) => value,
        keyVersion: 1,
      } as never,
      {
        presentCall: () => ({
          phone: '12345678',
          name: 'Saved',
          subject: 'Saved subject',
          source: 'Saved source',
          note: 'Saved note',
          operator: 'Old',
        }),
      } as never,
      {} as never,
      { resolve } as never,
    );
    await service.project(tx as never, event, {
      branchId: 'branch',
      creatorId: 'actor',
      synthetic: false,
      receivedAt: new Date(),
      recipient: null,
    });
    expect(resolve).toHaveBeenCalledWith(
      'branch',
      '203',
      event.occurredAt,
      tx,
      'pbx',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'call' },
        data: expect.objectContaining({
          encryptedPayload: expect.objectContaining({
            name: 'Saved',
            note: 'Saved note',
            operator: 'داخلی 203',
            answerRecipient: recipient,
          }),
        }),
      }),
    );
  });
});
