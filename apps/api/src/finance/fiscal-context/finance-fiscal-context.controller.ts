import {
  Controller,
  Get,
  Header,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { FinanceFiscalContextService } from './finance-fiscal-context.service';

@Controller('finance/fiscal-context')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read')
export class FinanceFiscalContextController {
  constructor(
    @Inject(FinanceFiscalContextService)
    private readonly fiscal: FinanceFiscalContextService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  current(@Req() request: AuthenticatedRequest) {
    return this.fiscal.current(request.actor);
  }
}
