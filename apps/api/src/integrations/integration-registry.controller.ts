import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { getRequestId } from '../common/request-id.middleware';
import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { IntegrationRegistryService } from './integration-registry.service';

@Controller('integrations/v1')
@UseGuards(AuthGuard, PermissionGuard)
export class IntegrationRegistryController {
  constructor(
    @Inject(IntegrationRegistryService)
    private readonly registry: IntegrationRegistryService,
  ) {}

  @Get('registry')
  @Header('Cache-Control', 'private, no-store')
  read(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId: string,
  ) {
    return this.registry.read(request.actor, branchId);
  }

  @Post('registry')
  @RequirePermissions('system.settings.manage')
  write(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId: string,
    @Body() value: unknown,
  ) {
    return this.registry.write(
      request.actor,
      branchId,
      value,
      getRequestId(request),
    );
  }

  @Post('registry/initialize')
  @RequirePermissions('system.settings.manage')
  initialize(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId: string,
  ) {
    return this.registry.initialize(
      request.actor,
      branchId,
      getRequestId(request),
    );
  }

  @Get('adapters')
  @Header('Cache-Control', 'private, no-store')
  adapters(@Req() request: AuthenticatedRequest) {
    return this.registry.adapters(request.actor);
  }
}
