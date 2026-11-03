// Operator-only finalized CDR/CEL reconciliation. Input remains outside Git.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const peer = (channel) =>
  /^(SIP|PJSIP)[/](.+)-[a-f0-9]{8,}$/i.exec(channel || '');
const iface = (channel) => {
  const p = peer(channel);
  return p ? `${p[1]}/${p[2]}` : null;
};
const extension = (channel) => {
  const p = peer(channel);
  return p && /^[0-9]{2,10}$/.test(p[2]) ? p[2] : null;
};
const number = (value) =>
  /^\+?[0-9]{3,15}$/.test(value)
    ? { kind: 'KNOWN', value }
    : { kind: 'UNKNOWN', value: null };
const eventId = (root, kind, leg) =>
  createHash('sha256')
    .update(JSON.stringify(['staff-cdr-v1', root, kind, leg]))
    .digest('hex');
function evidence(source, connectionId, trunks) {
  assert(Array.isArray(source.calls) && source.calls.length <= 10000);
  assert(Array.isArray(source.events) && source.events.length <= 150000);
  assert(
    Number.isInteger(source.start) &&
      Number.isInteger(source.through) &&
      source.through * 1000 < Date.now(),
  );
  const legs = new Map(),
    events = new Map(),
    groups = new Map();
  for (const e of source.events) {
    assert(/^[0-9]+[.][0-9]+$/.test(e[3]) && /^[0-9]+[.][0-9]+$/.test(e[4]));
    if (e[0] === 'CHAN_START') {
      if (legs.has(e[3]) && legs.get(e[3]) !== e[4]) legs.set(e[3], null);
      else legs.set(e[3], e[4]);
    }
    const a = events.get(e[4]) || [];
    a.push(e);
    events.set(e[4], a);
  }
  for (const row of source.calls) {
    const root = legs.get(row[10]);
    if (!root) continue;
    const a = groups.get(root) || [];
    a.push(row);
    groups.set(root, a);
  }
  const plans = [];
  for (const [root, rows] of groups) {
    const incoming = rows.find(
      (c) => trunks.includes(iface(c[3])) && c[10] === root,
    );
    const outgoing = rows.find(
      (c) => extension(c[3]) && trunks.includes(iface(c[4])) && c[10] === root,
    );
    if (!incoming && !outgoing) continue;
    assert(!(incoming && outgoing), 'Ambiguous external direction');
    const direction = incoming ? 'IN' : 'OUT',
      cdr = incoming || outgoing,
      ev = events.get(root);
    const starts = ev.filter((e) => e[0] === 'CHAN_START' && e[3] === root),
      ends = ev.filter((e) => e[0] === 'LINKEDID_END');
    assert.equal(starts.length, 1);
    if (!ends.length) continue; // A source snapshot may contain a completed leg of a still-live root.
    assert.equal(ends.length, 1);
    const start = Number(starts[0][1]),
      end = Number(ends[0][1]);
    if (start < source.start || end >= source.through) continue;
    assert(start <= end && Math.abs(Number(root.split('.')[0]) - start) <= 1);
    assert.equal(starts[0][2], cdr[3]);
    assert(ev.some((e) => e[0] === 'HANGUP' && e[3] === root));
    const origin = direction === 'OUT' ? extension(cdr[3]) : null;
    const base = {
      schemaVersion: 1,
      connectionId,
      externalCallId: root,
      rootCallId: root,
      direction,
      caller: direction === 'IN' ? number(cdr[1]) : number(origin),
      destination:
        direction === 'OUT' ? number(cdr[2]) : { kind: 'UNKNOWN', value: null },
      companyLine: null,
      queue: null,
      sequence: null,
      recordingReference: null,
    };
    const emit = (kind, leg, t, ext, terminal = false, reason = null) => ({
      ...base,
      externalEventId: eventId(root, kind, leg),
      legId: leg,
      kind,
      extension: ext,
      occurredAt: new Date(t * 1000).toISOString(),
      terminalForCall: terminal,
      endReason: reason,
    });
    const output = [emit('RINGING', root, start, origin)];
    const offered = new Set();
    if (direction === 'IN')
      for (const e of ev.filter(
        (e) =>
          e[0] === 'CHAN_START' &&
          extension(e[2]) &&
          !trunks.includes(iface(e[2])),
      )) {
        offered.add(extension(e[2]));
        output.push(emit('RINGING', e[3], Number(e[1]), extension(e[2])));
      }
    const answers = [];
    if (direction === 'OUT') {
      for (const row of rows.filter(
        (c) =>
          c[5] === 'Dial' &&
          c[7] === 'ANSWERED' &&
          Number(c[9]) > 0 &&
          c[3] === cdr[3] &&
          trunks.includes(iface(c[4])),
      )) {
        const trunk = ev.find((e) => e[0] === 'CHAN_START' && e[2] === row[4]),
          answer = ev.find((e) => e[0] === 'ANSWER' && e[2] === row[4]);
        assert(
          trunk &&
            answer &&
            ev.some(
              (e) =>
                e[0] === 'BRIDGE_ENTER' && e[2] === cdr[3] && e[7] === row[4],
            ),
        );
        answers.push(emit('ANSWERED', trunk[3], Number(answer[1]), origin));
      }
    } else {
      for (const row of rows.filter(
        (c) =>
          c[5] === 'Dial' &&
          c[7] === 'ANSWERED' &&
          Number(c[9]) > 0 &&
          extension(c[4]) &&
          !trunks.includes(iface(c[4])),
      )) {
        const answer = ev.find((e) => e[0] === 'ANSWER' && e[2] === row[4]),
          bridge = ev.find((e) => e[0] === 'BRIDGE_ENTER' && e[2] === row[4]);
        if (!answer || !bridge) continue;
        const direct = ev.some(
          (e) =>
            e[0] === 'BRIDGE_ENTER' &&
            ((e[2] === cdr[3] && e[7] === row[4]) ||
              (e[2] === row[4] && e[7] === cdr[3])),
        );
        const local = ev.find(
          (e) =>
            e[0] === 'BRIDGE_ENTER' &&
            e[7] === row[4] &&
            e[2].startsWith('Local/'),
        );
        const queued =
          local &&
          ev.some(
            (e) =>
              e[0] === 'BRIDGE_ENTER' &&
              e[2] === cdr[3] &&
              e[7].split(';')[0] === local[2].split(';')[0],
          );
        if (!direct && !queued) continue;
        answers.push(
          emit('ANSWERED', answer[3], Number(answer[1]), extension(row[4])),
        );
      }
    }
    const uniqueAnswers = [
      ...new Map(answers.map((e) => [e.legId, e])).values(),
    ];
    output.push(...uniqueAnswers);
    output.sort(
      (a, b) =>
        Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
        (a.kind === 'RINGING' ? -1 : 1),
    );
    const connectedCdr = rows.some(
      (c) =>
        c[5] === 'Dial' &&
        c[7] === 'ANSWERED' &&
        Number(c[9]) > 0 &&
        (direction === 'OUT'
          ? trunks.includes(iface(c[4]))
          : extension(c[4]) && !trunks.includes(iface(c[4]))),
    );
    output.push(
      emit(
        'ENDED',
        root,
        end,
        origin,
        true,
        uniqueAnswers.length || connectedCdr ? 'COMPLETED' : 'NO_ANSWER',
      ),
    );
    assert(
      output.every(
        (e) =>
          Date.parse(e.occurredAt) >= start * 1000 &&
          Date.parse(e.occurredAt) <= end * 1000,
      ),
    );
    plans.push({
      root,
      direction,
      origin,
      offered: [...offered],
      events: output,
    });
  }
  return plans;
}
async function main() {
  const r = createRequire('/workspace/apps/api/package.json');
  r('reflect-metadata');
  const { DatabaseService } = r('./dist/database/database.service.js'),
    { ConfigService } = r('@nestjs/config'),
    { IamCallCenterDirectory } = r('./dist/iam/iam-call-center-directory.js'),
    { CallCenterCrypto } = r('./dist/customer-affairs/call-center.crypto.js'),
    { CallCenterService } = r('./dist/customer-affairs/call-center.service.js'),
    { CallCenterTelephonyService } = r(
      './dist/customer-affairs/call-center-telephony.service.js',
    ),
    { HrCallAnswerDirectory } = r('./dist/hr/hr-call-answer-directory.js'),
    { TelephonyIntegrationService } = r(
      './dist/integrations/telephony.service.js',
    ),
    { issabelOptions } = r('./dist/integrations/issabel/config.js');
  const config = new ConfigService(),
    options = issabelOptions(config);
  assert(options.companyCapture);
  const plans = evidence(
      JSON.parse(fs.readFileSync(process.argv[2], 'utf8')),
      options.connectionId,
      options.outboundPeers,
    ),
    d = new DatabaseService(),
    apply = process.argv.includes('--apply');
  try {
    const c = await d.client.integrationTelephonyConnection.findUniqueOrThrow({
      where: { id: options.connectionId },
    });
    assert(c.active && !c.synthetic);
    const directory = new IamCallCenterDirectory(d),
      crypto = new CallCenterCrypto(config),
      domain = new CallCenterTelephonyService(
        d,
        crypto,
        new CallCenterService(d, crypto),
        directory,
        new HrCallAnswerDirectory(d),
      );
    const service = new TelephonyIntegrationService(
      d,
      new ConfigService({
        ...process.env,
        ISSABEL_RECOVERY_ENABLED: 'true',
        TELEPHONY_EVENTS_PER_MINUTE: '6000',
      }),
      domain,
      null,
      directory,
      null,
    );
    const historical =
      process.argv[3] && !process.argv[3].startsWith('--')
        ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
        : [];
    const currentIdentities = JSON.parse(
      fs.readFileSync('/tmp/staff-current-identities.json', 'utf8'),
    );
    const approved =
      process.argv[4] && !process.argv[4].startsWith('--')
        ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8'))
        : null;
    if (approved) {
      assert(approved.authority === 'OWNER_CONFIRMED_2026-11-02');
      assert(Number.isInteger(approved.start));
      assert(Array.isArray(approved.extensions));
    }
    // Historical extension belongs to a stable employee UUID. The same employee's
    // current linked account may complete its own history after an account relink.
    const recipient = async (ext, at) => {
      if (!ext) return [];
      const ids = await directory.answeredAccounts(
        c.branchId,
        ext,
        at,
        d.client,
      );
      if (
        approved &&
        Date.parse(at) >= approved.start * 1000 &&
        approved.extensions.includes(ext)
      ) {
        const current = (await directory.employeeCallRoutes(c.branchId)).find(
          (x) => x.extension === ext,
        );
        for (const userId of current?.userIds || [])
          if (
            await directory.eligibleMapping(c.branchId, userId, null, d.client)
          )
            ids.push(userId);
      }
      const snap = historical
        .filter((s) => Date.parse(s.at) <= Date.parse(at))
        .at(-1);
      if (snap)
        for (const old of snap.employees.filter(
          (e) =>
            e.branch_id === c.branchId &&
            !e.deleted_at &&
            e.status === 'فعال' &&
            e.extensions.includes(ext),
        )) {
          const current = currentIdentities.find(
            (e) => e.id === old.id && e.branchId === c.branchId,
          );
          if (
            current &&
            (await directory.eligibleMapping(
              c.branchId,
              current.userId,
              null,
              d.client,
            ))
          )
            ids.push(current.userId);
        }
      return [...new Set(ids)];
    };
    const result = {
      plans: plans.length,
      alreadyPresent: 0,
      newCalls: 0,
      answeredCalls: 0,
      unansweredCalls: 0,
      provenAssignments: 0,
      unresolvedExtensions: [],
      applied: apply,
    };
    const unresolved = new Set(),
      proofs = [];
    for (const p of plans) {
      p.rootFingerprint = crypto.fingerprint(
        `telephony:root:${c.id}:${p.root}`,
      );
      p.before = await d.client.callCenterTelephonySession.findUnique({
        where: {
          connectionId_rootFingerprint: {
            connectionId: c.id,
            rootFingerprint: p.rootFingerprint,
          },
        },
        include: { call: true, offers: true },
      });
      if (p.before) result.alreadyPresent++;
      else result.newCalls++;
      const answers = p.events.filter((e) => e.kind === 'ANSWERED');
      result[
        p.events.at(-1).endReason === 'COMPLETED'
          ? 'answeredCalls'
          : 'unansweredCalls'
      ]++;
      p.assignments = [];
      for (const event of answers) {
        const users = await recipient(event.extension, event.occurredAt);
        if (!users.length) unresolved.add(event.extension);
        p.assignments.push({ event, users });
        result.provenAssignments += users.length;
      }
      p.originUsers = p.origin
        ? await recipient(p.origin, p.events[0].occurredAt)
        : [];
      if (p.origin && !p.originUsers.length) unresolved.add(p.origin);
      proofs.push({
        p,
        oldBusiness: p.before?.call
          ? {
              ...Object.fromEntries(
                ['phone', 'name', 'subject', 'source', 'note'].map((key) => [
                  key,
                  new CallCenterService(d, crypto).presentCall(p.before.call)[
                    key
                  ],
                ]),
              ),
              ...(p.before.completed
                ? {
                    outcome: p.before.call.outcome,
                    status: p.before.call.status,
                  }
                : {}),
            }
          : null,
      });
    }
    result.unresolvedExtensions = [...unresolved];
    fs.writeFileSync(
      '/tmp/staff-cdr-expected.json',
      JSON.stringify(
        proofs.map(({ p }) => ({
          rootFingerprint: p.rootFingerprint,
          userIds: [
            ...new Set([
              ...p.originUsers,
              ...p.assignments.flatMap((a) => a.users),
            ]),
          ],
        })),
      ),
      { mode: 0o600 },
    );
    if (!apply) {
      console.log(JSON.stringify(result));
      return;
    }
    let processed = 0;
    for (const { p, oldBusiness } of proofs) {
      // Existing business text is preserved. Only missing technical answer receipts
      // are reconciled; historical ingestion never grants browser notifications.
      if (!p.before) {
        for (const e of p.events) await service.receiveRecovered(e);
      } else {
        for (const e of p.events.filter((e) =>
          ['ANSWERED', 'ENDED'].includes(e.kind),
        ))
          await service.receiveRecovered(e);
      }
      for (const { event, users } of p.assignments) {
        if (!users.length) continue;
        // Existing answers with access are left intact. A missing answer must have a
        // retained matching provider receipt before evidence-only access repair.
        const fp = crypto.fingerprint(
          `telephony:event:${c.id}:cdr-recovery:${createHash('sha256').update(event.externalEventId).digest('hex')}`,
        );
        const inbox = await d.client.integrationTelephonyInbox.findUnique({
          where: {
            connectionId_externalFingerprint: {
              connectionId: c.id,
              externalFingerprint: fp,
            },
          },
          select: { id: true },
        });
        if (inbox)
          await d.client.$transaction((tx) =>
            domain.reprojectAnswer(
              tx,
              event,
              c.branchId,
              { inboxId: inbox.id, userIds: users },
              true,
            ),
          );
      }
      const row = await d.client.callCenterTelephonySession.findUniqueOrThrow({
        where: {
          connectionId_rootFingerprint: {
            connectionId: c.id,
            rootFingerprint: p.rootFingerprint,
          },
        },
        include: {
          call: { include: { answerResponsibilities: true } },
          offers: true,
        },
      });
      assert.equal(row.state, 'ENDED');
      // This maintenance belongs to Call Center. Inactive origin snapshots grant
      // existing own-outbound scope but are never browser notification offers.
      if (p.direction === 'OUT' && p.originUsers.length)
        await d.client.$transaction(async (tx) => {
          const check = await recipient(p.origin, p.events[0].occurredAt);
          assert.deepEqual(check, p.originUsers);
          for (const userId of check)
            await tx.callCenterTelephonyOffer.upsert({
              where: { sessionId_userId: { sessionId: row.id, userId } },
              create: {
                sessionId: row.id,
                userId,
                mappingVersion: 2147483647,
                active: false,
                deferred: true,
              },
              update: {},
            });
          if (
            !(await tx.customerAffairsAuditEvent.findFirst({
              where: { entityId: row.id, action: 'CDR_ORIGIN_ACCESS_RECOVERY' },
              select: { id: true },
            }))
          )
            await tx.customerAffairsAuditEvent.create({
              data: {
                branchId: c.branchId,
                actorUserId: row.call.createdByUserId,
                entityType: 'TELEPHONY_CALL',
                entityId: row.id,
                action: 'CDR_ORIGIN_ACCESS_RECOVERY',
                version: row.version,
                afterSnapshot: { source: 'CDR_CEL', recipients: check.length },
              },
            });
        });
      if (oldBusiness) {
        const after = await d.client.callCenterCall.findUniqueOrThrow({
          where: { id: row.callId },
        });
        const present = {
          ...new CallCenterService(d, crypto).presentCall(after),
          outcome: after.outcome,
          status: after.status,
        };
        for (const key of Object.keys(oldBusiness))
          assert.deepEqual(
            present[key],
            oldBusiness[key],
            `Saved ${key} changed`,
          );
      }
      if (!p.before)
        assert.equal(
          await d.client.callCenterTelephonyOffer.count({
            where: { sessionId: row.id, active: true },
          }),
          0,
        );
      processed++;
    }
    result.processed = processed;
    result.historicalPopups = 0;
    result.savedBusinessFieldsPreserved = true;
    fs.writeFileSync(
      '/tmp/staff-cdr-backfill-receipt.json',
      JSON.stringify(result),
    );
    console.log(JSON.stringify(result));
  } finally {
    await d.client.$disconnect();
  }
}
module.exports = { evidence };
if (require.main === module)
  main().catch((e) => {
    fs.writeFileSync(
      '/tmp/staff-cdr-backfill-error.txt',
      e.stack || e.message,
      { mode: 0o600 },
    );
    console.error(
      'Staff recovery stopped; inspect private diagnostic: ' + e.name,
    );
    process.exitCode = 1;
  });
