import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { WORKBENCH_FEEDBACK_DEPARTMENTS } from '@nora/contracts';

const multipartBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false' || value === '' || value === undefined) return false;
  return value;
};

export class CreateWorkbenchFeedbackDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  branchId!: string;

  @IsIn(WORKBENCH_FEEDBACK_DEPARTMENTS)
  department!: (typeof WORKBENCH_FEEDBACK_DEPARTMENTS)[number];

  @IsString()
  @Length(1, 200)
  subject!: string;

  @IsString()
  @Length(1, 10000)
  body!: string;

  @IsBoolean()
  anonymous!: boolean;

  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attachmentDocumentIds!: string[];
}

export class UploadWorkbenchFeedbackAttachmentDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @Length(1, 200)
  subject!: string;

  @Transform(multipartBoolean)
  @IsBoolean()
  anonymous!: boolean;
}
