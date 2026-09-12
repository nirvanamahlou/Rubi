import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  OrganizationActivityPage,
  OrganizationActivityQuery,
} from '@rubi/contracts';
import { activityWindow } from '../common/organization-activity';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import { DocumentsService } from '../documents/documents.service';
import { IamService } from '../iam/iam.service';
import { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import { B2bActivityRepository } from './b2b-activity.repository';

@Injectable()
export class B2bActivityService {
  constructor(
    @Inject(B2bActivityRepository)
    private readonly repository: B2bActivityRepository,
    @Inject(MasterOrganizationDirectory)
    private readonly organizations: MasterOrganizationDirectory,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(B2bOrganizationUserRepository)
    private readonly memberships: B2bOrganizationUserRepository,
  ) {}
  async list(
    org: string,
    branch: string,
    actor: AuthenticatedActor,
    query: OrganizationActivityQuery,
  ): Promise<OrganizationActivityPage> {
    if (
      !actor.permissions.includes('b2b.agency.read') ||
      !actor.branchIds.includes(branch) ||
      (await this.memberships.byUser(actor.userId))
    )
      throw new ForbiddenException('مجوز گزارش این پرونده یا شعبه را ندارید.');
    if (
      !(await this.organizations.agencyReference(org)) &&
      !(await this.organizations.cooperationReference(
        org,
        'CORPORATE_CUSTOMER',
      ))
    )
      throw new NotFoundException('پرونده سازمان پیدا نشد.');
    const window = activityWindow(query);
    const unavailableSources: string[] = [];
    const tasks = [];
    if (!query.source || query.source === 'B2B')
      tasks.push(this.repository.activity(org, branch, actor, window));
    if (actor.permissions.includes('master_data.audit.read')) {
      if (!query.source || query.source === 'MASTER_DATA')
        tasks.push(
          this.organizations.organizationActivity(org, branch, actor, window),
        );
    } else
      unavailableSources.push(
        'تاریخچه مشخصات، شعب و نمایندگان: نیازمند مجوز مشاهده Audit اطلاعات پایه',
      );
    if (actor.permissions.includes('documents.audit.read')) {
      if (!query.source || query.source === 'DOCUMENTS')
        tasks.push(
          this.documents.organizationActivity(org, branch, actor, window),
        );
    } else
      unavailableSources.push('تاریخچه اسناد: نیازمند مجوز مشاهده Audit اسناد');
    for (const [permission, label] of [
      ['b2b.agreement.read', 'قرارداد'],
      ['b2b.credit.read', 'اعتبار'],
      ['b2b.rate.read', 'نرخ‌ها'],
    ] as const)
      if (!actor.permissions.includes(permission))
        unavailableSources.push(`${label}: مجوز مشاهده موجود نیست`);
    const rows = (await Promise.all(tasks))
      .flat()
      .sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) ||
          (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      );
    const data = rows.slice(0, 50);
    if (data.length) {
      const users = new Map(
        (await this.iam.listUsers()).map((user) => [user.id, user.displayName]),
      );
      for (const event of data)
        event.actorName = users.get(event.actorUserId) ?? 'کاربر ثبت‌شده';
    }
    const last = data.at(-1);
    return {
      data,
      asOf: window.asOf.toISOString(),
      unavailableSources,
      nextCursor:
        rows.length > 50 && last
          ? Buffer.from(
              JSON.stringify({ time: last.occurredAt, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }
}
