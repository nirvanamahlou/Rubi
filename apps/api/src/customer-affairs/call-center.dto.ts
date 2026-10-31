import { Type } from 'class-transformer';
import {
  IsIn,
  IsDefined,
  IsInt,
  IsISO8601,
  Matches,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export const CALL_CENTER_STATUSES = [
  'جدید',
  'پیگیری اول',
  'پیگیری دوم',
  'پیگیری سوم',
  'منتظر تماس مجدد',
  'بدون پاسخ',
  'نهایی شده',
] as const;
export class CallCenterCallDto {
  @IsOptional() @IsString() @Matches(/^[a-f0-9]{64}$/) completionToken?: string;
  @IsOptional() @IsUUID() ticketId?: string;
  @IsDefined({ message: 'نتیجه تماس را انتخاب کنید.' })
  @IsIn(['ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED'])
  outcome?: string;
  @IsUUID('4') id!: string;
  @IsString() @Length(0, 24) phone!: string;
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  occurredAt!: string;
  @IsIn(['INBOUND', 'OUTBOUND']) direction!: 'INBOUND' | 'OUTBOUND';
  @IsString() @Length(0, 100) name!: string;
  @IsString() @Length(1, 200) subject!: string;
  @IsString() @Length(1, 80) source!: string;
  @IsString() @Length(1, 800) operator!: string;
  @IsIn(CALL_CENTER_STATUSES) status!: (typeof CALL_CENTER_STATUSES)[number];
  @IsString() @Length(0, 2000) note!: string;
}
export class CallCenterNoteDto {
  @IsUUID('4') id!: string;
  @IsString() @Length(1, 2000) text!: string;
}
export class CallCenterListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize: number =
    50;
}
