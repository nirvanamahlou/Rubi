import 'reflect-metadata';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import type { TelephonyEventV1 } from '@nora/contracts';
import { AmiParser } from './ami';
import { IssabelService } from './issabel.service';
import { AmiContinuity } from './continuity';

const connectionId = '11111111-1111-4111-8111-111111111111';
const waitFor = async (check: () => boolean) => {
  const until = Date.now() + 8000;
  while (!check() && Date.now() < until)
    await new Promise((resolve) => setTimeout(resolve, 15));
  expect(check()).toBe(true);
};
async function fixture() {
  const receipts = new Map<string, TelephonyEventV1>();
  const audits: Array<{
    id: string;
    action: string;
    metadata: unknown;
    createdAt: Date;
  }> = [];
  const actions: string[] = [];
  const sockets: net.Socket[] = [];
  let active = true;
  let failures = 0;
  let hold: Promise<void> | undefined;
  const db = {
    client: {
      integrationTelephonyInbox: { findFirst: async () => null },
      integrationTelephonyConnection: {
        findUnique: async () => ({
          id: connectionId,
          synthetic: false,
          active,
        }),
      },
      integrationTelephonyAudit: {
        create: async ({
          data,
        }: {
          data: { action: string; metadata: unknown };
        }) => {
          const row = { ...data, id: randomUUID(), createdAt: new Date() };
          audits.push(row);
          return row;
        },
        findFirst: async ({
          where,
        }: {
          where: { action: string | { in: string[] } };
        }) =>
          [...audits]
            .reverse()
            .find((r) =>
              typeof where.action === 'string'
                ? r.action === where.action
                : where.action.in.includes(r.action),
            ) ?? null,
      },
    },
  };
  const server = net.createServer((socket) => {
    sockets.push(socket);
    const parser = new AmiParser();
    socket.on('data', (bytes) => {
      for (const action of parser.push(Buffer.from(bytes))) {
        actions.push(action.action!);
        socket.write(
          `Response: Success\r\nActionID: ${action.actionid}\r\n\r\n`,
        );
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const config = new ConfigService({
    ISSABEL_ENABLED: 'true',
    ISSABEL_CONNECTION_ID: connectionId,
    ISSABEL_EVENT_MODE: 'NATIVE_QUEUE_CAPTURE',
    ISSABEL_INBOUND_QUEUES: 'sales-test',
    ISSABEL_AMI_HOST: '127.0.0.1',
    ISSABEL_AMI_PORT: String((server.address() as net.AddressInfo).port),
    ISSABEL_AMI_TLS: 'false',
    ISSABEL_AMI_USERNAME: 'test',
    ISSABEL_AMI_SECRET: 'test-only',
  });
  const service = new IssabelService(
    db as never,
    config,
    {} as never,
    {} as never,
    {
      acceptedEvent: async (_c: string, id: string) => receipts.get(id) ?? null,
      receive: async (event: TelephonyEventV1) => {
        if (hold) await hold;
        if (failures-- > 0) throw Error('temporary');
        receipts.set(event.externalEventId, event);
      },
    } as never,
    {} as never,
  );
  const send = (
    root: string,
    event: string,
    patch: Record<string, string> = {},
  ) => {
    sockets.at(-1)!.write(
      Object.entries({
        event,
        uniqueid: root,
        linkedid: root,
        queue: 'sales-test',
        calleridnum: 'anonymous',
        ...patch,
      })
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('') + '\r\n',
    );
  };
  service.onModuleInit();
  await waitFor(() => audits.some((r) => r.action === 'AMI_CONNECTED'));
  return {
    service,
    receipts,
    audits,
    actions,
    sockets,
    db,
    send,
    failOnce: () => {
      failures = 1;
    },
    hold: (value: Promise<void>) => {
      hold = value;
    },
    deactivate: () => {
      active = false;
    },
    close: async () => {
      await service.onModuleDestroy();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
describe('AMI operational continuity', () => {
  it('isolates simultaneous roots, abandoned calls and transfer legs without assigning users', async () => {
    const f = await fixture();
    try {
      f.send('test-a', 'QueueCallerJoin');
      f.send('test-b', 'QueueCallerJoin');
      f.send('test-a', 'AgentCalled', { destuniqueid: 'a-agent1' });
      f.send('test-a', 'AgentConnect', { destuniqueid: 'a-agent1' });
      f.send('test-a', 'Hangup', { uniqueid: 'a-agent1' });
      f.send('test-a', 'AgentCalled', { destuniqueid: 'a-agent2' });
      f.send('test-b', 'Hangup');
      f.send('test-a', 'Hangup');
      f.send('test-a', 'QueueCallerJoin');
      f.send('support', 'QueueCallerJoin', { queue: 'support-test' });
      await waitFor(() => f.receipts.size === 7);
      expect(
        [...f.receipts.values()]
          .filter((e) => e.kind === 'ENDED')
          .map((e) => e.endReason)
          .sort(),
      ).toEqual(['COMPLETED', 'UNKNOWN']);
      expect(
        [...f.receipts.values()].every(
          (e) => e.extension === null && e.queue === 'sales-test',
        ),
      ).toBe(true);
      expect(f.actions.every((a) => ['Login', 'Ping'].includes(a))).toBe(true);
    } finally {
      await f.close();
    }
  });
  it('reconnects after transport loss, keeps the gap across a journal restart and deduplicates replay', async () => {
    const f = await fixture();
    try {
      f.send('test-reconnect', 'QueueCallerJoin');
      await waitFor(() => f.receipts.size === 1);
      f.sockets[0]!.destroy();
      await waitFor(() => f.audits.some((r) => r.action === 'AMI_GAP'));
      await waitFor(
        () => f.audits.filter((r) => r.action === 'AMI_CONNECTED').length === 2,
      );
      f.send('test-reconnect', 'QueueCallerJoin');
      f.send('test-reconnect', 'Hangup');
      await waitFor(() => f.receipts.size === 2);
      const restarted = new AmiContinuity(f.db as never, connectionId);
      await restarted.start();
      expect((await restarted.snapshot()).reconciliationRequired).toBe(true);
      expect(
        f.audits.some((r) =>
          JSON.stringify(r.metadata).includes('PROCESS_RESTART'),
        ),
      ).toBe(true);
      expect(JSON.stringify(f.audits)).not.toContain('test-reconnect');
    } finally {
      await f.close();
    }
  });
  it('drains an already received frame with a transient failure before acknowledging shutdown', async () => {
    const f = await fixture();
    let release!: () => void;
    try {
      f.hold(
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      f.failOnce();
      f.send('test-drain', 'QueueCallerJoin');
      await waitFor(
        () =>
          (f.service as unknown as { queuedEvents: number }).queuedEvents === 1,
      );
      let stopped = false;
      const stopping = f.service.onModuleDestroy().then(() => {
        stopped = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(stopped).toBe(false);
      release();
      await stopping;
      expect(f.receipts.size).toBe(1);
      expect(f.audits.at(-1)?.action).toBe('AMI_STOPPED');
    } finally {
      release?.();
      await f.close();
    }
  });
  it('rejects new facts after connection deactivation without changing the PBX', async () => {
    const f = await fixture();
    try {
      f.deactivate();
      f.send('test-disabled', 'QueueCallerJoin');
      await waitFor(() => f.audits.some((r) => r.action === 'AMI_GAP'));
      expect(f.receipts.size).toBe(0);
      expect(f.actions.every((a) => ['Login', 'Ping'].includes(a))).toBe(true);
    } finally {
      await f.close();
    }
  });
});
