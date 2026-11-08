import {
  Controller,
  ForbiddenException,
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
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
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
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async summary(
    @Param('contractId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.sales.detail(id, req.actor);
    const intake = await this.travel.forContract(id, req.actor.branchIds);
    await this.assertReleased(id);
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
    await this.assertReleased(id);
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
  private async assertReleased(id: string) {
    const authorization = await this.delivery.readCustomerContract(id);
    if (!authorization.approved)
      throw new ForbiddenException(
        'مدارک مسافر تا تأیید تحویل مدارک توسط مالی در دسترس فروش نیست.',
      );
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
