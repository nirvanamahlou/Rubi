import type { AuthenticatedActor } from '@rubi/contracts';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  actor: AuthenticatedActor;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}
