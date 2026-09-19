import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  WorkbenchCalendarEventInputV1,
  WorkbenchCalendarEventV1,
  WorkbenchNoteInputV1,
  WorkbenchNoteItemV1,
  WorkbenchNoteV1,
  IamPersonalProfileUpdateInputV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';
import { CustomerAffairsService } from '../customer-affairs/customer-affairs.service';
import { DocumentsService } from '../documents/documents.service';
import { IamService } from '../iam/iam.service';

const DEFAULT_FOLDERS = ['شخصی', 'جلسات', 'ایده‌ها'] as const;

function noteItems(value: unknown): WorkbenchNoteItemV1[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new BadRequestException('چک‌لیست یادداشت معتبر نیست.');
  return value.map((candidate) => {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      typeof (candidate as { text?: unknown }).text !== 'string' ||
      !(candidate as { text: string }).text.trim() ||
      (candidate as { text: string }).text.trim().length > 300 ||
      typeof (candidate as { done?: unknown }).done !== 'boolean'
    )
      throw new BadRequestException('یکی از ردیف‌های چک‌لیست معتبر نیست.');
    return {
      text: (candidate as { text: string }).text.trim(),
      done: (candidate as { done: boolean }).done,
    };
  });
}

function mapNote(row: {
  id: string;
  title: string;
  body: string;
  folder: string;
  tags: string;
  items: unknown;
  pinned: boolean;
  reminderAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): WorkbenchNoteV1 {
  return {
    ...row,
    items: noteItems(row.items),
    reminderAt: row.reminderAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEvent(row: {
  id: string;
  branchId: string;
  title: string;
  description: string;
  dueAt: Date;
  status: string;
  priority: string;
  linkUrl: string | null;
  imageDocumentId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): WorkbenchCalendarEventV1 {
  return {
    ...row,
    status: row.status as WorkbenchCalendarEventV1['status'],
    priority: row.priority as WorkbenchCalendarEventV1['priority'],
    dueAt: row.dueAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class WorkbenchService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(CustomerAffairsService)
    private readonly customerAffairs: CustomerAffairsService,
  ) {}

  async notes(actor: AuthenticatedActor) {
    const [rows, storedFolders] = await Promise.all([
      this.database.client.workbenchNote.findMany({
        where: { userId: actor.userId },
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        take: 500,
      }),
      this.database.client.workbenchNoteFolder.findMany({
        where: { userId: actor.userId },
        orderBy: { createdAt: 'asc' },
        select: { name: true },
      }),
    ]);
    return {
      data: rows.map(mapNote),
      folders: [
        ...new Set([
          ...DEFAULT_FOLDERS,
          ...storedFolders.map(({ name }) => name),
        ]),
      ],
    };
  }

  async profile(actor: AuthenticatedActor) {
    const identity = await this.iam.personalProfile(actor.userId);
    return {
      data: {
        displayName: identity.displayName,
        email: identity.email,
        phone: identity.profile?.phone ?? null,
        photoDocumentId: identity.profile?.photoDocumentId ?? null,
        updatedAt: identity.profile?.updatedAt.toISOString() ?? null,
      },
    };
  }

  async updateProfile(
    input: IamPersonalProfileUpdateInputV1,
    actor: AuthenticatedActor,
  ) {
    if (input.photoDocumentId) {
      if (!input.photoBranchId)
        throw new BadRequestException('شعبه عکس پروفایل الزامی است.');
      await this.documents.assertWorkbenchOwnedAttachments(
        [input.photoDocumentId],
        'IamProfile',
        actor.userId,
        input.photoBranchId,
        actor,
      );
    }
    const identity = await this.iam.updateOwnProfile(actor, input);
    return {
      data: {
        displayName: identity.displayName,
        email: identity.email,
        phone: identity.profile.phone,
        photoDocumentId: identity.profile.photoDocumentId,
        updatedAt: identity.profile.updatedAt.toISOString(),
      },
    };
  }

  async createFolder(nameValue: string, actor: AuthenticatedActor) {
    const name = nameValue.trim();
    const row = await this.database.client.workbenchNoteFolder.upsert({
      where: { userId_name: { userId: actor.userId, name } },
      create: { userId: actor.userId, name },
      update: {},
      select: { name: true },
    });
    await this.iam.recordSelfActivity(
      actor,
      'workbench.folder.create',
      'workbench-note-folder',
      name,
    );
    return { data: row };
  }

  async createNote(input: WorkbenchNoteInputV1, actor: AuthenticatedActor) {
    const data = this.noteData(input);
    const row = await this.database.client.$transaction(async (tx) => {
      await tx.workbenchNoteFolder.upsert({
        where: { userId_name: { userId: actor.userId, name: data.folder } },
        create: { userId: actor.userId, name: data.folder },
        update: {},
      });
      return tx.workbenchNote.create({
        data: { ...data, userId: actor.userId },
      });
    });
    await this.iam.recordSelfActivity(
      actor,
      'workbench.note.create',
      'workbench-note',
      row.id,
    );
    return { data: mapNote(row) };
  }

  async updateNote(
    id: string,
    input: WorkbenchNoteInputV1,
    actor: AuthenticatedActor,
  ) {
    const expectedVersion = input.expectedVersion;
    if (!expectedVersion)
      throw new BadRequestException('نسخه یادداشت الزامی است.');
    const data = this.noteData(input);
    const row = await this.database.client.$transaction(async (tx) => {
      await tx.workbenchNoteFolder.upsert({
        where: { userId_name: { userId: actor.userId, name: data.folder } },
        create: { userId: actor.userId, name: data.folder },
        update: {},
      });
      const changed = await tx.workbenchNote.updateMany({
        where: { id, userId: actor.userId, version: expectedVersion },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException('یادداشت تغییر کرده یا پیدا نشد.');
      return tx.workbenchNote.findUniqueOrThrow({ where: { id } });
    });
    await this.iam.recordSelfActivity(
      actor,
      'workbench.note.update',
      'workbench-note',
      id,
    );
    return { data: mapNote(row) };
  }

  async deleteNote(id: string, actor: AuthenticatedActor) {
    const result = await this.database.client.workbenchNote.deleteMany({
      where: { id, userId: actor.userId },
    });
    if (!result.count) throw new NotFoundException('یادداشت پیدا نشد.');
    await this.iam.recordSelfActivity(
      actor,
      'workbench.note.delete',
      'workbench-note',
      id,
    );
  }

  async calendar(actor: AuthenticatedActor) {
    const [rows, customerAffairs] = await Promise.all([
      this.database.client.workbenchCalendarEvent.findMany({
        where: { userId: actor.userId, branchId: { in: actor.branchIds } },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: 1000,
      }),
      actor.permissions.includes('customer_affairs.ticket.read')
        ? this.customerAffairs.workbench(actor)
        : Promise.resolve({ data: [] }),
    ]);
    return {
      data: rows.map(mapEvent),
      sources: { customerAffairs: customerAffairs.data },
    };
  }

  async createEvent(
    input: WorkbenchCalendarEventInputV1,
    actor: AuthenticatedActor,
  ) {
    this.assertBranch(input.branchId, actor);
    const id = input.id ?? randomUUID();
    if (input.imageDocumentId)
      await this.documents.assertWorkbenchOwnedAttachments(
        [input.imageDocumentId],
        'WorkbenchCalendarEvent',
        id,
        input.branchId,
        actor,
      );
    const row = await this.database.client.workbenchCalendarEvent.create({
      data: { ...this.eventData(input), id, userId: actor.userId },
    });
    await this.iam.recordSelfActivity(
      actor,
      'workbench.calendar.create',
      'workbench-calendar-event',
      row.id,
    );
    return { data: mapEvent(row) };
  }

  async updateEvent(
    id: string,
    input: WorkbenchCalendarEventInputV1,
    actor: AuthenticatedActor,
  ) {
    this.assertBranch(input.branchId, actor);
    if (!input.expectedVersion)
      throw new BadRequestException('نسخه رویداد الزامی است.');
    if (input.imageDocumentId)
      await this.documents.assertWorkbenchOwnedAttachments(
        [input.imageDocumentId],
        'WorkbenchCalendarEvent',
        id,
        input.branchId,
        actor,
      );
    const changed =
      await this.database.client.workbenchCalendarEvent.updateMany({
        where: { id, userId: actor.userId, version: input.expectedVersion },
        data: { ...this.eventData(input), version: { increment: 1 } },
      });
    if (!changed.count)
      throw new ConflictException('رویداد تغییر کرده یا پیدا نشد.');
    const row =
      await this.database.client.workbenchCalendarEvent.findUniqueOrThrow({
        where: { id },
      });
    await this.iam.recordSelfActivity(
      actor,
      'workbench.calendar.update',
      'workbench-calendar-event',
      id,
    );
    return { data: mapEvent(row) };
  }

  async deleteEvent(id: string, actor: AuthenticatedActor) {
    const result = await this.database.client.workbenchCalendarEvent.deleteMany(
      { where: { id, userId: actor.userId } },
    );
    if (!result.count) throw new NotFoundException('رویداد پیدا نشد.');
    await this.iam.recordSelfActivity(
      actor,
      'workbench.calendar.delete',
      'workbench-calendar-event',
      id,
    );
  }

  private noteData(input: WorkbenchNoteInputV1) {
    const title = input.title.trim();
    const body = input.body.trim();
    const folder = input.folder.trim();
    const tags = input.tags.trim();
    const items = noteItems(input.items);
    if (!title || (!body && !items.length))
      throw new BadRequestException(
        'عنوان و متن یا چک‌لیست یادداشت الزامی است.',
      );
    return {
      title,
      body,
      folder,
      tags,
      items: items as unknown as Prisma.InputJsonValue,
      pinned: input.pinned,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
    };
  }

  private eventData(input: WorkbenchCalendarEventInputV1) {
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime()))
      throw new BadRequestException('تاریخ رویداد معتبر نیست.');
    return {
      branchId: input.branchId,
      title: input.title.trim(),
      description: input.description.trim(),
      dueAt,
      status: input.status ?? 'PLANNED',
      priority: input.priority ?? 'NORMAL',
      linkUrl: input.linkUrl?.trim() || null,
      imageDocumentId: input.imageDocumentId ?? null,
    };
  }

  private assertBranch(branchId: string, actor: AuthenticatedActor) {
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه رویداد در محدوده دسترسی شما نیست.');
  }
}
