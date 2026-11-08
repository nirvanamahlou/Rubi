import {
  Controller,
  Get,
  Post,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { SalesService } from './sales.service';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { InsuranceAutomation } from '../reservations/insurance/insurance-automation';

@Controller('sales/contracts/:contractId/insurance')
@UseGuards(AuthGuard)
export class SalesInsuranceDocumentsController {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(TravelWorkflowService)
    private readonly travel: TravelWorkflowService,
    @Inject(InsuranceAutomation)
    private readonly insurance: InsuranceAutomation,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async summary(
    @Param('contractId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.sales.detail(id, req.actor);
    const intake = await this.travel.forContract(id, req.actor.branchIds);
    return this.insurance.summary(intake.id, req.actor, id);
  }
  @Get('pdf/:policyId')
  @Header('Cache-Control', 'private, no-store')
  async pdf(
    @Param('contractId', ParseUUIDPipe) id: string,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sales.detail(id, req.actor);
    const intake = await this.travel.forContract(id, req.actor.branchIds);
    const result = await this.insurance.download(
      intake.id,
      req.actor,
      policyId,
      id,
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(result.bytes, { type: result.type });
  }
  @Post('prepare')
  async prepare(
    @Param('contractId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.sales.detail(id, req.actor);
    const intake = await this.travel.forContract(id, req.actor.branchIds);
    return this.insurance.prepare(intake.id, req.actor, id);
  }
}
