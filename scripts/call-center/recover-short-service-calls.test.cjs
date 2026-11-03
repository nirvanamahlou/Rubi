const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evidence } = require('./recover-short-service-calls.cjs');
function fixture() {
  const root = '1700000000.1',
    leg = '1700000001.2';
  const origin = 'SIP/101-00000001',
    trunk = 'SIP/test-trunk-00000002';
  const dial = 'SIP/test-trunk/193,300,T';
  const row = (kind, time, channel, id, app = '', data = '', peer = '') => [
    kind,
    String(time),
    channel,
    id,
    root,
    app,
    data,
    peer,
  ];
  return {
    calls: [
      [
        '2023-11-14',
        '101',
        '193',
        origin,
        trunk,
        'Dial',
        dial,
        'ANSWERED',
        '20',
        '19',
        root,
        '1700000000',
      ],
    ],
    events: [
      row('CHAN_START', 1700000000, origin, root),
      row('CHAN_START', 1700000001, trunk, leg),
      row('ANSWER', 1700000002, trunk, leg),
      row('ANSWER', 1700000002, origin, root, 'Dial', dial),
      row('BRIDGE_ENTER', 1700000002, origin, root, 'Dial', dial, trunk),
      row('BRIDGE_ENTER', 1700000002, trunk, leg),
      row('HANGUP', 1700000020, origin, root),
      row('LINKEDID_END', 1700000020, trunk, leg),
    ],
  };
}
const verify = (s) =>
  evidence(s, '193', ['101'], ['SIP/test-trunk'], 1800000000000);
test('accepts only complete external CDR/CEL evidence', () => {
  const result = verify(fixture());
  assert.equal(result.length, 1);
  assert.equal(result[0].extension, '101');
  assert.deepEqual(result[0].times, [1700000001, 1700000002, 1700000020]);
});
test('rejects internal destinations, missing bridge/end, duplicate roots and unproven answers', () => {
  for (const change of [
    (s) => {
      s.calls[0][4] = 'SIP/102-00000002';
    },
    (s) => {
      s.events = s.events.filter((e) => e[0] !== 'BRIDGE_ENTER');
    },
    (s) => {
      s.events = s.events.filter((e) => e[0] !== 'LINKEDID_END');
    },
    (s) => {
      s.calls.push(s.calls[0]);
    },
    (s) => {
      s.calls[0][7] = 'NO ANSWER';
    },
    (s) => {
      s.calls[0][11] = '1700003000';
    },
  ]) {
    const s = fixture();
    change(s);
    assert.throws(() => verify(s));
  }
});
