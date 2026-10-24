import { describe, expect, it } from 'vitest';
import type { TelephonyEventV1 } from '@nora/contracts';
import { normalizeNativeOutbound } from './native-outbound';

function setup() {
  const stored = new Map<string, TelephonyEventV1>();
  const receive = async (
    extra: Record<string, string> = {},
    extensions = ['101'],
    trunks = ['SIP/trunk-test'],
  ) => {
    const event = await normalizeNativeOutbound(
      'pbx',
      {
        event: 'DialBegin',
        channel: 'SIP/101-00000001',
        destchannel: 'SIP/trunk-test-00000002',
        linkedid: 'root',
        uniqueid: 'root',
        destuniqueid: 'leg',
        dialstring: 'trunk-test/12025550123',
        ...extra,
      },
      extensions,
      trunks,
      async (id) => stored.get(id) ?? null,
      new Date('2026-10-24T07:00:00Z'),
    );
    if (event) stored.set(event.externalEventId, event);
    return event;
  };
  return { receive };
}
describe('native outbound phone calls', () => {
  it('uses the initiating extension and dialed number; preserves identity through answer and hangup', async () => {
    const { receive } = setup();
    const first = await receive();
    expect(first).toMatchObject({
      direction: 'OUT',
      extension: '101',
      kind: 'RINGING',
      destination: { value: '12025550123' },
    });
    expect(
      await receive({
        event: 'DialEnd',
        dialstatus: 'ANSWER',
        dialstring: '',
        calleridnum: '999',
      }),
    ).toMatchObject({
      kind: 'ANSWERED',
      extension: '101',
      destination: first?.destination,
    });
    expect(await receive({ event: 'Hangup', dialstring: '' })).toMatchObject({
      kind: 'ENDED',
      terminalForCall: true,
      destination: first?.destination,
    });
  });
  it('rejects internal calls, unconfigured trunks/extensions, orphan end and forwarded channels', async () => {
    for (const input of [
      { destchannel: 'SIP/102-00000002' },
      { channel: 'SIP/999-00000001' },
      { event: 'Hangup' },
      { event: 'DialEnd' },
      { uniqueid: 'forwarded' },
      { dialstring: 'trunk-test/invalid' },
    ]) {
      expect(await setup().receive(input)).toBeNull();
    }
    expect(await setup().receive({}, [], ['SIP/trunk-test'])).toBeNull();
    expect(await setup().receive({}, ['101'], [])).toBeNull();
  });
  it('deduplicates retries and ignores different trunk legs rather than inventing their identity', async () => {
    const { receive } = setup();
    const first = await receive();
    expect(await receive()).toEqual(first);
    expect(
      await receive({
        event: 'DialEnd',
        dialstatus: 'ANSWER',
        destuniqueid: 'different',
      }),
    ).toBeNull();
  });
  it('distinguishes busy/no-answer without falsely marking a successful call', async () => {
    const { receive } = setup();
    await receive();
    expect(
      await receive({ event: 'DialEnd', dialstatus: 'BUSY' }),
    ).toMatchObject({
      endReason: 'FAILED',
      kind: 'ENDED',
      terminalForCall: false,
    });
  });
  it('retains a verified fallback trunk leg without creating a second call root', async () => {
    const { receive } = setup();
    const first = await receive();
    await receive({ event: 'DialEnd', dialstatus: 'BUSY' });
    const next = await receive({ destuniqueid: 'fallback' });
    expect(next?.externalEventId).not.toBe(first?.externalEventId);
    expect(next?.rootCallId).toBe(first?.rootCallId);
    expect(
      await receive({
        event: 'DialEnd',
        destuniqueid: 'fallback',
        dialstatus: 'ANSWER',
      }),
    ).toMatchObject({ kind: 'ANSWERED' });
    expect(
      await receive({
        destuniqueid: 'other-phone',
        dialstring: 'trunk-test/12025550999',
      }),
    ).toBeNull();
  });
});
