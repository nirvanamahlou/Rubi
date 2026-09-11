import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import Joi from 'joi';
import type { AuthenticatedActor, CustomerDetail } from '@rubi/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CustomerService } from '../customers/customer.service';
import {
  DocumentsService,
  type UploadedDocumentFile,
  type DocumentRequestMetadata,
} from '../documents/documents.service';
import { TravelWorkflowService } from './travel-workflow.service';
const uuid = Joi.string().uuid().required();
const namesSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  version: Joi.number().integer().min(1).required(),
});
const uploadSchema = Joi.object({
  passengerId: Joi.string().uuid().allow(''),
  documentTypeId: uuid,
  categoryId: uuid,
  validUntil: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(''),
  description: Joi.string().max(1000).allow(''),
});
function parse<T>(schema: Joi.Schema, value: unknown): T {
  const result = schema.validate(value, { convert: false });
  if (result.error)
    throw new BadRequestException('اطلاعات واردشده معتبر نیست.');
  return result.value as T;
}
export function passengerDocumentSource(
  contractId: string,
  passengerId?: string,
) {
  return {
    sourceModule: passengerId ? 'reservations' : 'sales',
    sourceEntityType: passengerId ? 'SalesContractPassenger' : 'SalesContract',
    sourceEntityId: passengerId ? `${contractId}:${passengerId}` : contractId,
  };
}
function nameView(
  customer: CustomerDetail,
  ageCategory?: 'ADT' | 'CHD' | 'INF',
  sensitive = false,
) {
  const nationalId = sensitive
    ? (customer.nationalId ?? customer.maskedNationalId)
    : (customer.maskedNationalId ?? null);
  const passportNumber = sensitive
    ? (customer.passportNumber ?? customer.maskedPassportNumber)
    : (customer.maskedPassportNumber ?? null);
  return {
    id: customer.id,
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    displayName: customer.displayName,
    ageCategory:
      ageCategory === 'ADT'
        ? ('ADL' as const)
        : ageCategory === 'CHD' || ageCategory === 'INF'
          ? ageCategory
          : null,
    passportFirstName: customer.passportFirstName ?? null,
    passportLastName: customer.passportLastName ?? null,
    gender: customer.gender ?? null,
    nationalityCode: customer.nationalityCode ?? null,
    birthDate: sensitive ? customer.birthDate : null,
    birthDateMasked:
      customer.birthDateMasked || Boolean(!sensitive && customer.birthDate),
    nationalId,
    nationalIdMasked: Boolean(
      nationalId && (!sensitive || !customer.nationalId),
    ),
    passportNumber,
    passportNumberMasked: Boolean(
      passportNumber && (!sensitive || !customer.passportNumber),
    ),
    passportExpiryDate: customer.passportExpiryDate ?? null,
    passportIssuePlace: customer.passportIssuingCountryCode ?? null,
    birthCountryCode: customer.birthCountryCode ?? null,
    version: customer.version,
  };
}
@Injectable()
export class ReservationPassengerFilesService {
  constructor(
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}
  private require(actor: AuthenticatedActor, permissions: readonly string[]) {
    if (
      !permissions.every((p) =>
        (actor.permissions as readonly string[]).includes(p),
      )
    )
      throw new ForbiddenException('مجوز انجام این عملیات وجود ندارد.');
  }
  private async intake(
    id: string,
    actor: AuthenticatedActor,
    passengerId?: string,
  ) {
    this.require(actor, ['reservations.read']);
    const intake = await this.workflow.detail(id, actor.branchIds);
    if (passengerId && !intake.snapshot.passengerIds.includes(passengerId))
      throw new NotFoundException('مسافر متعلق به این قرارداد نیست.');
    return intake;
  }
  async passengers(id: string, actor: AuthenticatedActor, traceId?: string) {
    this.require(actor, ['customers.read']);
    const intake = await this.intake(id, actor);
    const canReadSensitive = actor.permissions.includes(
      'customers.sensitive.read',
    );
    const data = [];
    for (const customerId of [...new Set(intake.snapshot.passengerIds)]) {
      const { data: customer } = await this.customers.detail(
        customerId,
        actor,
        traceId,
        canReadSensitive ? 'customer-verification' : undefined,
      );
      const assignment = intake.snapshot.passengerAssignments?.find(
        (item) => item.customerId === customerId,
      );
      data.push(nameView(customer, assignment?.ageCategory, canReadSensitive));
    }
    return {
      data,
      canEdit: actor.permissions.includes('customers.update'),
    };
  }
  async rename(
    id: string,
    passengerId: string,
    raw: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, ['customers.read', 'customers.update']);
    await this.intake(id, actor, passengerId);
    const input = parse<{
      firstName: string;
      lastName: string;
      version: number;
    }>(namesSchema, raw);
    const { data: current } = await this.customers.detail(passengerId, actor);
    if (current.kind !== 'person')
      throw new BadRequestException('فقط نام مسافر حقیقی قابل ویرایش است.');
    // Keep non-name fields, protected identity values and commercial snapshots untouched.
    const result = await this.customers.update(
      passengerId,
      {
        kind: current.kind,
        organizationId: current.organizationId,
        roles: current.roles,
        acquaintanceMethodId: current.acquaintanceMethodId,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: `${input.firstName.trim()} ${input.lastName.trim()}`,
        version: input.version,
      },
      actor,
      current.ownerBranchId,
    );
    return { data: nameView(result.data) };
  }
  async options(id: string, actor: AuthenticatedActor) {
    this.require(actor, ['documents.list']);
    await this.intake(id, actor);
    const result = await this.documents.options(actor);
    return {
      ...result,
      canUpload:
        actor.permissions.includes('documents.upload') &&
        actor.permissions.includes('reservations.documents.manage'),
    };
  }
  async list(
    id: string,
    passengerId: string | undefined,
    categoryId: string | undefined,
    page: string | undefined,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, ['documents.list']);
    const intake = await this.intake(id, actor, passengerId);
    const numericPage = Number(page ?? 1);
    if (
      !Number.isInteger(numericPage) ||
      numericPage < 1 ||
      numericPage > 10000
    )
      throw new BadRequestException();
    if (categoryId) parse(uuid, categoryId);
    return this.documents.list(
      {
        branchId: intake.branchId,
        ...passengerDocumentSource(intake.contractId, passengerId),
        ...(categoryId ? { categoryId } : {}),
        page: numericPage,
        pageSize: 20,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
      actor,
    );
  }
  async upload(
    id: string,
    raw: unknown,
    file: UploadedDocumentFile | undefined,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ) {
    this.require(actor, [
      'customers.read',
      'documents.upload',
      'documents.list',
      'reservations.documents.manage',
    ]);
    const input = parse<{
      passengerId?: string;
      documentTypeId: string;
      categoryId: string;
      validUntil?: string;
      description?: string;
    }>(uploadSchema, raw);
    const intake = await this.intake(id, actor, input.passengerId);
    const passenger = input.passengerId
      ? (await this.customers.detail(input.passengerId, actor)).data
      : null;
    const options = await this.documents.options(actor);
    const type = options.data.documentTypes.find(
      (t) => t.id === input.documentTypeId,
    );
    if (
      !type ||
      !['TRAVEL', 'SALES', 'CUSTOMER_IDENTITY', 'GENERAL'].includes(type.domain)
    )
      throw new BadRequestException('نوع مدرک برای قرارداد سفر معتبر نیست.');
    if (type.requiresExpiry && !input.validUntil)
      throw new BadRequestException('تاریخ انقضای این مدرک را وارد کنید.');
    if (input.validUntil) {
      const date = new Date(input.validUntil);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== input.validUntil
      )
        throw new BadRequestException('تاریخ انقضا معتبر نیست.');
    }
    const label = `${intake.snapshot.contractNumber} · ${passenger?.displayName ?? 'مدارک عمومی قرارداد'}`;
    return this.documents.upload(
      {
        title: `${type.name} · ${label}`.slice(0, 240),
        description: input.description ?? '',
        documentTypeId: input.documentTypeId,
        categoryId: input.categoryId,
        branchId: intake.branchId,
        ownerUserId: actor.userId,
        ...passengerDocumentSource(intake.contractId, input.passengerId),
        sourceDisplayLabel: label.slice(0, 240),
        confidentiality: 'RESTRICTED',
        ...(input.validUntil ? { validUntil: input.validUntil } : {}),
      },
      file,
      actor,
      metadata,
    );
  }
}
@Controller('reservations/requests/:intakeId')
@UseGuards(AuthGuard, PermissionGuard)
export class ReservationPassengerFilesController {
  constructor(
    @Inject(ReservationPassengerFilesService)
    private readonly service: ReservationPassengerFilesService,
  ) {}
  @Get('passengers')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('reservations.read', 'customers.read')
  passengers(
    @Param('intakeId') id: string,
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.passengers(id, req.actor, traceId);
  }
  @Patch('passengers/:passengerId')
  @RequirePermissions('reservations.read', 'customers.read', 'customers.update')
  rename(
    @Param('intakeId') id: string,
    @Param('passengerId') passengerId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.rename(id, passengerId, body, req.actor);
  }
  @Get('documents/options')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('reservations.read', 'documents.list')
  options(@Param('intakeId') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.options(id, req.actor);
  }
  @Get('documents')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('reservations.read', 'documents.list')
  list(
    @Param('intakeId') id: string,
    @Query('passengerId') passengerId: string | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Query('page') page: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(id, passengerId, categoryId, page, req.actor);
  }
  @Post('documents')
  @RequirePermissions(
    'reservations.read',
    'customers.read',
    'documents.upload',
    'documents.list',
    'reservations.documents.manage',
  )
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 25 * 1024 * 1024, fields: 5 },
    }),
  )
  upload(
    @Param('intakeId') id: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.upload(id, body, file, req.actor, {
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(req.headers['user-agent']
        ? { userAgent: req.headers['user-agent'] }
        : {}),
    });
  }
}
