import { Module } from '@nestjs/common';
import { HrProcurementDirectory } from './hr-procurement-directory';

/** Public HR projection boundary, independent of interactive HR workflows. */
@Module({
  providers: [HrProcurementDirectory],
  exports: [HrProcurementDirectory],
})
export class HrProcurementModule {}
