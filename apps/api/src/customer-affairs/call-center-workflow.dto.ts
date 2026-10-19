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
  @IsOptional() @IsIn(['ALL', 'MINE', 'TODAY', 'OVERDUE', 'UNASSIGNED']) view =
    'ALL';
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
  @IsIn(['NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'CLOSED']) status!: string;
  @IsOptional() @IsUUID() ownerId?: string | null;
  @IsIn(['NORMAL', 'HIGH', 'URGENT']) priority!: string;
  @IsString() @Length(0, 500) reason!: string;
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
