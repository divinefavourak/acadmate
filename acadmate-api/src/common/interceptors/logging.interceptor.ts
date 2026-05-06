import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId: string = (req as any)['requestId'] ?? 'unknown';
    const userId: string | undefined = (req as any).user?.id;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        this.logger.log(
          JSON.stringify({
            requestId,
            method: req.method,
            path: req.url,
            statusCode: res.statusCode,
            responseTimeMs: Date.now() - startTime,
            ...(userId && { userId }),
          }),
        );
      }),
    );
  }
}
