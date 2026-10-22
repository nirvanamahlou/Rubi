import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import type { TelephonyEventV1 } from '@nora/contracts';
import { describe, expect, it } from 'vitest';
import { normalizeNativeQueueEvent, answeredExtension } from './native-events';
import { issabelOptions } from './config';
import net from 'node:net';
import { AmiParser } from './ami';
import { IssabelService } from './issabel.service';

const connection = '11111111-1111-4111-8111-111111111111';
const root = '1792570000.1';
const base = {
  uniqueid: root,
  linkedid: root,
  queue: 'sales-test',
  calleridnum: '+12025550123',
};
const setup = () => {
  const receipts = new Map<string, TelephonyEventV1>();
  const lookup = async (id: string) => receipts.get(id) ?? null;
  const receive = async (event: string, patch: Record<string, string> = {}) => {
    const result = await normalizeNativeQueueEvent(
      connection,
      { ...base, event, ...patch },
      ['sales-test'],
      lookup,
    );
    if (result) receipts.set(result.externalEventId, result);
    return result;
  };
  return { receipts, lookup, receive };
};
describe('native queue capture', () => {
  it('does not replace missing external caller name with an agent name', async () => {
    const { receive } = setup();
    await receive('QueueCallerJoin');
    expect(
      (
        await receive('AgentCalled', {
          calleridname: 'Agent name',
          destuniqueid: 'agent-leg',
        })
      )?.callerName,
    ).toBeUndefined();
  });
  it('preserves incoming caller name across agent legs', async () => {
    const { receive } = setup();
    expect(
      (await receive('QueueCallerJoin', { calleridname: 'شرکت نمونه' }))
        ?.callerName,
    ).toBe('شرکت نمونه');
    expect(
      (
        await receive('AgentCalled', {
          calleridname: 'Agent name',
          destuniqueid: 'leg-2',
        })
      )?.callerName,
    ).toBe('شرکت نمونه');
  });
  it('uses explicit abandonment evidence and never infers no answer from an isolated hangup', async () => {
    const { receive } = setup();
    await receive('QueueCallerJoin');
    expect((await receive('Hangup'))?.endReason).toBe('UNKNOWN');
    const abandoned = await receive('QueueCallerAbandon');
    expect(abandoned).toMatchObject({
      kind: 'ENDED',
      endReason: 'NO_ANSWER',
      terminalForCall: false,
    });
    expect(await receive('QueueCallerAbandon')).toEqual(abandoned);
    expect(await receive('QueueCallerAbandon', { queue: 'other' })).toBeNull();
  });
  it('learns only observed answered Interface and preserves multiple answered transfer legs', async () => {
    expect(
      answeredExtension({
        ...base,
        event: 'AgentCalled',
        interface: 'Local/105@from-queue/n',
      }),
    ).toBeNull();
    for (const value of [
      '105',
      'Local/105@other/n',
      'SIP/105',
      'Local/105@from-queue/n;bad',
    ])
      expect(
        answeredExtension({
          ...base,
          event: 'AgentConnect',
          interface: value,
          membername: '105',
          destexten: '105',
        }),
      ).toBeNull();
    const { receive, receipts } = setup();
    await receive('QueueCallerJoin');
    const a = await receive('AgentConnect', {
      destuniqueid: 'leg-one',
      interface: 'Local/105@from-queue/n',
    });
    expect(a?.extension).toBe('105');
    expect(
      await receive('AgentConnect', {
        destuniqueid: 'leg-one',
        interface: 'Local/110@from-queue/n',
      }),
    ).toEqual(a);
    const b = await receive('AgentConnect', {
      destuniqueid: 'leg-two',
      interface: 'Local/110@from-queue/n',
    });
    expect(b?.extension).toBe('110');
    expect(b?.externalEventId).not.toBe(a?.externalEventId);
    expect(
      [...receipts.values()].filter((e) => e.kind === 'ANSWERED'),
    ).toHaveLength(2);
  });
  it('wires native socket frames into canonical ingress without sending outbound actions', async () => {
    const receipts = new Map<string, TelephonyEventV1>();
    const actions: string[] = [];
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      const parser = new AmiParser();
      socket.on('data', (bytes) => {
        for (const action of parser.push(
          Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
        )) {
          actions.push(action.action!);
          socket.write(
            `Response: Success\r\nActionID: ${action.actionid}\r\n\r\n`,
          );
          if (action.action === 'Login') {
            for (const event of ['QueueCallerJoin', 'AgentConnect', 'Hangup']) {
              socket.write(
                Object.entries({ ...base, event, destuniqueid: root + '.2' })
                  .map(([k, v]) => `${k}: ${v}\r\n`)
                  .join('') + '\r\n',
              );
            }
          }
        }
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.address() as net.AddressInfo).port;
    const service = new IssabelService(
      {
        client: {
          integrationTelephonyInbox: { findFirst: async () => null },
          integrationTelephonyAudit: {
            findFirst: async () => null,
            create: async () => ({}),
          },
          integrationTelephonyConnection: {
            findUnique: async () => ({
              id: connection,
              active: true,
              synthetic: false,
            }),
          },
        },
      } as never,
      new ConfigService({
        ISSABEL_ENABLED: 'true',
        ISSABEL_CONNECTION_ID: connection,
        ISSABEL_EVENT_MODE: 'NATIVE_QUEUE_CAPTURE',
        ISSABEL_INBOUND_QUEUES: 'sales-test',
        ISSABEL_AMI_HOST: '127.0.0.1',
        ISSABEL_AMI_PORT: String(port),
        ISSABEL_AMI_TLS: 'false',
        ISSABEL_AMI_USERNAME: 'test',
        ISSABEL_AMI_SECRET: 'test-only',
      }),
      {} as never,
      {} as never,
      {
        acceptedEvent: async (_connection: string, id: string) =>
          receipts.get(id) ?? null,
        receive: async (event: TelephonyEventV1) => {
          receipts.set(event.externalEventId, event);
        },
      } as never,
      {} as never,
    );
    try {
      service.onModuleInit();
      const deadline = Date.now() + 5000;
      while (receipts.size < 3 && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 20));
      expect([...receipts.values()].map((e) => e.kind)).toEqual([
        'RINGING',
        'ANSWERED',
        'ENDED',
      ]);
      expect([...receipts.values()].every((e) => e.extension === null)).toBe(
        true,
      );
      expect(actions).toContain('Login');
      expect(
        actions.every((action) => ['Login', 'Ping'].includes(action)),
      ).toBe(true);
    } finally {
      await service.onModuleDestroy();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it('captures one root across member rings and answer without exposing a popup recipient', async () => {
    const { receive } = setup();
    const start = await receive('QueueCallerJoin');
    expect(start).toMatchObject({
      kind: 'RINGING',
      direction: 'IN',
      extension: null,
      rootCallId: root,
    });
    for (const destuniqueid of ['1792570000.2', '1792570000.3'])
      expect(await receive('AgentCalled', { destuniqueid })).toMatchObject({
        rootCallId: root,
        legId: destuniqueid,
        extension: null,
      });
    expect(
      await receive('AgentConnect', { destuniqueid: '1792570000.3' }),
    ).toMatchObject({ kind: 'ANSWERED', extension: null });
    expect(await receive('Hangup', { uniqueid: '1792570000.2' })).toBeNull();
    expect(await receive('Hangup')).toMatchObject({
      kind: 'ENDED',
      terminalForCall: true,
      endReason: 'COMPLETED',
    });
  });
  it('ignores unrelated queues, direct/internal channels, IVR Up and unanchored ends', async () => {
    const { receive } = setup();
    for (const event of [
      'Newchannel',
      'Newstate',
      'DialBegin',
      'BridgeEnter',
      'Hangup',
      'AgentConnect',
    ])
      expect(await receive(event, { channelstatedesc: 'Up' })).toBeNull();
    expect(
      await receive('QueueCallerJoin', { queue: 'support-test' }),
    ).toBeNull();
    expect(await receive('QueueCallerJoin', { linkedid: '' })).toBeNull();
  });
  it('uses persisted first receipt across restart/retry and keeps unknown fields honest', async () => {
    const { receive, lookup } = setup();
    const start = await receive('QueueCallerJoin', {
      calleridnum: 'anonymous',
    });
    const duplicate = await normalizeNativeQueueEvent(
      connection,
      { ...base, event: 'QueueCallerJoin' },
      ['sales-test'],
      lookup,
      new Date(Date.now() + 30000),
    );
    expect(duplicate).toEqual(start);
    expect(start).toMatchObject({
      caller: { kind: 'WITHHELD', value: null },
      companyLine: null,
      destination: { kind: 'UNKNOWN', value: null },
    });
    expect(await receive('Hangup')).toMatchObject({ endReason: 'UNKNOWN' });
  });
  it('uses source time only if supplied and valid, otherwise reception time', async () => {
    const { lookup } = setup();
    const receivedAt = new Date('2026-10-21T10:00:00Z');
    const input = { ...base, event: 'QueueCallerJoin' };
    expect(
      (
        await normalizeNativeQueueEvent(
          connection,
          input,
          ['sales-test'],
          lookup,
          receivedAt,
        )
      )?.occurredAt,
    ).toBe(receivedAt.toISOString());
    expect(
      (
        await normalizeNativeQueueEvent(
          connection,
          { ...input, timestamp: '1792570000.123' },
          ['sales-test'],
          lookup,
        )
      )?.occurredAt,
    ).toBe(new Date(1792570000123).toISOString());
    await expect(
      normalizeNativeQueueEvent(
        connection,
        { ...input, timestamp: 'invalid' },
        ['sales-test'],
        lookup,
      ),
    ).rejects.toThrow();
  });
  it('requires an explicit queue allowlist and keeps production plaintext closed', () => {
    const env = {
      NODE_ENV: 'development',
      ISSABEL_ENABLED: 'true',
      ISSABEL_EVENT_MODE: 'NATIVE_QUEUE_CAPTURE',
      ISSABEL_CONNECTION_ID: connection,
      ISSABEL_AMI_HOST: '192.168.50.10',
      ISSABEL_AMI_PORT: '5038',
      ISSABEL_AMI_TLS: 'false',
      ISSABEL_AMI_USERNAME: 'test',
      ISSABEL_AMI_SECRET: 'test-only',
      ISSABEL_COMPANY_NETWORK: 'true',
      ISSABEL_INBOUND_QUEUES: 'sales-test',
    };
    expect(issabelOptions(new ConfigService(env))).toMatchObject({
      nativeCapture: true,
      prefixes: [],
      inboundQueues: ['sales-test'],
    });
    for (const patch of [
      { ISSABEL_INBOUND_QUEUES: '' },
      { ISSABEL_INBOUND_QUEUES: '*' },
      { NODE_ENV: 'production' },
      { ISSABEL_COMPANY_NETWORK: 'false' },
      { ISSABEL_AMI_HOST: 'example.com' },
      { ISSABEL_EVENT_MODE: 'typo' },
    ])
      expect(() =>
        issabelOptions(new ConfigService({ ...env, ...patch })),
      ).toThrow();
  });
});
