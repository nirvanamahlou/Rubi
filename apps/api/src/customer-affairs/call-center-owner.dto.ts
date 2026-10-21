import { IsInt, IsUUID, Min } from 'class-validator';
export class CallCenterOwnerDto {
  @IsUUID() ownerUserId!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}
