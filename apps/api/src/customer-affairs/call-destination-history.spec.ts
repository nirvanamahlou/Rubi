import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CallCenterService } from './call-center.service';
import { CallCenterTelephonyService } from './call-center-telephony.service';
import type { TelephonyEventV1 } from '@nora/contracts';

const at = '2026-10-25T10:00:00Z';
const call = { id: 'call', direction: 'OUTBOUND', origin: 'TELEPHONY' };
const recipient = {
  extension: '105',
  label: 'Expert Sales - Synthetic Person - 105',
  shared: false,
  answeredAt: at,
};
function setup(
  technical: unknown = {
    first: { direction: 'OUT', extension: '105', occurredAt: at },
  },
) {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'session',
      connectionId: 'pbx',
      callId: 'call',
      encryptedTechnical: technical,
      keyVersion: 1,
    },
  ]);
  const resolve = vi.fn().mockResolvedValue(recipient);
  const service = new CallCenterService(
    { client: { callCenterTelephonySession: { findMany } } } as never,
    { decrypt: (value: unknown) => value } as never,
    {} as never,
    { resolve } as never,
  );
  return { service, resolve, findMany };
}
describe('legacy outbound destination display', () => {
  it('keeps contact search enrichment inside its read transaction', async () => {
    const { service, findMany, resolve } = setup();
    const tx = { callCenterTelephonySession: { findMany } };
    await service.hydrateDestinations('branch', [call], tx as never);
    expect(resolve).toHaveBeenCalledWith('branch', '105', at, tx, 'pbx');
  });
  it('uses authenticated branch and provider extension without inventing an answer or mutating the call', async () => {
    const { service, findMany, resolve } = setup();
    const result = await service.hydrateDestinations('branch', [call]);
    expect(result[0]?.answerRecipient).toEqual({
      ...recipient,
      answeredAt: null,
      observedAt: at,
      labelSource: 'CURRENT_DIRECTORY',
    });
    expect(call).not.toHaveProperty('answerRecipient');
    expect(findMany).toHaveBeenCalledWith({
      where: {
        call: { contact: { branchId: 'branch' } },
        callId: { in: ['call'] },
      },
    });
    expect(resolve).toHaveBeenCalledWith('branch', '105', at, undefined, 'pbx');
  });
  it('preserves recorded historical identity and ignores manual records', async () => {
    const { service, findMany } = setup();
    const rows = [
      { ...call, answerRecipient: recipient },
      { ...call, id: 'manual', origin: 'MANUAL' },
    ];
    expect(await service.hydrateDestinations('branch', rows)).toEqual(rows);
    expect(findMany).not.toHaveBeenCalled();
  });
  it('displays a single trusted inbound ring destination without creating an answer', async () => {
    const ringAt = '2026-10-25T10:00:12Z';
    const { service, resolve } = setup({
      first: { direction: 'IN', extension: null, occurredAt: at },
      destinations: [{ extension: '369', queue: null, at: ringAt }],
    });
    resolve.mockResolvedValue({ ...recipient, extension: '369' });
    const inbound = { ...call, direction: 'INBOUND' };
    expect(
      (await service.hydrateDestinations('branch', [inbound]))[0]
        ?.answerRecipient,
    ).toMatchObject({ extension: '369', answeredAt: null, observedAt: ringAt });
    expect(resolve).toHaveBeenCalledWith(
      'branch',
      '369',
      ringAt,
      undefined,
      'pbx',
    );
    expect(inbound).not.toHaveProperty('answerRecipient');
  });
  it.each([
    { destinations: [] },
    { destinations: [{ extension: null, at }] },
    {
      destinations: [
        { extension: '105', at },
        { extension: '106', at },
      ],
    },
  ])(
    'does not guess an inbound destination from a queue or multiple agents: %j',
    async ({ destinations }) => {
      const { service, resolve } = setup({
        first: { direction: 'IN', extension: null, occurredAt: at },
        destinations,
      });
      const inbound = { ...call, direction: 'INBOUND', operator: 'داخلی 105' };
      expect(await service.hydrateDestinations('branch', [inbound])).toEqual([
        inbound,
      ]);
      expect(resolve).not.toHaveBeenCalled();
    },
  );
  it('prefers the actual answer over earlier ringing agents', async () => {
    const { service, resolve } = setup({
      first: { direction: 'IN', extension: null, occurredAt: at },
      destinations: [
        { extension: '106', at },
        { extension: '105', at },
      ],
      lastAnswer: { extension: '105', at },
    });
    expect(
      (
        await service.hydrateDestinations('branch', [
          { ...call, direction: 'INBOUND' },
        ])
      )[0]?.answerRecipient,
    ).toMatchObject({ extension: '105', answeredAt: at });
    expect(resolve).toHaveBeenCalledWith('branch', '105', at, undefined, 'pbx');
  });
  it('does not use an editable operator field when provider extension is unknown', async () => {
    const { service, resolve } = setup({
      first: { direction: 'OUT', extension: '', occurredAt: at },
    });
    const row = { ...call, operator: 'داخلی 105' };
    expect(await service.hydrateDestinations('branch', [row])).toEqual([row]);
    expect(resolve).not.toHaveBeenCalled();
  });
  it('does not replace a generic historical snapshot with a conflicting call leg', async () => {
    const { service, resolve } = setup();
    const row = {
      ...call,
      answerRecipient: { ...recipient, extension: '999', label: 'داخلی 999' },
    };
    expect(await service.hydrateDestinations('branch', [row])).toEqual([row]);
    expect(resolve).not.toHaveBeenCalled();
  });
  it('keeps all people on a shared extension rather than choosing an owner', async () => {
    const { service, resolve } = setup();
    resolve.mockResolvedValue({
      ...recipient,
      shared: true,
      label: 'Synthetic A / Synthetic B',
    });
    expect(
      (await service.hydrateDestinations('branch', [call]))[0]?.answerRecipient,
    ).toMatchObject({ shared: true, label: 'Synthetic A / Synthetic B' });
  });
});

it('snapshots an outbound originator at ringing time without marking the call answered', async () => {
  const create = vi.fn();
  const createSession = vi.fn().mockImplementation(async ({ data }) => data);
  const tx = {
    $queryRaw: vi.fn(),
    callCenterTelephonySession: {
      findUnique: async () => null,
      create: createSession,
    },
    callCenterContact: {
      upsert: async () => ({ id: 'contact' }),
      updateMany: vi.fn(),
    },
    callCenterCall: { findMany: async () => [], create },
  };
  const service = new CallCenterTelephonyService(
    {} as never,
    {
      fingerprint: () => 'fingerprint',
      encrypt: (value: unknown) => value,
      keyVersion: 1,
    } as never,
    {} as never,
    {} as never,
    { resolve: async () => recipient } as never,
  );
  await service.project(
    tx as never,
    {
      connectionId: 'pbx',
      externalCallId: 'root',
      rootCallId: null,
      legId: null,
      kind: 'RINGING',
      direction: 'OUT',
      extension: '105',
      occurredAt: at,
      sequence: null,
      caller: { kind: 'KNOWN', value: '2025550100' },
      destination: { kind: 'KNOWN', value: '2025550101' },
    } as TelephonyEventV1,
    {
      branchId: 'branch',
      creatorId: 'actor',
      synthetic: false,
      receivedAt: new Date(at),
      recipient: null,
    },
  );
  expect(
    create.mock.calls[0]?.[0].data.encryptedPayload.answerRecipient,
  ).toEqual({ ...recipient, answeredAt: null, observedAt: at });
  expect(
    createSession.mock.calls[0]?.[0].data.encryptedTechnical,
  ).not.toHaveProperty('answered');
  expect(
    createSession.mock.calls[0]?.[0].data.encryptedTechnical,
  ).not.toHaveProperty('lastAnswer');
});
