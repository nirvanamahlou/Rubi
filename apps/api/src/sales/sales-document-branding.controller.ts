import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Req,
  StreamableFile,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { DocumentsService } from '../documents/documents.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { SalesService } from './sales.service';

@Controller('sales/contracts/:id/travel-documents')
@UseGuards(AuthGuard)
export class SalesDocumentBrandingController {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(TravelWorkflowService)
    private readonly travel: TravelWorkflowService,
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}
  @Get('branding-logo')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @Header('X-Content-Type-Options', 'nosniff')
  async logo(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const { data: contract } = await this.sales.detail(id, req.actor);
    const intake = await this.travel.forContract(id, [contract.branchId]);
    const release = await this.delivery.readCustomerContract(id);
    if (
      !release.approved ||
      contract.status === 'CANCELLED' ||
      intake.workflow.supplierStatus === 'CANCELLED'
    )
      throw new ForbiddenException(
        'مدارک مسافر تا تأیید تحویل مدارک توسط مالی در دسترس فروش نیست.',
      );
    const actor = {
      ...req.actor,
      branchIds: [...new Set([...req.actor.branchIds, intake.branchId])],
    };
    const output = await this.travel.floatingDocumentOutput(intake, actor);
    const logoId = output.workflow.branding?.logoFileId;
    if (!logoId)
      throw new NotFoundException('لوگوی این رکورد قابل مشاهده نیست.');
    try {
      const file = await this.documents.previewReleasedTravelLogo(
        logoId,
        actor,
        {
          ...(req.ip ? { ipAddress: req.ip } : {}),
          ...(req.headers['user-agent']
            ? { userAgent: req.headers['user-agent'] }
            : {}),
        },
      );
      return new StreamableFile(file.stream, { type: file.mimeType });
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      )
        throw new NotFoundException('لوگوی این رکورد قابل مشاهده نیست.');
      throw error;
    }
  }
}
