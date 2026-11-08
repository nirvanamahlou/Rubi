import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Module,
} from '@nestjs/common';
import type { ExchangeOfficeInputV1 } from '@nora/contracts';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { IamModule } from '../../iam/iam.module';
import { MasterDataModule } from '../../master-data/master-data.module';
import { ExchangeOfficeService } from './exchange-office.service';
@Controller('finance/exchange-offices')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read')
export class ExchangeOfficeController {
  constructor(
    @Inject(ExchangeOfficeService)
    private readonly service: ExchangeOfficeService,
  ) {}
  @Get('options') @Header('Cache-Control', 'private, no-store') options(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.options(req.actor);
  }
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Query() query: Record<string, string>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(query, req.actor);
  }
  @Post() @RequirePermissions('finance.account.manage') save(
    @Body() body: ExchangeOfficeInputV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.save(null, body, req.actor);
  }
  @Patch(':id') @RequirePermissions('finance.account.manage') update(
    @Param('id') id: string,
    @Body() body: ExchangeOfficeInputV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.save(id, body, req.actor);
  }
  @Delete(':id') @RequirePermissions('finance.account.manage') remove(
    @Param('id') id: string,
    @Body() body: { expectedVersion: number },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(id, body?.expectedVersion, req.actor);
  }
}
@Module({
  imports: [IamModule, MasterDataModule],
  controllers: [ExchangeOfficeController],
  providers: [ExchangeOfficeService, AuthGuard, PermissionGuard],
})
export class ExchangeOfficeModule {}
