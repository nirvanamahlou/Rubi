// Operator-only recovery from a private, read-only CDR/CEL export. No HTTP route.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

function evidence(source, number, extensions, trunks, now = Date.now()) {
  assert(/^\d{3,6}$/.test(number));
  assert(Array.isArray(source.calls) && source.calls.length <= 100);
  assert(Array.isArray(source.events) && source.events.length <= 10000);
  const seen = new Set();
  return source.calls.map((cdr) => {
    const [
      ,
      extension,
      dst,
      channel,
      destination,
      app,
      dial,
      disposition,
      ,
      billsec,
      root,
      epoch,
    ] = cdr;
    assert(dst === number && extensions.includes(extension));
    assert(/^[0-9]+\.[0-9]+$/.test(root) && !seen.has(root));
    seen.add(root);
    const peer = /^(SIP|PJSIP)\/(.+)-[a-f0-9]{8,}$/i.exec(destination);
    assert(peer && trunks.includes(`${peer[1]}/${peer[2]}`));
    assert(
      new RegExp(`^(SIP|PJSIP)/${extension}-[a-f0-9]{8,}$`, 'i').test(channel),
    );
    assert(
      app === 'Dial' &&
        dial.split(',')[0] === `${peer[1]}/${peer[2]}/${number}`,
    );
    assert(disposition === 'ANSWERED' && Number(billsec) > 0);
    const rows = source.events.filter((e) => e[4] === root);
    const one = (type, name) => {
      const matches = rows.filter((e) => e[0] === type && e[2] === name);
      assert(matches.length === 1);
      return matches[0];
    };
    const start = one('CHAN_START', channel),
      trunk = one('CHAN_START', destination);
    const answer = one('ANSWER', destination),
      originAnswer = one('ANSWER', channel);
    const end = one('HANGUP', channel);
    assert(start[3] === root && Number(start[1]) === Number(epoch));
    assert(Math.abs(Number(root.split('.')[0]) - Number(epoch)) <= 1);
    assert(trunk[3] !== root && answer[3] === trunk[3]);
    assert(
      originAnswer[3] === root &&
        originAnswer[5] === 'Dial' &&
        originAnswer[6] === dial,
    );
    assert(one('BRIDGE_ENTER', channel)[7] === destination);
    one('BRIDGE_ENTER', destination);
    assert(rows.filter((e) => e[0] === 'LINKEDID_END').length === 1);
    const times = [trunk[1], answer[1], end[1]].map(Number);
    assert(times.every(Number.isFinite) && times[0] >= Number(epoch));
    assert(
      times[0] <= times[1] && times[1] <= times[2] && times[2] * 1000 < now,
    );
    return { root, leg: trunk[3], extension, number, times };
  });
}

async function main() {
  const r = createRequire('/workspace/apps/api/package.json');
  r('reflect-metadata');
  const { DatabaseService } = r('./dist/database/database.service.js');
  const { ConfigService } = r('@nestjs/config');
  const { IamCallCenterDirectory } = r(
    './dist/iam/iam-call-center-directory.js',
  );
  const { CallCenterCrypto } = r(
    './dist/customer-affairs/call-center.crypto.js',
  );
  const { CallCenterService } = r(
    './dist/customer-affairs/call-center.service.js',
  );
  const { CallCenterTelephonyService } = r(
    './dist/customer-affairs/call-center-telephony.service.js',
  );
  const { HrCallAnswerDirectory } = r('./dist/hr/hr-call-answer-directory.js');
  const { TelephonyIntegrationService } = r(
    './dist/integrations/telephony.service.js',
  );
  const { nativeEventId } = r('./dist/integrations/issabel/native-events.js');
  const { issabelOptions } = r('./dist/integrations/issabel/config.js');
  const { recoveredOutboundAccounts } = r(
    './dist/integrations/issabel/recovered-outbound-recipient.js',
  );
  const config = new ConfigService(),
    options = issabelOptions(config);
  assert(options && options.companyCapture);
  const facts = evidence(
    JSON.parse(fs.readFileSync(process.argv[2], 'utf8')),
    process.argv[3],
    options.companyExtensions,
    options.outboundPeers,
  );
  const d = new DatabaseService();
  try {
    const directory = new IamCallCenterDirectory(d),
      crypto = new CallCenterCrypto(config);
    const c = await d.client.integrationTelephonyConnection.findUniqueOrThrow({
      where: { id: options.connectionId },
    });
    assert(c.active && !c.synthetic);
    for (const f of facts) {
      let users = await directory.answeredAccounts(
        c.branchId,
        f.extension,
        new Date(f.times[1] * 1000).toISOString(),
        d.client,
      );
      if (!users.length)
        users = await recoveredOutboundAccounts(
          {
            direction: 'OUT',
            kind: 'ANSWERED',
            extension: f.extension,
            occurredAt: new Date(f.times[1] * 1000).toISOString(),
            connectionId: c.id,
          },
          c.branchId,
          d.client,
          directory,
        );
      assert(users.length === 1, 'Historical employee must be unambiguous');
    }
    if (!process.argv.includes('--apply')) {
      console.log(
        JSON.stringify({ verifiedCalls: facts.length, applied: false }),
      );
      return;
    }
    // Enable only this verified one-shot source; no persistent environment change.
    const recoveryConfig = new ConfigService({
      ...process.env,
      ISSABEL_RECOVERY_ENABLED: 'true',
    });
    const domain = new CallCenterTelephonyService(
      d,
      crypto,
      new CallCenterService(d, crypto),
      directory,
      new HrCallAnswerDirectory(d),
    );
    const service = new TelephonyIntegrationService(
      d,
      recoveryConfig,
      domain,
      null,
      directory,
      null,
    );
    for (const f of facts) {
      const base = {
        schemaVersion: 1,
        connectionId: c.id,
        externalCallId: f.root,
        rootCallId: f.root,
        direction: 'OUT',
        caller: { kind: 'KNOWN', value: f.extension },
        destination: { kind: 'KNOWN', value: f.number },
        extension: f.extension,
        companyLine: null,
        queue: null,
        sequence: null,
        recordingReference: null,
      };
      for (const [i, kind] of ['RINGING', 'ANSWERED', 'ENDED'].entries()) {
        const end = kind === 'ENDED';
        await service.receiveRecovered({
          ...base,
          externalEventId: nativeEventId(
            f.root,
            i === 0
              ? 'outbound-anchor'
              : i === 1
                ? 'outbound-DialEnd'
                : 'outbound-Hangup',
            i === 0 ? '' : end ? f.root : f.leg,
          ),
          kind,
          legId: end ? f.root : f.leg,
          occurredAt: new Date(f.times[i] * 1000).toISOString(),
          terminalForCall: end,
          endReason: end ? 'COMPLETED' : null,
        });
      }
      const s = await d.client.callCenterTelephonySession.findUniqueOrThrow({
        where: {
          connectionId_rootFingerprint: {
            connectionId: c.id,
            rootFingerprint: crypto.fingerprint(
              `telephony:root:${c.id}:${f.root}`,
            ),
          },
        },
        include: {
          offers: true,
          call: { include: { answerResponsibilities: true } },
        },
      });
      assert(
        s.state === 'ENDED' &&
          s.offers.length === 0 &&
          s.call.answerResponsibilities.length === 1,
      );
    }
    console.log(
      JSON.stringify({
        verifiedCalls: facts.length,
        applied: true,
        historicalPopups: 0,
      }),
    );
  } finally {
    await d.client.$disconnect();
  }
}
module.exports = { evidence };
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
