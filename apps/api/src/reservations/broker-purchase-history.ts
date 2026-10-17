import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';

export interface BrokerPurchaseRow {
  id: string;
  contractId: string;
  contractNumber: string;
  serviceTitle: string;
  amount: string;
  currencyCode: string;
  createdAt: string;
}
@Injectable()
export class BrokerPurchaseHistory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async list(brokerId: string, actor: AuthenticatedActor, pageText = '1') {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException();
    const page = Number(pageText);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
      throw new BadRequestException();
    if (!actor.branchIds.length) return { data: [], page, hasMore: false };
    // Select the current revision BEFORE filtering the broker: reassignment must
    // not leave the old supplier with a second current purchase.
    const rows = await this.database.client.$queryRaw<
      BrokerPurchaseRow[]
    >(Prisma.sql`
      SELECT p.id, i."contractId", COALESCE(i.snapshot->>'contractNumber','') AS "contractNumber",
        p."serviceTitleSnapshot" AS "serviceTitle", p.amount::text AS amount, p."currencyCode",
        to_char(p."createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
      FROM "ReservationServicePurchase" p JOIN "ReservationIntake" i ON i.id=p."intakeId"
      WHERE i."branchId" IN (${Prisma.join(actor.branchIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND (p."supplierBrokerId"=${brokerId}::uuid OR p."supplierOrganizationId"=${brokerId}::uuid)
        AND NOT EXISTS (
          SELECT 1 FROM "ReservationServicePurchase" newer
          WHERE newer."intakeId"=p."intakeId" AND newer.version>p.version
            AND (newer."serviceClientKey"=p."serviceClientKey"
              OR newer."coveredServiceClientKeys" ? p."serviceClientKey"
              OR p."coveredServiceClientKeys" ? newer."serviceClientKey")
        )
      ORDER BY p."createdAt" DESC, p.id DESC LIMIT 26 OFFSET ${(page - 1) * 25}
    `);
    return { data: rows.slice(0, 25), page, hasMore: rows.length > 25 };
  }
}
@Controller('reservations/brokers')
@UseGuards(AuthGuard)
export class BrokerPurchaseHistoryController {
  constructor(
    @Inject(BrokerPurchaseHistory)
    private readonly history: BrokerPurchaseHistory,
  ) {}
  @Get(':id/purchases')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
  ) {
    return this.history.list(id, req.actor, page);
  }
}
