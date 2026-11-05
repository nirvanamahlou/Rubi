import { Module, Injectable, Inject, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentsService } from '../documents/documents.service';
import {
  registerPettyCash,
  validatePettyReceipt,
} from './procurement.registrations';
@Injectable()
export class ProcurementMissionPort {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}
  validateReceipt(
    receipt: unknown,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    return validatePettyReceipt(receipt, branchId, actor, this.documents);
  }
  register(
    tx: Prisma.TransactionClient,
    body: unknown,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('hr.manage'))
      throw new ForbiddenException();
    // The owner validates fund custodian/manager, branch, evidence, balance and replay.
    return registerPettyCash(this.database, this.documents, body, actor, tx);
  }
}
@Module({
  imports: [DocumentsModule],
  providers: [ProcurementMissionPort],
  exports: [ProcurementMissionPort],
})
export class ProcurementMissionModule {}
