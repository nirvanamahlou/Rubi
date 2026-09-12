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
import { WORKBENCH_FEEDBACK_DEPARTMENTS } from '@rubi/contracts';

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
