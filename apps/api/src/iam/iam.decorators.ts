import { SetMetadata } from '@nestjs/common';
import type { IamPermissionCode } from '@rubi/contracts';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './iam.constants';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: IamPermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
