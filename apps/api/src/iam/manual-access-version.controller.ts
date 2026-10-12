import { Controller, Get } from '@nestjs/common';
import { MANUAL_ACCESS_VERSION } from '@nora/contracts';
import { manualAccessCatalogFingerprint } from './manual-access-policy';

/** Public deployment capability; contains no account or access data. */
@Controller('iam/access-version')
export class ManualAccessVersionController {
  @Get() version() {
    return {
      version: MANUAL_ACCESS_VERSION,
      catalogFingerprint: manualAccessCatalogFingerprint(),
    };
  }
}
