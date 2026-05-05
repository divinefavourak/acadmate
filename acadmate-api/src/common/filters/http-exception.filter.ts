import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

function isPrismaError(e: unknown): e is { code: string; meta?: Record<string, unknown> } {
  return (e as any)?.constructor?.name === 'PrismaClientKnownRequestError';
}

const PRISMA_STATUS: Record<string, number> = {
  P2002: HttpStatus.CONFLICT,           // unique constraint
  P2025: HttpStatus.NOT_FOUND,          // record not found
  P2003: HttpStatus.BAD_REQUEST,        // foreign key constraint
  P2014: HttpStatus.BAD_REQUEST,        // relation violation
};

const PRISMA_MESSAGE: Record<string, string> = {
  P2002: 'A record with that value already exists',
  P2025: 'Record not found',
  P2003: 'Related record not found',
  P2014: 'Invalid relation data',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId: string = (request as any)['requestId'] ?? randomUUID();
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message = Array.isArray(body['message'])
          ? (body['message'] as string[]).join('; ')
          : String(body['message'] ?? message);
        error = String(body['error'] ?? exception.name);
      }
      error = error === 'HttpException' ? exception.name : error;
    } else if (isPrismaError(exception)) {
      const code = (exception as any).code as string;
      statusCode = PRISMA_STATUS[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      message = PRISMA_MESSAGE[code] ?? 'Database error';
      error = 'Database Error';
      if (statusCode >= 500) {
        this.logger.error(`Prisma ${code}: ${message}`, (exception as any).stack);
      }
    } else {
      const isProduction = process.env.NODE_ENV === 'production';
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      message = isProduction ? 'Internal server error' : String(exception);
      error = 'Internal Server Error';
    }

    if (statusCode >= 500 && exception instanceof HttpException) {
      this.logger.error(`${request.method} ${request.url} → ${statusCode}`, exception.stack);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      requestId,
      timestamp,
    });
  }
}
