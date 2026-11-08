import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';

@Controller('hr/companies')
@UseGuards(AuthGuard)
export class HrCompaniesController {
  constructor(@Inject(IamService) private readonly iam: IamService) {}
  @Post()
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.iam.createHrCompany(body, request.actor);
  }
}
