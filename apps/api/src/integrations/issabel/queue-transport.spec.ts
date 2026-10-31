import { createServer, type Server, type Socket } from 'node:net';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { AmiClient, AmiParser, type AmiMessage } from './ami';

describe('read-only QueueStatus over TCP', () => {
  let server: Server, peer: Socket, client: AmiClient;
  const actions: string[] = [];
  async function connect(reply: (socket: Socket, message: AmiMessage) => void) {
    actions.length = 0;
    server = createServer((socket) => {
      peer = socket;
      const parser = new AmiParser();
      socket.on('data', (bytes: Buffer) => {
        for (const m of parser.push(bytes)) {
          actions.push(m.action!);
          if (m.action === 'QueueStatus') reply(socket, m);
          else
            socket.write(
              `Response: Success\r\nActionID: ${m.actionid}\r\n\r\n`,
            );
        }
      });
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw Error();
    client = new AmiClient();
    await client.connect({
      host: '127.0.0.1',
      port: address.port,
      tls: false,
      username: 'test',
      secret: 'synthetic-only',
    });
  }
  afterEach(async () => {
    client?.close();
    peer?.destroy();
    if (server?.listening)
      await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it('correlates coalesced list before promise continuations without dialing or retaining callers', async () => {
    await connect((socket, m) =>
      socket.write(
        `Response: Success\r\nActionID: ${m.actionid}\r\n\r\n` +
          `Event: QueueParams\r\nQueue: 1002\r\nActionID: ${m.actionid}\r\n\r\n` +
          `Event: QueueMember\r\nQueue: 1002\r\nLocation: Local/110@from-queue/n\r\nStatus: 1\r\nInCall: 0\r\nPaused: 0\r\nLastCall: 0\r\nWrapuptime: 0\r\nActionID: ${m.actionid}\r\n\r\n` +
          `Event: QueueStatusComplete\r\nListItems: 2\r\nActionID: ${m.actionid}\r\n\r\n`,
      ),
    );
    expect(await client.queueSnapshot('1002', 0)).toMatchObject({
      queue: '1002',
      members: [{ extension: '110', available: true }],
    });
    expect(actions).toEqual(['Login', 'QueueStatus']);
    expect(client.listenerCount('event')).toBe(0);
  });
  it.each(['silent', 'incomplete', 'rejected', 'disconnect'])(
    'fails closed on %s and cleans listeners',
    async (mode) => {
      await connect((socket, m) => {
        if (mode === 'disconnect') socket.destroy();
        if (mode === 'incomplete')
          socket.write(`Response: Success\r\nActionID: ${m.actionid}\r\n\r\n`);
        if (mode === 'rejected')
          socket.write(`Response: Error\r\nActionID: ${m.actionid}\r\n\r\n`);
      });
      const first = client.queueSnapshot('1002', 0);
      expect(await client.queueSnapshot('1002', 0)).toBeNull();
      expect(await first).toBeNull();
      expect(client.listenerCount('event')).toBe(0);
      expect(client.listenerCount('disconnected')).toBe(0);
      if (mode !== 'disconnect') {
        expect(client.connected).toBe(true);
        await client.ping();
      }
      expect(actions.filter((a) => a === 'QueueStatus')).toHaveLength(1);
    },
  );
  it('rejects invalid queue before sending', async () => {
    await connect(() => {});
    expect(await client.queueSnapshot('1002\r\nAction: Command', 0)).toBeNull();
    expect(actions).toEqual(['Login']);
  });
});
