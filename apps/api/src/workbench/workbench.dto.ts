import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import type {
  WorkbenchCalendarPriorityV1,
  WorkbenchCalendarStatusV1,
  WorkbenchNoteItemV1,
} from '@nora/contracts';

export class WorkbenchNoteDto {
  @IsString() @Length(1, 200) title!: string;
  @IsString() @Length(0, 10000) body!: string;
  @IsString() @Length(1, 60) folder!: string;
  @IsString() @Length(0, 500) tags!: string;
  @IsArray() items!: WorkbenchNoteItemV1[];
  @IsBoolean() pinned!: boolean;
  @IsOptional() @IsISO8601() reminderAt?: string | null;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class WorkbenchFolderDto {
  @IsString() @Length(1, 60) name!: string;
}

export class WorkbenchCalendarDto {
  @IsOptional() @IsUUID() id?: string;
  @IsUUID() branchId!: string;
  @IsString() @Length(1, 120) title!: string;
  @IsString() @Length(0, 2000) description!: string;
  @IsISO8601() dueAt!: string;
  @IsOptional()
  @IsIn(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
  status?: WorkbenchCalendarStatusV1;
  @IsOptional()
  @IsIn(['NORMAL', 'HIGH', 'URGENT'])
  priority?: WorkbenchCalendarPriorityV1;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  linkUrl?: string | null;
  @IsOptional() @IsUUID() imageDocumentId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) expectedVersion?: number;
}

export class WorkbenchProfileDto {
  @IsString() @Length(2, 160) displayName!: string;
  @IsOptional() @IsString() @Length(0, 320) email?: string | null;
  @IsOptional() @IsString() @Length(0, 32) phone?: string | null;
  @IsOptional() @IsUUID() photoDocumentId?: string | null;
  @IsOptional() @IsUUID() photoBranchId?: string | null;
}

export class WorkbenchProfilePhotoDto {
  @IsUUID() branchId!: string;
  @IsString() @Length(1, 240) title!: string;
}
