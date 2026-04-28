import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that sanitizes error responses in production.
 * Never leaks stack traces, file paths, or internal module names.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        // Use the message from known exception types, but sanitize in production
        if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else if (
          Array.isArray(responseObj.message) &&
          responseObj.message.length > 0
        ) {
          message = responseObj.message[0] as string;
        }
      }

      // Map status to error code
      errorCode = this.getErrorCode(status);
    }

    // Log full details internally (never exposed to client)
    const logMessage = exception instanceof Error
      ? `${exception.message} | Stack: ${exception.stack}`
      : String(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} | ${logMessage}`,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${status} | ${logMessage}`,
      );
    }

    // Sanitize message in production for 500 errors
    if (isProduction && status >= 500) {
      message = 'Internal server error';
    }

    response.status(status).json({
      statusCode: status,
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }
}
