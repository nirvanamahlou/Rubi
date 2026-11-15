import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { SalesFinanceContractRead } from '../sales/finance-contract-read.public';

@Controller('finance/source-contracts')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read')
export class FinanceSourceReadController {
  constructor(
    @Inject(SalesFinanceContractRead)
    private readonly contracts: SalesFinanceContractRead,
  ) {}
  @Get(':id/read')
  @Header('Cache-Control', 'private, no-store')
  read(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.contracts.read(id, request.actor);
  }
}
