import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { SalesRepository } from './sales.repository';
@Injectable()
export class SalesAssistantConfirmationService {
  constructor(
    @Inject(SalesRepository) private readonly repository: SalesRepository,
  ) {}
  assistantConfirmedContracts(
    ids: readonly string[],
    actor: AuthenticatedActor,
    now: Date,
  ) {
    if (!actor.permissions.includes('sales.contracts.read.all'))
      throw new ForbiddenException('SALES_ALL_READ_REQUIRED');
    const unique = [...new Set(ids)];
    if (
      unique.length > 5000 ||
      unique.some(
        (id) => !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id),
      )
    )
      throw new BadRequestException('ASSISTANT_FIXED_SCOPE');
    return this.repository.assistantConfirmedContracts(
      unique,
      actor.branchIds,
      now,
    );
  }
}
