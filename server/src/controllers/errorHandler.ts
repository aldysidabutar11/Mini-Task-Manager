import type { ErrorRequestHandler, Request, Response } from 'express';
import {
  ConcurrentModificationError,
  DomainError,
  InvalidTransitionError,
  TaskNotFoundError,
  ValidationError,
} from '../domain/errors.js';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

function httpStatusFor(error: DomainError): number {
  if (error instanceof ValidationError || error instanceof InvalidTransitionError) return 400;
  if (error instanceof TaskNotFoundError) return 404;
  if (error instanceof ConcurrentModificationError) return 409;
  return 500;
}

/** Errors raised by body-parser (malformed JSON, payload too large, ...). */
function isClientHttpError(err: unknown): err is { status: number; type?: string; message: string } {
  if (typeof err !== 'object' || err === null) return false;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

function send(res: Response, status: number, body: ErrorBody): void {
  res.status(status).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  send(res, 404, {
    error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} does not exist` },
  });
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof DomainError) {
    send(res, httpStatusFor(err), {
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  if (isClientHttpError(err)) {
    const malformedJson = err.type === 'entity.parse.failed';
    send(res, err.status, {
      error: {
        code: malformedJson ? 'INVALID_JSON' : 'BAD_REQUEST',
        message: malformedJson ? 'Request body is not valid JSON' : err.message,
      },
    });
    return;
  }

  console.error('[unhandled error]', err);
  send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
};
