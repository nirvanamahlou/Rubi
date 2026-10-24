import { describe, expect, it } from 'vitest';
import type { TelephonyEventV1 } from '@nora/contracts';
import { normalizeCompanyInbound } from './company-inbound';
import { applyTelephonyEvent } from '../../customer-affairs/telephony-state';

function setup() {
  const stored = new Map<string, TelephonyEventV1>();
  const receive = async (patch: Record<string, string> = {}) => {
    const result = await normalizeCompanyInbound(
      'connection',
      {
        event: 'Newchannel',
        channel: 'PJSIP/carrier-00000001',
        linkedid: 'root',
        uniqueid: 'root',
        calleridnum: '+12025550123',
        ...patch,
      },
      ['PJSIP/carrier'],
      ['101', '102'],
      async (id) => stored.get(id) ?? null,
      new Date('2026-10-24T10:00:00Z'),
    );
    if (result) stored.set(result.externalEventId, result);
    return result;
  };
  return { receive, stored };
}
describe('company inbound capture', () => {
  it('captures external direct calls, preserving caller identity through transfer and one root', async () => {
    const { receive } = setup();
    const first = await receive({ calleridname: 'Customer' });
    const dial = {
      event: 'DialBegin',
      destchannel: 'PJSIP/101-00000002',
      destuniqueid: 'a',
    };
    expect(await receive(dial)).toMatchObject({
      kind: 'RINGING',
      extension: '101',
    });
    const answer = await receive({
      ...dial,
      event: 'DialEnd',
      dialstatus: 'ANSWER',
      calleridname: 'Agent',
    });
    const transfer = await receive({
      ...dial,
      event: 'DialEnd',
      dialstatus: 'ANSWER',
      destchannel: 'SIP/102-00000003',
      destuniqueid: 'b',
      uniqueid: 'a',
    });
    expect(answer).toMatchObject({
      callerName: 'Customer',
      kind: 'ANSWERED',
      extension: '101',
    });
    expect(transfer).toMatchObject({
      rootCallId: first?.rootCallId,
      extension: '102',
      kind: 'ANSWERED',
    });
    expect(await receive({ event: 'Hangup', uniqueid: 'a' })).toBeNull();
    expect(await receive({ event: 'Hangup' })).toMatchObject({
      terminalForCall: true,
    });
  });
  it('accepts every queue on the verified external root, including a caller abandoning before an agent rings', async () => {
    const { receive } = setup();
    await receive();
    for (const queue of ['sales', 'finance', 'support'])
      expect(await receive({ event: 'QueueCallerJoin', queue })).toMatchObject({
        kind: 'RINGING',
        queue,
      });
    expect(
      await receive({ event: 'QueueCallerAbandon', queue: 'support' }),
    ).toMatchObject({
      kind: 'ENDED',
      endReason: 'NO_ANSWER',
      terminalForCall: false,
    });
  });
  it('never treats internal calls, unknown trunks or forged caller IDs as external origin', async () => {
    for (const channel of [
      'PJSIP/101-00000001',
      'SIP/unknown-00000001',
      'Local/101@from-internal-00000001;1',
    ])
      expect(await setup().receive({ channel })).toBeNull();
    expect(
      await setup().receive({ event: 'DialEnd', dialstatus: 'ANSWER' }),
    ).toBeNull();
    expect(await setup().receive({ event: 'Hangup' })).toBeNull();
  });
  it('does not fabricate answer evidence for busy, cancellation or unknown endpoints', async () => {
    const { receive } = setup();
    await receive();
    const dial = {
      event: 'DialEnd',
      destchannel: 'PJSIP/101-00000002',
      destuniqueid: 'a',
    };
    expect(await receive({ ...dial, dialstatus: 'BUSY' })).toMatchObject({
      kind: 'ENDED',
      endReason: 'FAILED',
    });
    expect(
      await receive({ ...dial, destuniqueid: 'b', dialstatus: 'CANCEL' }),
    ).toMatchObject({ kind: 'ENDED', endReason: 'NO_ANSWER' });
    expect(
      await receive({
        ...dial,
        destchannel: 'PJSIP/999-00000002',
        dialstatus: 'ANSWER',
      }),
    ).toBeNull();
  });
  it('preserves unknown external name and idempotent receipt time', async () => {
    const { receive } = setup();
    const first = await receive();
    expect(await receive()).toEqual(first);
    const answer = await receive({
      event: 'AgentConnect',
      queue: 'q',
      interface: 'Local/101@from-queue/n',
      destuniqueid: 'a',
      calleridname: 'Agent',
    });
    expect(answer?.callerName).toBeUndefined();
    expect(answer?.extension).toBe('101');
  });
  it('retains both answered employees even with equal timestamps, replay and late arrival', async () => {
    const { receive } = setup();
    const first = (await receive())!;
    const a = (await receive({
      event: 'AgentConnect',
      queue: 'q',
      interface: 'SIP/101',
      destuniqueid: 'a',
    }))!;
    const b = (await receive({
      event: 'AgentConnect',
      queue: 'q',
      interface: 'SIP/102',
      destuniqueid: 'b',
    }))!;
    let state = applyTelephonyEvent(null, first, new Date());
    for (const event of [b, a, b])
      state = applyTelephonyEvent(state, event, new Date());
    expect(state.answers?.map((entry) => entry.extension)).toEqual([
      '101',
      '102',
    ]);
    expect(state.destinations).toHaveLength(2);
    expect(state.answers).toHaveLength(2);
  });
});
