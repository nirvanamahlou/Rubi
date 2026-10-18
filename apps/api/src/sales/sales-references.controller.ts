import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { canViewRoute } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MasterSalesDirectory } from '../master-data/master-sales-directory';

export class SalesReferenceQuery {
  @IsOptional() @IsString() @MaxLength(100) search = '';
  @IsOptional() @IsIn(['active']) status = 'active';
  @IsOptional() @IsIn(['name']) sortBy = 'name';
  @IsOptional() @IsIn(['asc']) sortDirection = 'asc';
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize = 100;
}

@Controller('sales/form-references')
@UseGuards(AuthGuard)
export class SalesReferencesController {
  constructor(
    @Inject(MasterSalesDirectory)
    private readonly directory: MasterSalesDirectory,
  ) {}

  private authorize(request: AuthenticatedRequest, resource: string) {
    const { permissions, branchIds } = request.actor;
    const contractAccess =
      canViewRoute(permissions, '/sales/contracts/new') ||
      (canViewRoute(permissions, '/sales') &&
        ['sales.contracts.update.own', 'sales.contracts.update.branch'].some(
          (code) => permissions.some((grant) => grant === code),
        ));
    const paymentAccess =
      ['banks', 'currencies'].includes(resource) &&
      canViewRoute(permissions, '/sales') &&
      (permissions.includes('sales.payments.create') ||
        permissions.includes('sales.payments.read'));
    if (!branchIds.length || (!contractAccess && !paymentAccess))
      throw new ForbiddenException();
  }

  @Get(':resource')
  list(
    @Param('resource') resource: string,
    @Query() query: SalesReferenceQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    this.authorize(request, resource);
    return this.directory.list(
      resource,
      query.search,
      query.page,
      query.pageSize,
    );
  }

  @Get(':resource/:id')
  detail(
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.authorize(request, resource);
    return this.directory.detail(resource, id);
  }
}
