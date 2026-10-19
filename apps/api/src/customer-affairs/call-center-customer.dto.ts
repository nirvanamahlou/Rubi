import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
export class CallCenterCustomerLinkDto {
  @IsUUID('4') commandId!: string;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsUUID() customerId?: string | null;
}
