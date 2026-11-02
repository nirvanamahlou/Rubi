/**
 * HR-owned maintenance contract for an explicitly confirmed additional internal.
 * Not a browser endpoint. Caller supplies a freshly authenticated IAM actor and
 * exact employee/primary extension as preconditions. No account grants, PBX
 * commands, historical answer changes or existing-record replacement occur.
 */
import { randomUUID } from 'node:crypto';

export async function registerAdditionalExtension(client, actor, input) {
  if (!actor?.permissions?.includes('hr.manage'))
    throw Error('HR_MANAGE_REQUIRED');
  const { employeeId, branchId, primaryExtension, additionalExtension } = input;
  if (!actor.branchIds?.includes(branchId)) throw Error('BRANCH_FORBIDDEN');
  if (
    ![employeeId, branchId, actor.userId].every((v) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        v,
      ),
    ) ||
    ![primaryExtension, additionalExtension].every(
      (v) => typeof v === 'string' && /^[0-9]{1,16}$/.test(v),
    ) ||
    primaryExtension === additionalExtension
  )
    throw Error('INVALID_EXTENSION_REGISTRATION');

  return client.$transaction(
    async (tx) => {
      // Serialize additions of the same physical extension, including two employees.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`hr-extension:${branchId}:${additionalExtension}`}, 0))::text`;
      await tx.$queryRaw`SELECT id FROM hr_employees WHERE id=${employeeId}::uuid FOR UPDATE`;
      const employee = await tx.hrEmployee.findFirst({
        where: { id: employeeId, branchId, status: 'فعال', deletedAt: null },
        select: { id: true, userId: true },
      });
      if (!employee?.userId) throw Error('ACTIVE_LINKED_EMPLOYEE_REQUIRED');
      const records = await tx.hrRecord.findMany({
        where: {
          employeeId,
          branchId,
          section: 'employee',
          tab: 'internalContact',
          deletedAt: null,
        },
        select: { id: true, values: true },
      });
      if (!records.some((r) => r.values?.[0] === primaryExtension))
        throw Error('PRIMARY_EXTENSION_CHANGED');
      const conflicting = await tx.hrRecord.findFirst({
        where: {
          branchId,
          section: 'employee',
          tab: 'internalContact',
          deletedAt: null,
          employeeId: { not: employeeId },
          values: { path: ['0'], equals: additionalExtension },
        },
        select: { id: true },
      });
      if (conflicting) throw Error('EXTENSION_ALREADY_ASSIGNED');
      const existing = records.find(
        (r) => r.values?.[0] === additionalExtension,
      );
      if (existing) return { added: false, recordId: existing.id };
      const record = await tx.hrRecord.create({
        data: {
          id: randomUUID(),
          branchId,
          employeeId,
          section: 'employee',
          tab: 'internalContact',
          code: `HR-EXT-${randomUUID()}`,
          values: [additionalExtension],
          searchText: additionalExtension,
          status: 'فعال',
        },
      });
      await tx.hrAuditEvent.create({
        data: {
          branchId,
          employeeId,
          recordId: record.id,
          actorId: actor.userId,
          action: 'employee.extension.add',
          version: record.version,
          changes: {
            primaryExtension,
            additionalExtension,
            preservedExisting: true,
          },
        },
      });
      await tx.hrNotification.create({
        data: {
          branchId,
          employeeId,
          recordId: record.id,
          action: 'employee.extension.add',
          title: 'داخلی دیگر کارمند ثبت شد',
        },
      });
      return { added: true, recordId: record.id };
    },
    { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 },
  );
}
