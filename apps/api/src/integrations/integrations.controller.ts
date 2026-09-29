import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ProcurementSupplierInboundEventV1 } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { Public, RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { ProcurementSupplierIntegrationService } from './procurement-supplier.integration';

@Controller('integrations/procurement')
export class IntegrationsController {
  constructor(
    @Inject(ProcurementSupplierIntegrationService)
    private readonly supplier: ProcurementSupplierIntegrationService,
  ) {}

  @Post('supplier-orders/dispatch')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.order.issue')
  dispatch(@Req() request: AuthenticatedRequest) {
    return this.supplier.dispatch(request.actor.branchIds);
  }

  @Post('supplier-events')
  @Public()
  receive(
    @Body() input: ProcurementSupplierInboundEventV1,
    @Headers('x-rubi-timestamp') timestamp?: string,
    @Headers('x-rubi-signature') signature?: string,
  ) {
    return this.supplier.receive(input, timestamp, signature);
  }
}
