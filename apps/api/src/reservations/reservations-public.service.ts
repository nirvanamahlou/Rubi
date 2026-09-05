import { createHash } from 'node:crypto';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { SalesReservationRequestV1 } from '@rubi/contracts';
import type { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';

/** Public module boundary. Only the trusted Sales outbox invokes intake, never a browser payload. */
@Injectable()
export class ReservationsPublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async receive(snapshot: SalesReservationRequestV1, branchId: string) {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ branchId, snapshot }))
      .digest('hex');
    const row = await this.database.client.reservationIntake.upsert({
      where: { requestId: snapshot.requestId },
      update: {},
      create: {
        requestId: snapshot.requestId,
        contractId: snapshot.contractId,
        contractVersion: snapshot.contractVersion,
        branchId,
        fingerprint,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    if (row.fingerprint !== fingerprint)
      throw new ConflictException(
        'نسخه درخواست رزرو با اطلاعات قبلی متفاوت است.',
      );
    return { id: row.id, requestId: row.requestId, status: row.status };
  }

  list(branchIds: readonly string[]) {
    return this.database.client.reservationIntake.findMany({
      where: { branchId: { in: [...branchIds] } },
      orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
  }
}
