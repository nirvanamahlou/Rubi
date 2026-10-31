import {
  IsIn,
  IsInt,
  IsISO8601,
  Matches,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CallCenterQueueDto {
  @IsOptional()
  @IsIn([
    'ALL',
    'OPEN',
    'CLOSED',
    'MINE',
    'TODAY',
    'OVERDUE',
    'UNASSIGNED',
    'NO_ACTION',
  ])
  view = 'ALL';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
export class CallCenterLinkDto {
  @IsUUID('4') commandId!: string;
  @IsUUID() ticketId!: string;
  @IsOptional() @IsUUID() expectedTicketId?: string | null;
}

export class CallCenterRequestDto {
  @IsUUID('4') commandId!: string;
  @IsUUID('4') id!: string;
  @IsInt() @Min(0) expectedVersion!: number;
  @IsString() @Length(1, 160) title!: string;
  // NEW is a legacy input alias; the service persists IN_PROGRESS instead.
  @IsIn(['NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'CLOSED']) status =
    'IN_PROGRESS';
  @IsOptional() @IsUUID() ownerId?: string | null;
  @IsIn(['NORMAL', 'HIGH', 'URGENT']) priority!: string;
  @IsString()
  @Length(1, 500)
  @Matches(/\S/u, { message: 'دلیل تغییر، بستن یا بازگشایی را وارد کنید.' })
  reason!: string;
  @IsOptional() @IsString() @Length(0, 1000) result?: string;
}
export class CallCenterFollowUpDto {
  @IsUUID('4') commandId!: string;
  @IsUUID('4') id!: string;
  @IsInt() @Min(0) expectedVersion!: number;
  @IsUUID() ownerId!: string;
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  dueAt!: string;
  @IsString() @Length(1, 500) action!: string;
  @IsIn(['NORMAL', 'HIGH', 'URGENT']) priority!: string;
  @IsIn(['OPEN', 'COMPLETED', 'CANCELLED']) status!: string;
  @IsString() @Length(0, 1000) result!: string;
}
export class CallCenterRequestPageDto {
  @IsOptional() @IsIn(['true']) openOnly?: string;
  @IsOptional() @IsUUID('4') requestId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) taskPage = 1;
}
export class CallCenterReferralDto {
  @IsUUID('4') commandId!: string;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsUUID() ownerId!: string;
  @IsIn(['SALES', 'SUPPORT']) destination!: 'SALES' | 'SUPPORT';
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  dueAt!: string;
}
