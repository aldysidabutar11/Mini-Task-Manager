import { Router } from 'express';
import type { AuditLogController } from '../controllers/auditLogController.js';

export function createAuditLogRouter(auditLogs: AuditLogController): Router {
  const router = Router();

  router
    .route('/')
    .get(auditLogs.listAll)
    .post(auditLogs.rejectMutation)
    .put(auditLogs.rejectMutation)
    .patch(auditLogs.rejectMutation)
    .delete(auditLogs.rejectMutation);

  router
    .route('/:id')
    .post(auditLogs.rejectMutation)
    .put(auditLogs.rejectMutation)
    .patch(auditLogs.rejectMutation)
    .delete(auditLogs.rejectMutation);

  return router;
}
