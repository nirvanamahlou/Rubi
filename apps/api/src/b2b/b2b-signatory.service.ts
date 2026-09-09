import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  b2bSignatoryIssue,
  type AuthenticatedActor,
  type B2bSignatoryV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import { B2bAgreementDocuments } from './b2b-agreement-documents';
import { B2bSignatoryRepository } from './b2b-signatory.repository';
import type { SaveB2bSignatoryDto } from './b2b-signatory.dto';
import type { DeleteB2bRecordDto } from './b2b.dto';
type Row = NonNullable<Awaited<ReturnType<B2bSignatoryRepository['find']>>>;
@Injectable()
export class B2bSignatoryService {
  constructor(
    @Inject(B2bSignatoryRepository)
    private readonly repository: B2bSignatoryRepository,
    @Inject(MasterOrganizationDirectory)
    private readonly organizations: MasterOrganizationDirectory,
    @Inject(B2bAgreementDocuments)
    private readonly documents: B2bAgreementDocuments,
  ) {}
  private scope(
    organizationId: string,
    branchId: string,
    actor: AuthenticatedActor,
    write = false,
  ) {
    if (
      !actor.permissions.includes(
        write ? 'b2b.agency.manage' : 'b2b.agency.read',
      ) ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException(
        'مجوز امضاداران یا دسترسی به این شعبه را ندارید.',
      );
    return { organizationId, branchId };
  }
  private async record(
    row: Row,
    actor: AuthenticatedActor,
    contact?: { fullName: string; isActive: boolean },
  ): Promise<B2bSignatoryV1> {
    const canReadProof = [
      'documents.list',
      'documents.organization.read',
      'documents.metadata.read',
    ].every((p) =>
      actor.permissions.includes(p as (typeof actor.permissions)[number]),
    );
    const refs =
      row.documentVersionId && canReadProof
        ? await this.documents.referenceMap(
            [row.documentVersionId],
            row.organizationId,
            row.branchId,
            actor,
          )
        : new Map<string, string>();
    return {
      id: row.id,
      organizationId: row.organizationId,
      branchId: row.branchId,
      contactId: row.contactId,
      contactName: contact?.fullName ?? 'شخص ثبت‌شده',
      contactActive: contact?.isActive ?? false,
      documentTypes: row.documentTypes as B2bSignatoryV1['documentTypes'],
      authorityLimit: row.authorityLimit?.toString() ?? null,
      currencyCode: row.currencyCode,
      validFrom: row.validFrom.toISOString().slice(0, 10),
      validTo: row.validTo?.toISOString().slice(0, 10) ?? null,
      documentId: row.documentVersionId
        ? (refs.get(row.documentVersionId) ?? null)
        : null,
      documentVersionId: row.documentVersionId,
      isActive: row.isActive,
      notes: row.notes,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  async list(
    organizationId: string,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    const rows = await this.repository.list(
      this.scope(organizationId, branchId, actor),
    );
    const contacts = await this.organizations.signatoryContactNames(
      organizationId,
      [...new Set(rows.map((row) => row.contactId))],
    );
    const names = new Map(contacts.map((contact) => [contact.id, contact]));
    return {
      data: await Promise.all(
        rows.map((row) => this.record(row, actor, names.get(row.contactId))),
      ),
    };
  }
  async save(
    organizationId: string,
    input: SaveB2bSignatoryDto,
    actor: AuthenticatedActor,
    id?: string,
  ) {
    const scope = this.scope(organizationId, input.branchId, actor, true);
    const issue = b2bSignatoryIssue(input);
    if (issue) throw new BadRequestException(issue);
    if (id && !input.version)
      throw new BadRequestException('نسخه امضادار برای ویرایش لازم است.');
    if (id && !(await this.repository.find(scope, id)))
      throw new NotFoundException('امضادار در این پرونده یافت نشد.');
    if (
      !(await this.organizations.signatoryContactReference(
        organizationId,
        input.contactId,
      ))
    )
      throw new BadRequestException(
        'شخص امضادار باید مخاطب فعال همین سازمان باشد.',
      );
    if (
      input.currencyCode &&
      !(
        await this.organizations.activeCurrencyCodes([input.currencyCode])
      ).includes(input.currencyCode)
    )
      throw new BadRequestException('ارز فعال و معتبر را انتخاب کنید.');
    if (
      input.isActive &&
      input.validTo &&
      input.validTo < new Date().toISOString().slice(0, 10)
    )
      throw new BadRequestException(
        'امضادار با اعتبار پایان‌یافته نمی‌تواند فعال شود.',
      );
    let documentVersionId: string | null = null;
    if (input.documentId) {
      const proof = await this.documents.assertDraftReference(
        input.documentId,
        organizationId,
        input.branchId,
        actor,
      );
      if (
        input.documentVersionId &&
        input.documentVersionId !== proof.versionId
      )
        throw new ConflictException(
          'نسخه مدرک تغییر کرده است؛ مدرک را دوباره انتخاب کنید.',
        );
      documentVersionId = proof.versionId;
    } else if (input.documentVersionId)
      throw new BadRequestException('مدرک اختیار را از فهرست انتخاب کنید.');
    const row = await this.repository.save(
      scope,
      {
        contactId: input.contactId,
        documentTypes: input.documentTypes,
        authorityLimit:
          input.authorityLimit === null
            ? null
            : new Prisma.Decimal(input.authorityLimit),
        currencyCode: input.currencyCode,
        validFrom: new Date(input.validFrom + 'T00:00:00Z'),
        validTo: input.validTo ? new Date(input.validTo + 'T00:00:00Z') : null,
        documentVersionId,
        isActive: input.isActive,
        notes: input.notes.trim(),
      },
      actor.userId,
      id,
      input.version,
    );
    // Write acknowledgement is independent of a subsequent Documents read.
    return { data: { id: row.id, version: row.version } };
  }
  async remove(
    organizationId: string,
    id: string,
    input: DeleteB2bRecordDto,
    actor: AuthenticatedActor,
  ) {
    return {
      data: await this.repository.remove(
        this.scope(organizationId, input.branchId, actor, true),
        id,
        input.version,
        actor.userId,
        input.reason,
      ),
    };
  }
}
