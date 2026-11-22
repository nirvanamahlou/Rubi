import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
// Runtime constructor is needed by nested validation.
import { CustomerMutationDto } from '../customers/customer.dto';

export class PassengerPreflightDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CustomerMutationDto)
  passengers!: CustomerMutationDto[];
}
