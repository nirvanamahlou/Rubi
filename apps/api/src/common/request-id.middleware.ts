import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incomingValue = request.header(REQUEST_ID_HEADER)?.trim();
  const requestId =
    incomingValue && incomingValue.length <= 128 ? incomingValue : randomUUID();

  request.headers[REQUEST_ID_HEADER] = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}

export function getRequestId(request: Request): string {
  const value = request.headers[REQUEST_ID_HEADER];
  return typeof value === 'string' ? value : 'unknown';
}
