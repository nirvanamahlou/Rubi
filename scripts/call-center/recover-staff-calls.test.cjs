const test = require('node:test'),
  assert = require('node:assert/strict');
const { evidence } = require('./recover-staff-calls.cjs');
function fixture(answered = true) {
  const t = Math.floor(Date.now() / 1000) - 1000,
    root = `${t}.1`,
    leg = `${t}.2`,
    src = 'SIP/404-00000001',
    trunk = 'SIP/trunk-00000002';
  const e = (kind, dt, ch, id, app = '', peer = '') => [
    kind,
    String(t + dt),
    ch,
    id,
    root,
    app,
    '',
    peer,
    '',
    '',
  ];
  return {
    t,
    root,
    source: {
      start: t - 1,
      through: t + 100,
      calls: [
        [
          'date',
          '404',
          '193',
          src,
          trunk,
          'Dial',
          'SIP/trunk/193',
          answered ? 'ANSWERED' : 'NO ANSWER',
          '20',
          answered ? '10' : '0',
          root,
          String(t),
        ],
      ],
      events: [
        e('CHAN_START', 0, src, root),
        e('CHAN_START', 1, trunk, leg),
        ...(answered
          ? [
              e('ANSWER', 2, trunk, leg),
              e('BRIDGE_ENTER', 2, src, root, 'Dial', trunk),
            ]
          : [e('ANSWER', 3, src, root, 'Playback')]),
        e('HANGUP', 20, src, root),
        e('LINKEDID_END', 20, src, root),
      ],
    },
  };
}
test('finalized short external service call keeps true origin and actual answer', () => {
  const { source } = fixture();
  const p = evidence(source, 'connection', ['SIP/trunk']);
  assert.equal(p.length, 1);
  assert.equal(p[0].origin, '404');
  assert.equal(p[0].events[0].destination.value, '193');
  assert.equal(p[0].events.filter((e) => e.kind === 'ANSWERED').length, 1);
  assert(p[0].events.at(-1).terminalForCall);
  assert.deepEqual(evidence(source, 'connection', ['SIP/trunk']), p);
});
test('PBX playback answer never invents answered customer conversation', () => {
  const { source } = fixture(false);
  const p = evidence(source, 'connection', ['SIP/trunk']);
  assert.equal(p[0].events.filter((e) => e.kind === 'ANSWERED').length, 0);
  assert.equal(p[0].events.at(-1).endReason, 'NO_ANSWER');
});
test('internal calls and unapproved trunks are not imported', () => {
  const { source } = fixture();
  assert.equal(evidence(source, 'connection', ['SIP/other']).length, 0);
});
test('unfinalized and tampered roots fail closed', () => {
  const { source } = fixture();
  source.events.pop();
  assert.equal(evidence(source, 'connection', ['SIP/trunk']).length, 0);
});
test('a provider destination too short to be a phone is retained as unknown without guessing', () => {
  const { source } = fixture(false);
  source.calls[0][2] = '12';
  assert.equal(
    evidence(source, 'connection', ['SIP/trunk'])[0].events[0].destination.kind,
    'UNKNOWN',
  );
});
test('calls before explicit Tehran start are excluded', () => {
  const { source, t } = fixture();
  source.start = t + 1;
  assert.equal(evidence(source, 'connection', ['SIP/trunk']).length, 0);
});
