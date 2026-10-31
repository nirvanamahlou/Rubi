import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { Public } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { NiyayeshSsoService } from './niyayesh-sso.service';

@Controller('integrations/v1/niyayesh/sso')
export class NiyayeshSsoController {
  constructor(
    @Inject(NiyayeshSsoService) private readonly service: NiyayeshSsoService,
  ) {}
  @Get('access')
  @UseGuards(AuthGuard, PermissionGuard)
  @Header('Cache-Control', 'private, no-store')
  access(@Req() r: AuthenticatedRequest, @Query('branchId') branch: string) {
    return this.service.access(r.actor, branch);
  }
  @Post('session')
  @Public()
  @Header('Cache-Control', 'no-store')
  inspect(
    @Headers('authorization') auth: string | undefined,
    @Body() input: unknown,
  ) {
    return this.service.inspect(auth, input);
  }
}
