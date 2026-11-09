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
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ContractCompanyScope } from '../sales/contract-company-scope.public';

@Controller('legal-entities/contract-archive')
@UseGuards(AuthGuard)
export class ContractArchiveController {
  constructor(
    @Inject(ContractCompanyScope) private readonly scope: ContractCompanyScope,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Req() req: AuthenticatedRequest,
    @Query('search') search: unknown,
    @Query('page') page: unknown,
  ) {
    return this.scope.hidden(req.actor, search, page);
  }
  @Post('restore')
  restore(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.scope.restore(req.actor, body);
  }
}
