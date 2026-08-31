import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CustomerListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search = '';
  @IsOptional() @IsIn(['all', 'active', 'inactive']) status:
    'all' | 'active' | 'inactive' = 'all';
  @IsOptional() @IsIn(['all', 'customer', 'passenger']) role:
    'all' | 'customer' | 'passenger' = 'all';
  @IsOptional() @IsIn(['displayName', 'updatedAt', 'createdAt']) sortBy:
    'displayName' | 'updatedAt' | 'createdAt' = 'updatedAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize = 25;
}

export class CustomerMutationDto {
  @IsIn(['person', 'organization']) kind!: 'person' | 'organization';
  @IsOptional() @IsUUID() organizationId?: string | null;
  @ValidateIf((value: CustomerMutationDto) => value.kind === 'person')
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName?: string | null;
  @ValidateIf((value: CustomerMutationDto) => value.kind === 'person')
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName?: string | null;
  @IsString() @MinLength(2) @MaxLength(200) displayName!: string;
  @IsOptional() @IsDateString() birthDate?: string | null;
  @IsArray() @IsIn(['customer', 'passenger'], { each: true }) roles!: (
    'customer' | 'passenger'
  )[];
  @IsOptional() @IsUUID() acquaintanceMethodId?: string | null;
  @IsOptional() @IsInt() @Min(1) version?: number;
}

export class CustomerStatusDto {
  @IsIn(['active', 'inactive']) status!: 'active' | 'inactive';
  @IsInt() @Min(1) version!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class CustomerContactDto {
  @IsIn(['phone', 'email']) type!: 'phone' | 'email';
  @IsOptional() @IsString() @MaxLength(80) label?: string | null;
  @IsString() @MinLength(3) @MaxLength(320) value!: string;
  @IsOptional() @IsBoolean() isPrimary = false;
  @IsInt() @Min(1) version!: number;
}

export class CustomerAddressDto {
  @IsIn(['home', 'work', 'billing', 'other']) type!:
    'home' | 'work' | 'billing' | 'other';
  @IsString() @MinLength(2) @MaxLength(240) label!: string;
  @IsOptional() @IsUUID() cityId?: string | null;
  @IsOptional() @IsBoolean() isPrimary = false;
  @IsInt() @Min(1) version!: number;
}

export class CustomerCompanionDto {
  @IsUUID() relatedCustomerId!: string;
  @IsIn(['family', 'companion', 'guardian', 'dependent'])
  relationshipType!: 'family' | 'companion' | 'guardian' | 'dependent';
  @IsInt() @Min(1) version!: number;
}

export class CustomerConsentDto {
  @IsIn(['marketing']) purpose!: 'marketing';
  @IsIn(['sms', 'email', 'phone', 'all']) channel!:
    'sms' | 'email' | 'phone' | 'all';
  @IsIn(['granted', 'revoked']) status!: 'granted' | 'revoked';
  @IsString() @MinLength(2) @MaxLength(120) source!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsInt() @Min(1) version!: number;
}

export class DuplicateCandidateDto {
  @IsUUID() sourceCustomerId!: string;
}

export class DuplicateReviewDto {
  @IsIn(['confirmed-distinct', 'merge-proposed'])
  status!: 'confirmed-distinct' | 'merge-proposed';
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}
