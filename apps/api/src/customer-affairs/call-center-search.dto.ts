import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
export class CallCenterSearchDto {
  @IsOptional() @IsString() @Length(0, 120) query?: string;
  @IsOptional() @IsIn(['LATEST', 'ANY']) scope: 'LATEST' | 'ANY' = 'LATEST';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
  @IsOptional() @IsString() @Length(1, 64) revision?: string;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsIn(['INBOUND', 'OUTBOUND']) direction?: string;
  @IsOptional()
  @IsIn(['ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'UNKNOWN'])
  outcome?: string;
  @IsOptional() @IsIn(['MANUAL', 'TELEPHONY', 'UNKNOWN']) origin?: string;
  @IsOptional() @IsString() @Length(1, 80) source?: string;
  @IsOptional() @IsString() @Length(1, 100) unit?: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'CLOSED'])
  requestStatus?: string;
  @IsOptional()
  @IsIn(['OPEN', 'COMPLETED', 'CANCELLED', 'TODAY', 'OVERDUE'])
  followUp?: string;
  @IsOptional() @IsIn(['YES', 'NO']) incomplete?: string;
}
export class CallCenterHistoryDto {
  @IsOptional() @IsUUID() after?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}
