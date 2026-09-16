import { Inject, Injectable } from '@nestjs/common';
import type { ProcurementDraftV1 } from '@nora/contracts';
import { SettingsProcurementPolicyService } from '../settings/settings-procurement-policy.service';
import type { ApprovalPolicy } from './domain/procurement.rules';

/** Settings owns approval and publishes a versioned artifact; no artifact means no submission. */
@Injectable()
export class ProcurementPolicyPort {
  constructor(
    @Inject(SettingsProcurementPolicyService)
    private readonly settings?: SettingsProcurementPolicyService,
  ) {}

  async resolve(draft: ProcurementDraftV1): Promise<ApprovalPolicy | null> {
    const policy = await this.settings?.resolve(draft);
    return policy ? { ...policy, source: 'SETTINGS' } : null;
  }
}
