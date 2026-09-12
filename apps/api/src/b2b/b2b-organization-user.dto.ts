import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  B2B_DOSSIER_SECTIONS,
  type B2bDossierSection,
  type B2bOrganizationUserInput,
} from '@rubi/contracts';
export class SaveB2bOrganizationUserDto implements B2bOrganizationUserInput {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(2) @MaxLength(120) roleName!: string;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(6)
  @IsIn(B2B_DOSSIER_SECTIONS.map((s) => s.id), { each: true })
  sections!: B2bDossierSection[];
  @IsBoolean() isActive!: boolean;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class CreateB2bOrganizationUserDto extends SaveB2bOrganizationUserDto {
  @IsString() @MinLength(2) @MaxLength(160) displayName!: string;
  @IsString() @Matches(/^[a-zA-Z0-9._-]{3,80}$/) username!: string;
  @IsString() @MinLength(10) @MaxLength(200) password!: string;
}
