import { IsString, Length, Matches } from 'class-validator';

export class MfaSetupBeginDto {
  @IsString()
  @Length(1, 200)
  currentPassword!: string;
}

export class MfaCodeDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/u, { message: 'کد باید دقیقاً ۶ رقم باشد.' })
  code!: string;
}
