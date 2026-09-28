import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import {
  MARKETING_CONTENT_ASSET_KINDS,
  type MarketingContentAssetKind,
} from '@nora/contracts';

export class MarketingContentAssetUploadDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @Length(2, 240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(MARKETING_CONTENT_ASSET_KINDS)
  kind!: MarketingContentAssetKind;
}
