import type { Request, Response } from 'express';
import { parseFeedLimit, parseTaskId } from '../domain/validation.js';
import type { AuditLogService } from '../services/auditLogService.js';

export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  listForTask = (req: Request, res: Response): void => {
    res.json(this.service.getTaskHistory(parseTaskId(req.params.id)));
  };

  listAll = (req: Request, res: Response): void => {
    res.json(this.service.getGlobalFeed(parseFeedLimit(req.query.limit)));
  };

  /** Audit logs have no write endpoints; any attempt is answered explicitly. */
  rejectMutation = (_req: Request, res: Response): void => {
    res
      .status(405)
      .set('Allow', 'GET')
      .json({
        error: {
          code: 'AUDIT_LOG_IMMUTABLE',
          message:
            'Audit logs are append-only. Entries are created only by task creation, status changes, and task deletion, and cannot be created, edited, or deleted directly.',
        },
      });
  };
}
