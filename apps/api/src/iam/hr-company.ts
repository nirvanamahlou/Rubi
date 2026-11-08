import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';

export function hrCompanyInput(body: unknown, actor: AuthenticatedActor) {
  if (
    !actor.permissions.includes('hr.manage') ||
    !actor.permissions.includes('iam.roles.manage')
  )
    throw new ForbiddenException('دسترسی مدیریت شرکت‌ها وجود ندارد.');
  const input = body as { id?: unknown; name?: unknown } | null;
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !['id', 'name'].includes(k)) ||
    typeof input.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.id,
    ) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.trim().length > 160
  )
    throw new BadRequestException('شناسه و نام شرکت معتبر نیست.');
  return { id: input.id, name: input.name.trim() };
}
export async function createHrCompany(
  tx: Prisma.TransactionClient,
  input: { id: string; name: string },
  actor: AuthenticatedActor,
) {
  const existing = await tx.branch.findUnique({ where: { id: input.id } });
  if (existing) {
    const membership = await tx.userBranch.findUnique({
      where: {
        userId_branchId: { userId: actor.userId, branchId: existing.id },
      },
    });
    if (!membership || existing.name !== input.name)
      throw new ConflictException('شناسه شرکت قبلاً استفاده شده است.');
    return existing;
  }
  const company = await tx.branch.create({
    data: { ...input, code: `CMP-${input.id.replaceAll('-', '')}` },
  });
  await tx.userBranch.create({
    data: { userId: actor.userId, branchId: company.id },
  });
  await tx.auditEvent.create({
    data: {
      actorUserId: actor.userId,
      action: 'company.create',
      entityType: 'Branch',
      entityId: company.id,
      outcome: 'SUCCESS',
      metadata: { name: company.name },
    },
  });
  return company;
}
