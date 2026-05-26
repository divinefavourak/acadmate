import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Honour a client-supplied X-Request-Id (from apiClient) so the same
    // correlation ID appears in both frontend logs and backend logs.
    // If absent, generate a fresh one.
    const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    (req as any)['requestId'] = id;

    // Echo the ID back so the frontend can correlate errors with server logs.
    res.setHeader('X-Request-Id', id);
    next();
  }
}
