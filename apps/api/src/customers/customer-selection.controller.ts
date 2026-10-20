import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CustomerListQueryDto } from './customer.dto';
import { CustomerService } from './customer.service';

@Controller('customers/selections')
@UseGuards(AuthGuard)
export class CustomerSelectionController {
  constructor(
    @Inject(CustomerService) private readonly customers: CustomerService,
  ) {}
  @Get(':workflow')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  list(
    @Param('workflow') workflow: string,
    @Query() query: CustomerListQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customers.selectionOptions(request.actor, workflow, query);
  }
}
