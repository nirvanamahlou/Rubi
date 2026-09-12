import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  B2B_DOSSIER_SECTIONS,
  type AuthenticatedActor,
  type B2bOrganizationUser,
  type B2bDossierSection,
  type B2bPortalSection,
} from '@rubi/contracts';
import { IamService } from '../iam/iam.service';
import { passwordPolicyErrors } from '../iam/password-policy';
import type { RequestMetadata } from '../iam/iam.types';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import type {
  CreateB2bOrganizationUserDto,
  SaveB2bOrganizationUserDto,
} from './b2b-organization-user.dto';
import { B2bRepository } from './b2b.repository';
type Membership = NonNullable<
  Awaited<ReturnType<B2bOrganizationUserRepository['byUser']>>
>;
const values = (pairs: Record<string, unknown>) =>
  Object.entries(pairs).map(([label, value]) => ({
    label,
    value: value === null || value === undefined ? '—' : String(value),
  }));
@Injectable()
export class B2bOrganizationUserService {
  constructor(
    @Inject(B2bOrganizationUserRepository)
    private readonly repository: B2bOrganizationUserRepository,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(MasterOrganizationDirectory)
    private readonly organizations: MasterOrganizationDirectory,
    @Inject(B2bRepository) private readonly b2b: B2bRepository,
  ) {}
  private async organization(id: string) {
    const org =
      (await this.organizations.agencyReference(id)) ??
      (await this.organizations.cooperationReference(id, 'CORPORATE_CUSTOMER'));
    if (!org?.isActive)
      throw new ForbiddenException('سازمان فعال در دسترس نیست.');
    return org;
  }
  private async manageScope(
    org: string,
    branch: string,
    actor: AuthenticatedActor,
    write = false,
  ) {
    if (
      !actor.permissions.includes(
        write ? 'b2b.agency.manage' : 'b2b.agency.read',
      ) ||
      !actor.branchIds.includes(branch)
    )
      throw new ForbiddenException(
        'مجوز کاربران یا شعبه این پرونده را ندارید.',
      );
    if (await this.repository.byUser(actor.userId))
      throw new ForbiddenException('کاربر آژانس مجوز مدیریت حساب‌ها را ندارد.');
    await this.organization(org);
  }
  private validate(input: SaveB2bOrganizationUserDto) {
    if (
      !input.roleName.trim() ||
      input.reason.trim().length < 5 ||
      (input.isActive && !input.sections.length)
    )
      throw new BadRequestException(
        'نقش، دلیل تغییر و حداقل یک بخش برای کاربر فعال لازم است.',
      );
  }
  private async records(rows: Membership[]): Promise<B2bOrganizationUser[]> {
    const directory = await this.iam.listUsers();
    const identities = new Map(directory.map((u) => [u.id, u]));
    return rows.map((row) => {
      const user = identities.get(row.userId);
      return {
        id: row.id,
        userId: row.userId,
        organizationId: row.organizationId,
        branchId: row.branchId,
        roleName: row.roleName,
        sections: row.sections as B2bDossierSection[],
        isActive: row.isActive,
        reason: '',
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
        displayName: user?.displayName ?? 'کاربر ثبت‌شده',
        username: user?.username ?? '—',
        accountStatus: user?.status ?? 'INACTIVE',
      };
    });
  }
  async list(org: string, branch: string, actor: AuthenticatedActor) {
    await this.manageScope(org, branch, actor);
    return {
      data: await this.records(await this.repository.list(org, branch)),
    };
  }
  async history(org: string, branch: string, actor: AuthenticatedActor) {
    await this.manageScope(org, branch, actor);
    const ids = (await this.repository.list(org, branch)).map((row) => row.id);
    return { data: await this.repository.history(org, branch, ids) };
  }
  async create(
    org: string,
    input: CreateB2bOrganizationUserDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    await this.manageScope(org, input.branchId, actor, true);
    this.validate(input);
    const errors = passwordPolicyErrors(input.password);
    if (errors.length) throw new BadRequestException(errors.join(' '));
    // IAM alone hashes/stores credentials. No staff role or global branch is granted.
    const user = await this.iam.createUser(
      {
        username: input.username,
        displayName: input.displayName,
        password: input.password,
        roleIds: [],
        branchIds: [],
      },
      actor,
      metadata,
    );
    try {
      const row = await this.repository.save(
        org,
        {
          branchId: input.branchId,
          roleName: input.roleName,
          sections: input.sections,
          isActive: input.isActive,
          reason: input.reason,
        },
        actor.userId,
        undefined,
        user.id,
      );
      return { data: { id: row.id, version: row.version } };
    } catch (error) {
      await this.iam.updateUserStatus(user.id, 'INACTIVE', actor, metadata);
      throw error;
    }
  }
  async update(
    org: string,
    id: string,
    input: SaveB2bOrganizationUserDto,
    actor: AuthenticatedActor,
  ) {
    await this.manageScope(org, input.branchId, actor, true);
    this.validate(input);
    if (!input.version) throw new BadRequestException('نسخه کاربر لازم است.');
    const row = await this.repository.save(org, input, actor.userId, id);
    return { data: { id: row.id, version: row.version } };
  }
  async member(actor: AuthenticatedActor) {
    const row = await this.repository.byUser(actor.userId);
    if (!row?.isActive)
      throw new ForbiddenException('دسترسی پرونده شما غیرفعال است.');
    const org = await this.organization(row.organizationId);
    return { row, org };
  }
  async identity(actor: AuthenticatedActor) {
    const { row, org } = await this.member(actor);
    const [record] = await this.records([row]);
    return {
      data: {
        displayName: record!.displayName,
        organizationName: org.displayName || org.legalName,
        roleName: row.roleName,
        sections: row.sections,
      },
    };
  }
  async section(
    section: string,
    actor: AuthenticatedActor,
  ): Promise<{ data: B2bPortalSection }> {
    const { row, org } = await this.member(actor);
    const definition = B2B_DOSSIER_SECTIONS.find((s) => s.id === section);
    if (!definition || !row.sections.includes(section))
      throw new ForbiddenException('اجازه مشاهده این بخش را ندارید.');
    const result: B2bPortalSection = { title: definition.label, rows: [] };
    if (section === 'organization') {
      const addresses = await this.organizations.addresses(row.organizationId);
      result.rows = [
        {
          label: org.displayName || org.legalName,
          values: values({
            'کد سازمان': org.code,
            'نوع شخصیت': org.personType === 'LEGAL' ? 'حقوقی' : 'حقیقی',
          }),
        },
        ...addresses
          .filter((a) => a.isActive)
          .map((a) => ({
            label: a.label,
            values: values({
              کشور: a.countryName,
              شهر: a.cityName,
              نشانی: a.addressLine,
            }),
          })),
      ];
    } else if (section === 'access') {
      const users = await this.records(
        await this.repository.list(row.organizationId, row.branchId),
      );
      result.rows = users.map((u) => ({
        label: u.displayName,
        values: values({
          نقش: u.roleName,
          وضعیت: u.isActive ? 'فعال' : 'غیرفعال',
          'بخش‌های مجاز': B2B_DOSSIER_SECTIONS.filter((s) =>
            u.sections.includes(s.id),
          )
            .map((s) => s.label)
            .join('، '),
        }),
      }));
    } else if (section === 'contracts' || section === 'credit') {
      const profile = await this.b2b.findProfile(
        row.organizationId,
        row.branchId,
      );
      if (section === 'contracts')
        result.rows = [
          ...(profile?.agreements ?? []).map((a) => ({
            label: a.code,
            values: values({
              وضعیت: a.status,
              شروع: a.startsAt.toISOString().slice(0, 10),
              پایان: a.endsAt?.toISOString().slice(0, 10),
            }),
          })),
          ...(profile?.agreedRates ?? []).map((r) => ({
            label: r.title,
            values: values({
              نوع: r.kind,
              مقدار: r.value.toString(),
              ارز: r.currencyCode,
            }),
          })),
        ];
      else
        result.rows = (profile?.creditPolicies ?? []).map((p) => ({
          label: p.currencyCode,
          values: values({
            'سقف اعتبار': p.creditLimit.toString(),
            وضعیت: p.isActive ? 'فعال' : 'غیرفعال',
          }),
        }));
    } else if (section === 'finance') {
      result.notice =
        'اطلاعات مالی و تسویه پس از اتصال سرویس مالی نمایش داده می‌شود.';
    } else if (section === 'audit') {
      const ids = (
        await this.repository.list(row.organizationId, row.branchId)
      ).map((u) => u.id);
      const events = await this.repository.history(
        row.organizationId,
        row.branchId,
        ids,
      );
      result.notice = 'تاریخچه تغییر دسترسی کاربران همین پرونده';
      result.rows = events.map((e) => ({
        label: e.action.endsWith('create')
          ? 'ثبت کاربر سازمان'
          : 'تغییر دسترسی کاربر',
        values: values({ زمان: e.occurredAt.toISOString() }),
      }));
    }
    return { data: result };
  }
}
