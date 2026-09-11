import {
  Controller,
  Get,
  Header,
  Inject,
  Module,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MasterDataModule } from '../master-data/master-data.module';
import { HrDirectoryService } from './hr-directory.service';

@Controller('hr')
@UseGuards(AuthGuard)
export class HrDirectoryController {
  constructor(
    @Inject(HrDirectoryService) private readonly service: HrDirectoryService,
  ) {}
  @Get('directory')
  @Header('Cache-Control', 'private, no-store')
  employees(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.employees(query, req.actor);
  }
  @Get('form-references')
  @Header('Cache-Control', 'private, no-store')
  references(
    @Query('employeeId') employeeId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.formReferences(req.actor, employeeId);
  }
}
@Module({
  imports: [IamModule, MasterDataModule],
  controllers: [HrDirectoryController],
  providers: [AuthGuard, HrDirectoryService],
  exports: [HrDirectoryService],
})
export class HrDirectoryModule {}
