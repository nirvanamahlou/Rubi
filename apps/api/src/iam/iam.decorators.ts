import { SetMetadata } from '@nestjs/common';
import type { IamPermissionCode } from '@nora/contracts';

import {
  ACCESS_CONTROLS_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from './iam.constants';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: IamPermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireAccessControls = (...controlIds: string[]) =>
  SetMetadata(ACCESS_CONTROLS_KEY, controlIds);
