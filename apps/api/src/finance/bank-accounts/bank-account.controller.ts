import {
  Body,
  Delete,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import { PermissionGuard } from '../../iam/permission.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { BankAccountService } from './bank-account.service';

@Controller('finance/banks/:bankId/accounts')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read', 'master_data.read')
export class BankAccountController {
  constructor(
    @Inject(BankAccountService) private readonly service: BankAccountService,
  ) {}
  @Get('options') @Header('Cache-Control', 'private, no-store') options(
    @Param('bankId') bankId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.options(bankId, req.actor);
  }
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Param('bankId') bankId: string,
    @Query('page') page: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(bankId, page, req.actor);
  }
  @Post()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(
    'finance.read',
    'master_data.read',
    'finance.account.manage',
  )
  save(
    @Param('bankId') bankId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.save(bankId, null, body, req.actor);
  }
  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(
    'finance.read',
    'master_data.read',
    'finance.account.manage',
  )
  update(
    @Param('bankId') bankId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.save(bankId, id, body, req.actor);
  }
  @Post(':id/details')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(
    'finance.read',
    'master_data.read',
    'finance.account.manage',
  )
  details(
    @Param('bankId') bankId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.details(bankId, id, req.actor);
  }
  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(
    'finance.read',
    'master_data.read',
    'finance.account.manage',
  )
  remove(
    @Param('bankId') bankId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(bankId, id, body, req.actor);
  }
}
