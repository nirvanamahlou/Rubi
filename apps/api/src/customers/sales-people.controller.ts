import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CustomerListQuery } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CustomerContactDto,
  CustomerListQueryDto,
  CustomerMutationDto,
  CustomerRegistrationLookupDto,
} from './customer.dto';
import { CustomerService } from './customer.service';
/** Person operations consumed only by the complete new-contract workflow. */
@Controller('sales/people')
@UseGuards(AuthGuard)
export class SalesPeopleController {
  constructor(
    @Inject(CustomerService) private readonly service: CustomerService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: CustomerListQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.list(
      { ...query, kind: 'person', status: 'active' } as CustomerListQuery,
      this.service.salesEntryActor(req.actor),
    );
  }
  @Post('registration-lookup')
  @Header('Cache-Control', 'private, no-store')
  lookup(
    @Body() dto: CustomerRegistrationLookupDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') trace?: string,
  ) {
    return this.service.registrationLookup(
      dto,
      this.service.salesEntryActor(req.actor),
      trace,
    );
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') trace?: string,
  ) {
    return this.service.detail(
      id,
      this.service.salesEntryActor(req.actor),
      trace,
      'customer-verification',
    );
  }
  @Post()
  create(
    @Body() dto: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch?: string,
    @Headers('x-request-id') trace?: string,
    @Headers('x-registration-key') registrationKey?: string,
  ) {
    const actor = this.service.salesEntryActor(req.actor);
    if (dto.kind !== 'person') throw new BadRequestException();
    if (
      registrationKey &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        registrationKey,
      )
    )
      throw new BadRequestException('Invalid registration key.');
    return this.service.createForSales(
      dto,
      actor,
      branch,
      trace,
      registrationKey,
    );
  }
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch?: string,
    @Headers('x-request-id') trace?: string,
  ) {
    const actor = this.service.salesEntryActor(req.actor);
    if (dto.kind !== 'person') throw new BadRequestException();
    const current = await this.service.detail(id, actor, trace);
    if (current.data.kind !== 'person') throw new BadRequestException();
    return this.service.update(id, dto, actor, branch, trace);
  }
  @Post(':id/contacts')
  contact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerContactDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch?: string,
    @Headers('x-request-id') trace?: string,
  ) {
    return this.service.addContact(
      id,
      dto,
      this.service.salesEntryActor(req.actor),
      branch,
      trace,
    );
  }
}
