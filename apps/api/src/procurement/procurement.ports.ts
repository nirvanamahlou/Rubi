import { Injectable } from '@nestjs/common';
import type { ProcurementDraftV1 } from '@nora/contracts';
import type { ApprovalPolicy } from './domain/procurement.rules';

/** Settings owns policy lifecycle. Replace only with an approved versioned owner adapter. */
@Injectable()
export class ProcurementPolicyPort {
  resolve(_draft: ProcurementDraftV1): Promise<ApprovalPolicy | null> {
    void _draft;
    return Promise.resolve(null);
  }
}
