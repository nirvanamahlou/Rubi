import {
  Body,
  Controller,
  Headers,
  Inject,
  Module,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { TicketCatalogPurchaseCreateV1 } from '@nora/contracts';
import { DocumentsModule } from '../documents/documents.module';
import { HrProcurementModule } from '../hr/hr-procurement.module';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { TasksModule } from '../tasks/tasks.module';
import { ProcurementController } from './procurement.controller';
import { ProcurementExports } from './procurement.exports';
import { ProcurementOperations } from './procurement.operations';
import { ProcurementPolicyPort } from './procurement.ports';
import { ProcurementPublicService } from './procurement-public.service';
import { ProcurementService } from './procurement.service';

@Controller('procurement/ticket-purchases')
@UseGuards(AuthGuard)
class ProcurementTicketPurchasesController {
  constructor(
    @Inject(ProcurementPublicService)
    private readonly service: ProcurementPublicService,
  ) {}

  @Post()
  register(
    @Body() input: TicketCatalogPurchaseCreateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.registerTicketPurchase(input, req.actor, branchId, key);
  }
}

@Module({
  imports: [
    IamModule,
    HrProcurementModule,
    MasterDataModule,
    DocumentsModule,
    LegalEntitiesModule,
    NotificationsModule,
    SettingsModule,
    TasksModule,
  ],
  controllers: [ProcurementController, ProcurementTicketPurchasesController],
  providers: [
    AuthGuard,
    ProcurementPolicyPort,
    ProcurementOperations,
    ProcurementService,
    ProcurementExports,
    ProcurementPublicService,
  ],
  exports: [ProcurementService, ProcurementPublicService],
})
export class ProcurementModule {}
