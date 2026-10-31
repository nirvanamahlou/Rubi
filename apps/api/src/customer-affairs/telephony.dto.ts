import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class TelephonyLeaseDto {
  @IsUUID() tabId!: string;
  @IsOptional() @IsBoolean() release?: boolean;
}
export class TelephonyActionDto extends TelephonyLeaseDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(['CLAIM', 'DEFER', 'SAVE', 'TRANSFER']) action!:
    'CLAIM' | 'DEFER' | 'SAVE' | 'TRANSFER';
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsString() @Length(1, 100) source?: string;
  @IsOptional() @IsString() @Length(1, 200) operator?: string;
  @IsOptional()
  @IsIn(['ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED'])
  outcome?: string;
  @IsOptional() @IsUUID('4') ticketId?: string;
  @IsOptional() @IsUUID() targetUserId?: string;
}
export class TelephonySyntheticDto {
  @IsUUID() branchId!: string;
  @IsIn(['RINGING', 'ANSWERED', 'ENDED', 'RECORDING_READY', 'TRANSFERRED'])
  kind!: 'RINGING' | 'ANSWERED' | 'ENDED' | 'RECORDING_READY' | 'TRANSFERRED';
  @IsOptional() @IsUUID() rootId?: string;
  @IsUUID() externalEventId!: string;
  @IsOptional() @IsBoolean() anonymous?: boolean;
}
export class TelephonyConnectionDto {
  @IsOptional() @IsUUID() id?: string;
  @IsUUID() branchId!: string;
  @IsString() @Length(1, 100) name!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsInt() @Min(60) @Max(604800) maxAgeSeconds!: number;
  @IsInt() @Min(0) @Max(600) maxFutureSeconds!: number;
}
export class TelephonyMappingDto {
  @IsUUID() connectionId!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,32}$/) extension!: string;
  @IsUUID() userId!: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsBoolean() active!: boolean;
  @IsInt() @Min(0) version!: number;
}

export class TelephonyReviewDto {
  @IsUUID() userId!: string;
  @IsInt() @Min(1) version!: number;
}
