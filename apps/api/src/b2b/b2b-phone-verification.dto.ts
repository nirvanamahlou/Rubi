import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optionalTrim = ({ value }: { value: unknown }) => {
  const transformed = trim({ value });
  return transformed === '' ? undefined : transformed;
};

class B2bPhoneVerificationBindingDto {
  @IsUUID()
  registrationId!: string;

  @IsUUID()
  branchId!: string;

  @IsIn(['AGENCY', 'CORPORATE_CUSTOMER'])
  role!: 'AGENCY' | 'CORPORATE_CUSTOMER';

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(32)
  phone!: string;
}

export class B2bPhoneVerificationContextDto extends B2bPhoneVerificationBindingDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string | null;
}

export class CreateB2bPhoneChallengeDto extends B2bPhoneVerificationContextDto {}

export class VerifyB2bPhoneChallengeDto extends B2bPhoneVerificationContextDto {
  @Transform(trim)
  @Matches(/^\d{6}$/)
  code!: string;
}

export class CreateVerifiedB2bContactDto extends B2bPhoneVerificationBindingDto {
  @IsUUID()
  organizationId!: string;

  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  grant!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsEmail()
  @MaxLength(200)
  email?: string;
}
