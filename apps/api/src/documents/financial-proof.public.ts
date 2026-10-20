import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@nora/database';

/** Documents-owned transactional proof guard. Caller must first authorize detail access. */
export async function assertFinancialProofVersion(
  tx: Prisma.TransactionClient,
  input: { documentId: string; versionId: string; branchId: string },
) {
  await tx.$queryRaw`SELECT id FROM documents WHERE id=${input.documentId}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM document_versions WHERE id=${input.versionId}::uuid FOR SHARE`;
  const document = await tx.document.findFirst({
    where: {
      id: input.documentId,
      branchId: input.branchId,
      deletedAt: null,
      archiveStatus: 'ACTIVE',
      isIncomplete: false,
      currentVersionId: input.versionId,
      currentVersion: { scanStatus: 'CLEAN' },
    },
    select: { id: true },
  });
  if (!document)
    throw new ConflictException(
      'نسخه پاک و کامل مدرک هزینه تغییر کرده یا در دسترس نیست.',
    );
}
