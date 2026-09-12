import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  WorkbenchFeedbackCreateInputV1,
  WorkbenchFeedbackCreateResponseV1,
  WorkbenchFeedbackDepartment,
  WorkbenchFeedbackDetailResponseV1,
} from '@rubi/contracts';

import { DocumentsService } from '../documents/documents.service';
import { HrDirectoryService } from '../hr/hr-directory.service';
import { WorkbenchFeedbackRepository } from './workbench-feedback.repository';

const departmentConfiguration: Record<
  WorkbenchFeedbackDepartment,
  { database: string; label: string; terms: readonly string[] }
> = {
  finance: {
    database: 'FINANCE',
    label: 'مالی',
    terms: ['مالی', 'حسابداری', 'خزانه'],
  },
  reservations: {
    database: 'RESERVATIONS',
    label: 'رزرواسیون',
    terms: ['رزرواسیون', 'رزرو', 'عملیات سفر'],
  },
  sales: { database: 'SALES', label: 'فروش', terms: ['فروش'] },
  visa: { database: 'VISA', label: 'ویزا', terms: ['ویزا'] },
  hr: {
    database: 'HUMAN_RESOURCES',
    label: 'منابع انسانی',
    terms: ['منابع انسانی', 'سرمایه انسانی', 'اداری'],
  },
  management: {
    database: 'MANAGEMENT',
    label: 'مدیریت',
    terms: ['مدیریت', 'مدیر'],
  },
};

const departmentFromDatabase = Object.fromEntries(
  Object.entries(departmentConfiguration).map(([code, value]) => [
    value.database,
    code,
  ]),
) as Record<string, WorkbenchFeedbackDepartment>;

function requestHash(input: WorkbenchFeedbackCreateInputV1): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        branchId: input.branchId,
        department: input.department,
        subject: input.subject.trim(),
        body: input.body.trim(),
        anonymous: input.anonymous,
        attachmentDocumentIds: [...input.attachmentDocumentIds].sort(),
      }),
    )
    .digest('hex');
}

@Injectable()
export class WorkbenchFeedbackService {
  constructor(
    @Inject(WorkbenchFeedbackRepository)
    private readonly repository: WorkbenchFeedbackRepository,
    @Inject(HrDirectoryService)
    private readonly hrDirectory: HrDirectoryService,
    @Inject(DocumentsService)
    private readonly documents: DocumentsService,
  ) {}

  async create(
    input: WorkbenchFeedbackCreateInputV1,
    actor: AuthenticatedActor,
  ): Promise<WorkbenchFeedbackCreateResponseV1> {
    if (!actor.branchIds.includes(input.branchId)) {
      throw new ForbiddenException('شعبه مقصد در محدوده دسترسی شما نیست.');
    }
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (!subject || !body) {
      throw new BadRequestException('موضوع و متن نظرسنجی الزامی است.');
    }
    const configuration = departmentConfiguration[input.department];
    if (!configuration) {
      throw new BadRequestException('واحد مقصد معتبر نیست.');
    }
    await this.documents.assertWorkbenchFeedbackAttachments(
      input.attachmentDocumentIds,
      input.id,
      input.branchId,
      actor,
    );
    const recipientUserIds =
      await this.hrDirectory.workbenchFeedbackRecipientUserIds(
        input.branchId,
        configuration.terms,
      );
    const data = await this.repository.create({
      id: input.id,
      trackingNumber: `WB-${input.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`,
      requestHash: requestHash({ ...input, subject, body }),
      branchId: input.branchId,
      department: configuration.database,
      departmentCode: input.department,
      departmentLabel: configuration.label,
      subject,
      body,
      anonymous: input.anonymous,
      attachmentCount: input.attachmentDocumentIds.length,
      submittedByUserId: actor.userId,
      recipientUserIds,
    });
    return { data };
  }

  async detail(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<WorkbenchFeedbackDetailResponseV1> {
    const row = await this.repository.findById(id);
    if (!row || !actor.branchIds.includes(row.branchId)) {
      throw new NotFoundException('نظرسنجی پیدا نشد.');
    }
    const department = departmentFromDatabase[row.department];
    if (!department) throw new NotFoundException('نظرسنجی پیدا نشد.');
    const isOwn = row.submittedByUserId === actor.userId;
    if (!isOwn) {
      const recipients =
        await this.hrDirectory.workbenchFeedbackRecipientUserIds(
          row.branchId,
          departmentConfiguration[department].terms,
        );
      if (!recipients.includes(actor.userId)) {
        throw new NotFoundException('نظرسنجی پیدا نشد.');
      }
    }
    return {
      data: {
        id: row.id,
        trackingNumber: row.trackingNumber,
        branchId: row.branchId,
        department,
        subject: row.subject,
        body: row.body,
        anonymous: row.isAnonymous,
        attachmentCount: row.attachmentCount,
        submittedAt: row.submittedAt.toISOString(),
        sender:
          row.isAnonymous && !isOwn
            ? null
            : {
                id: row.submittedBy.id,
                displayName: row.submittedBy.displayName,
              },
        isOwn,
      },
    };
  }
}
