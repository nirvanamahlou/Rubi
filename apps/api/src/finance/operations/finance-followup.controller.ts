import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { FinanceFollowupService } from './finance-followup.service';

@Controller('finance/followup')
@UseGuards(AuthGuard)
export class FinanceFollowupController {
  constructor(
    @Inject(FinanceFollowupService)
    private readonly service: FinanceFollowupService,
  ) {}
  @Get('branches') @Header('Cache-Control', 'private, no-store') branches(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.branches(req.actor);
  }
  @Get('views') @Header('Cache-Control', 'private, no-store') views(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.views(req.actor);
  }
  @Post('views') @Header('Cache-Control', 'private, no-store') save(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.saveView(body, req.actor);
  }
  @Post('views/:id/remove') remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeView(id, req.actor);
  }
  @Get('policy') @Header('Cache-Control', 'private, no-store') policy(
    @Query('branchId') branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.policy(branchId, req.actor);
  }
  @Post('policy') @Header('Cache-Control', 'private, no-store') set(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.setPolicy(body, req.actor);
  }
}
