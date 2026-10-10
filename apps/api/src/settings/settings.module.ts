import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { SettingsProcurementPolicyController } from './settings-procurement-policy.controller';
import { SettingsProcurementPolicyService } from './settings-procurement-policy.service';
import { SettingsRuntimeService } from './settings-runtime.service';

@Module({
  imports: [IamModule],
  controllers: [SettingsProcurementPolicyController],
  providers: [SettingsProcurementPolicyService, SettingsRuntimeService],
  exports: [SettingsProcurementPolicyService, SettingsRuntimeService],
})
export class SettingsModule {}
