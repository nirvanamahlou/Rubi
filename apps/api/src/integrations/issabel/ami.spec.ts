import { createServer, type Server, type Socket } from 'node:net';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AmiClient, AmiParser, encodeAction } from './ami';
import { issabelOptions } from './config';
import { normalizeIssabelEvent } from './events';
import { validateTelephonyEvent } from '../telephony.validation';

describe('Issabel AMI transport and facts', () => {
  let server: Server | undefined,
    peer: Socket | undefined,
    client: AmiClient | undefined;
  afterEach(async () => {
    client?.close();
    peer?.destroy();
    if (server?.listening)
      await new Promise<void>((done) => server!.close(() => done()));
  });
  it('decodes fragmented/coalesced frames, repeated variables and rejects ambiguous/oversized frames', () => {
    const parser = new AmiParser();
    expect(
      parser.push(Buffer.from('Asterisk Call Manager/5.0\r\nResponse: Suc')),
    ).toEqual([]);
    expect(
      parser.push(
        Buffer.from(
          'cess\r\nActionID: one\r\n\r\nEvent: UserEvent\r\nVariable: a\r\nVariable: b\r\n\r\n',
        ),
      ),
    ).toEqual([
      { response: 'Success', actionid: 'one' },
      { event: 'UserEvent', variable: 'b' },
    ]);
    expect(() =>
      new AmiParser().push(
        Buffer.from('Event: Hangup\r\nEvent: UserEvent\r\n\r\n'),
      ),
    ).toThrow();
    expect(() =>
      new AmiParser().push(Buffer.from('x'.repeat(65537))),
    ).toThrow();
    expect(() =>
      encodeAction('Originate', 'one', { Exten: '123\r\nAction: Command' }),
    ).toThrow();
  });
  it('authenticates with a fake PBX, correlates actions and never replays an ambiguous originate', async () => {
    const received: Record<string, string>[] = [];
    server = createServer((socket) => {
      peer = socket;
      socket.write('Asterisk Call Manager/5.0\r\n');
      const parser = new AmiParser();
      socket.on('data', (data: Buffer) => {
        for (const message of parser.push(data)) {
          received.push(message);
          if (message.action === 'Originate') {
            socket.destroy();
            continue;
          }
          socket.write(
            `Response: Success\r\nActionID: ${message.actionid}\r\n\r\n`,
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
    expect(client.connected).toBe(true);
    await client.ping();
    await expect(
      client.originate(
        'one',
        '101',
        '09120000001',
        'nora-erp-outbound',
        'PJSIP',
      ),
    ).rejects.toThrow('AMI_OUTCOME_UNKNOWN');
    expect(received.filter((r) => r.action === 'Originate')).toHaveLength(1);
    expect(received.find((r) => r.action === 'Originate')).toMatchObject({
      channel: 'PJSIP/101',
      exten: '09120000001',
      async: 'true',
    });
    expect(client.connected).toBe(false);
  });
  it('defaults disabled, enforces secure configuration and disallows non-loopback cleartext', () => {
    expect(issabelOptions(new ConfigService({}))).toBeNull();
    const config = {
      ISSABEL_ENABLED: 'true',
      ISSABEL_CONNECTION_ID: '11111111-1111-4111-8111-111111111111',
      ISSABEL_AMI_HOST: 'pbx.example',
      ISSABEL_AMI_USERNAME: 'erp',
      ISSABEL_AMI_SECRET: 'private',
      ISSABEL_ALLOWED_PREFIXES: '09',
    };
    expect(issabelOptions(new ConfigService(config))).toMatchObject({
      tls: true,
      port: 5039,
      prefixes: ['09'],
    });
    expect(() =>
      issabelOptions(
        new ConfigService({ ...config, ISSABEL_AMI_TLS: 'false' }),
      ),
    ).toThrow();
    expect(() =>
      issabelOptions(
        new ConfigService({
          ...config,
          ISSABEL_OUTBOUND_CONTEXT: 'from-internal\r\nCommand',
        }),
      ),
    ).toThrow();
  });
  it('uses explicit root/leg facts and never treats arbitrary native channel/IVR events as a human answer or whole-call end', () => {
    const c = '11111111-1111-4111-8111-111111111111';
    for (const event of ['Hangup', 'Newstate', 'BridgeEnter'])
      expect(normalizeIssabelEvent(c, { event })).toBeNull();
    const fact = {
      event: 'UserEvent',
      userevent: 'NoraCall',
      schemaversion: '1',
      kind: 'RINGING',
      direction: 'IN',
      externalcallid: '1792490000.2',
      rootcallid: '1792490000.1',
      occurredat: String(Math.floor(Date.now() / 1000)),
      caller: 'WITHHELD',
      extension: '101',
      terminalforcall: '0',
    };
    const event = normalizeIssabelEvent(c, fact)!;
    expect(event.caller).toEqual({ kind: 'WITHHELD', value: null });
    expect(event.externalEventId).toBe(
      normalizeIssabelEvent(c, fact)!.externalEventId,
    );
    expect(
      validateTelephonyEvent(event, {
        maxAgeSeconds: 3600,
        maxFutureSeconds: 120,
      }),
    ).toEqual(event);
    expect(() =>
      validateTelephonyEvent(
        normalizeIssabelEvent(c, { ...fact, terminalforcall: '1' }),
        { maxAgeSeconds: 3600, maxFutureSeconds: 120 },
      ),
    ).toThrow();
    expect(() =>
      normalizeIssabelEvent(c, { ...fact, schemaversion: '2' }),
    ).toThrow();
    expect(() =>
      normalizeIssabelEvent(c, { ...fact, extension: '101&Command' }),
    ).toThrow();
  });
});
