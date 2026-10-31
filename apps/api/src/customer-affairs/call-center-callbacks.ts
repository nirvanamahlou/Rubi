import { Prisma } from '@nora/database';
import type { CallCenterCrypto } from './call-center.crypto';
import type { TelephonyTechnical } from './telephony-state';

/** Count contacts (branch + normalized phone), never individual ringing legs. */
export async function missedCallbackCount(
  ...args: Parameters<typeof missedCallbackContacts>
) {
  return (await missedCallbackContacts(...args)).length;
}

export async function missedCallbackContacts(
  tx: Prisma.TransactionClient,
  crypto: CallCenterCrypto,
  branchId: string,
  reportScope: Prisma.Sql,
  contactScope: Prisma.Sql,
  asOf: Date,
) {
  let after = '';
  const pending: { contactId: string; callId: string; missedAt: number }[] = [];
  for (;;) {
    const contacts = await tx.$queryRaw<
      { id: string; candidates: string[] }[]
    >(Prisma.sql`
      SELECT c.id, array_agg(a.id) AS candidates FROM customer_affairs_call_contacts c
      JOIN customer_affairs_calls a ON a.contact_id=c.id
      LEFT JOIN call_center_telephony_sessions s ON s."callId"=a.id
      WHERE c.branch_id=${branchId}::uuid
        AND (${contactScope}) AND (${reportScope})
        AND a.direction='INBOUND' AND a.occurred_at <= ${asOf}
        AND (a.origin IS NULL OR a.origin <> 'SYNTHETIC')
        AND (s.id IS NULL OR s.synthetic=false)
        AND (a.outcome='NO_ANSWER' OR s.state='ENDED')
        ${after ? Prisma.sql`AND c.id > ${after}::uuid` : Prisma.empty}
      GROUP BY c.id ORDER BY c.id LIMIT 100`);
    if (!contacts.length)
      return pending.sort(
        (a, b) =>
          b.missedAt - a.missedAt || a.contactId.localeCompare(b.contactId),
      );
    const candidates = new Set(contacts.flatMap((c) => c.candidates));
    const facts = new Map(
      contacts.map(({ id }) => [
        id,
        { missed: -Infinity, answered: -Infinity, callId: '' },
      ]),
    );
    let cursor: string | undefined;
    for (;;) {
      // Bounded reads, even for a contact with a very long call history.
      const rows = await tx.callCenterCall.findMany({
        where: {
          contactId: { in: contacts.map((c) => c.id) },
          occurredAt: { lte: asOf },
          OR: [{ origin: null }, { origin: { not: 'SYNTHETIC' } }],
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        include: { telephonySession: true },
        orderBy: { id: 'asc' },
        take: 500,
      });
      for (const row of rows) {
        const session = row.telephonySession;
        if (session?.synthetic) continue;
        const technical = session
          ? crypto.decrypt<TelephonyTechnical>(
              session.encryptedTechnical,
              session.keyVersion,
              `telephony:${session.id}`,
            )
          : null;
        // Provider evidence takes precedence over an editable business outcome.
        const answered = technical
          ? technical.answered === true
          : row.origin !== 'TELEPHONY' && row.outcome === 'ANSWERED';
        const missed =
          row.direction === 'INBOUND' &&
          (technical
            ? technical.state === 'ENDED' &&
              technical.unanswered === true &&
              !answered
            : row.origin !== 'TELEPHONY' && row.outcome === 'NO_ANSWER');
        const fact = facts.get(row.contactId)!;
        if (answered && ['INBOUND', 'OUTBOUND'].includes(row.direction))
          fact.answered = Math.max(fact.answered, row.occurredAt.getTime());
        if (missed && candidates.has(row.id)) {
          const phone = crypto.decrypt<{ phone: string }>(
            row.encryptedPayload,
            row.keyVersion,
            `call:${row.id}:${row.contactId}`,
          ).phone;
          if (
            phone?.trim() &&
            (row.occurredAt.getTime() > fact.missed ||
              (row.occurredAt.getTime() === fact.missed &&
                row.id < fact.callId))
          ) {
            fact.missed = row.occurredAt.getTime();
            fact.callId = row.id;
          }
        }
      }
      if (rows.length < 500) break;
      cursor = rows.at(-1)!.id;
    }
    // Equal timestamps do not prove that a conversation happened after the miss.
    for (const [contactId, fact] of facts)
      if (Number.isFinite(fact.missed) && fact.answered <= fact.missed)
        pending.push({ contactId, callId: fact.callId, missedAt: fact.missed });
    after = contacts.at(-1)!.id;
  }
}
