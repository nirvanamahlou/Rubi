import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

import { getRequestId } from './request-id.middleware';

interface NormalizedError {
  code: string;
  details: unknown[];
  message: string;
  retryable: boolean;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = getRequestId(request);
    const normalized = this.normalizeException(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed with ${normalized.code}; requestId=${requestId}`,
      );
    }

    httpAdapter.reply(
      context.getResponse(),
      {
        error: normalized,
        meta: { requestId },
      },
      status,
    );
  }

  private normalizeException(
    exception: unknown,
    status: number,
  ): NormalizedError {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        details: [],
        message: 'An unexpected error occurred.',
        retryable: true,
      };
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return {
        code: this.codeForStatus(status),
        details: [],
        message: response,
        retryable: status >= 500,
      };
    }

    const payload = response as { message?: string | unknown[] };
    const responseMessage = payload.message;
    const messages = Array.isArray(responseMessage) ? responseMessage : [];
    return {
      code:
        status === HttpStatus.BAD_REQUEST
          ? 'VALIDATION_ERROR'
          : this.codeForStatus(status),
      details: messages.map((message) => ({ reason: String(message) })),
      message:
        typeof responseMessage === 'string'
          ? responseMessage
          : status === HttpStatus.BAD_REQUEST
            ? 'Request validation failed.'
            : exception.message,
      retryable: status >= 500,
    };
  }

  private codeForStatus(status: number): string {
    return HttpStatus[status] ?? `HTTP_${status}`;
  }
}
