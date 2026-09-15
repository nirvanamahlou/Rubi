import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReportSortDto {
  @ApiProperty() @IsString() @MaxLength(64) column!: string;
  @ApiProperty({ enum: ['ASC', 'DESC'] }) @IsIn(['ASC', 'DESC']) direction!: 'ASC' | 'DESC';
}

export class ReportQueryDto {
  @ApiProperty({ type: Object }) @IsObject() filters!: Record<string, string | string[]>;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsInt() @Min(1) @Max(100) pageSize!: number;
  @ApiPropertyOptional({ type: ReportSortDto }) @IsOptional() @ValidateNested() @Type(() => ReportSortDto) sort?: ReportSortDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) legalEntityId?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) branchIds?: string[];
  @ApiProperty({ enum: ['Asia/Tehran'] }) @IsIn(['Asia/Tehran']) timezone!: 'Asia/Tehran';
}

export class SaveReportDto {
  @ApiProperty() @IsString() @MaxLength(100) reportCode!: string;
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ enum: ['PERSONAL', 'TEAM'] }) @IsEnum({ PERSONAL: 'PERSONAL', TEAM: 'TEAM' }) sharingScope!: 'PERSONAL' | 'TEAM';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFavorite?: boolean;
  @ApiProperty({ type: Object }) @IsObject() filterState!: Record<string, unknown>;
}

export class ShareSavedReportDto {
  @ApiProperty({ type: [String], description: 'شناسه کاربران دریافت‌کننده گزارش' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  recipientUserIds!: string[];
}

export class ExportCreateDto {
  @ApiProperty({ enum: ['CSV', 'XLSX', 'PDF'] }) @IsIn(['CSV', 'XLSX', 'PDF']) format!: 'CSV' | 'XLSX' | 'PDF';
  @ApiProperty({ type: ReportQueryDto }) @ValidateNested() @Type(() => ReportQueryDto) query!: ReportQueryDto;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() simulateFailure?: boolean;
}
