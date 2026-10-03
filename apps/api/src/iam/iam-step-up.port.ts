import type { AuthenticatedActor } from '@nora/contracts';

import type { RequestMetadata } from './iam.types';

export const IAM_STEP_UP_PORT = Symbol('IAM_STEP_UP_PORT');

export interface IamStepUpPort {
  verifyStepUp(
    actor: AuthenticatedActor,
    code: string,
    metadata: RequestMetadata,
  ): Promise<void>;
}
