import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
export class RoleTemplateDto extends PickType(CreateUserDto, [
  'accessTitle',
  'permissionIds',
  'screenIds',
  'deniedControlIds',
] as const) {}
