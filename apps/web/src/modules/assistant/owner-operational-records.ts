import { z } from 'zod';
import type { OwnerRead } from './owner-record-report';

const id = z.string().min(1);
const integer = z.number().int().safe().nonnegative();
type RecordRow = {
  id: string;
  label: string;
  branch: string;
  contractId?: string;
};

export async function callCenterRecords(
  subject: 'callsWithoutOutcome' | 'callbacks',
  read: OwnerRead,
  authorizedBranches: readonly string[],
) {
  const result = z
    .object({ data: z.array(z.object({ id })) })
    .parse(
      await read(
        '/customer-affairs/call-center/branches',
        undefined,
        authorizedBranches[0],
      ),
    );
  const rows: RecordRow[] = [];
  const pageSchema = z.object({
    data: z.array(
      z.object({ call: z.object({ id, occurredAt: z.string().datetime() }) }),
    ),
    meta: z.object({ page: integer, total: integer, revision: id }),
  });
  const endpoint =
    subject === 'callbacks' ? 'missed-callbacks' : 'without-outcome';
  for (const branch of new Set(result.data.map((b) => b.id))) {
    if (!authorizedBranches.includes(branch))
      throw new Error('CALL_BRANCH_SCOPE_CHANGED');
    let revision: string | undefined;
    let total: number | undefined;
    const calls = new Map<string, RecordRow>();
    for (let page = 1; ; page++) {
      if (page > 250) throw new Error('CALL_PAGE_LIMIT');
      const value = pageSchema.parse(
        await read(
          '/customer-affairs/call-center/' + endpoint,
          { page, pageSize: 50, ...(revision ? { revision } : {}) },
          branch,
        ),
      );
      if (
        value.meta.page !== page ||
        (revision !== undefined &&
          (value.meta.revision !== revision || value.meta.total !== total))
      )
        throw new Error('CALL_LIST_CHANGED');
      revision = value.meta.revision;
      total = value.meta.total;
      for (const { call } of value.data) {
        if (calls.has(call.id)) throw new Error('CALL_LIST_CHANGED');
        calls.set(call.id, { id: call.id, label: call.occurredAt, branch });
      }
      if (calls.size === total) break;
      if (!value.data.length || calls.size > total)
        throw new Error('CALL_INCOMPLETE_PAGE');
    }
    rows.push(...calls.values());
  }
  return { rows, hasBranch: true, hasCompany: false };
}

export async function reservationRequests(read: OwnerRead) {
  const schema = z.object({
    data: z
      .array(
        z.object({
          id,
          contractId: id,
          branchId: id,
          snapshot: z.object({ contractNumber: id }),
        }),
      )
      .max(100),
  });
  const requests = new Map<string, RecordRow>();
  for (let page = 1; page <= 250; page++) {
    const { data } = schema.parse(
      await read('/reservations/requests?page=' + page),
    );
    for (const row of data) {
      if (requests.has(row.contractId))
        throw new Error('RESERVATION_LIST_CHANGED');
      requests.set(row.contractId, {
        id: row.id,
        label: row.snapshot.contractNumber,
        branch: row.branchId,
        contractId: row.contractId,
      });
    }
    if (data.length < 100)
      return {
        rows: [...requests.values()],
        hasBranch: true,
        hasCompany: false,
      };
  }
  throw new Error('RESERVATION_LIST_LIMIT');
}
