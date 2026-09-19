import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { TourPublicService } from './tour-public.service';

@Controller('ticket-catalog/tours')
@UseGuards(AuthGuard)
export class TourController {
  constructor(
    @Inject(TourPublicService) private readonly service: TourPublicService,
  ) {}
  @Get('packages') packages(@Req() req: AuthenticatedRequest) {
    return this.service.packages(req.actor);
  }
  @Get('departures') departures(@Req() req: AuthenticatedRequest) {
    return this.service.departures(req.actor);
  }
  @Post('packages') createPackage(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.createPackage(body, req.actor, branch, key);
  }
  @Post('departures') createDeparture(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.createDeparture(body, req.actor, branch, key);
  }
}
