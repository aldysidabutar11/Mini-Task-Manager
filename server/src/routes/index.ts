import { Router } from 'express';
import type { AuditLogController } from '../controllers/auditLogController.js';
import type { TaskController } from '../controllers/taskController.js';
import { createAuditLogRouter } from './auditLogRoutes.js';
import { createTaskRouter } from './taskRoutes.js';

export function createApiRouter(tasks: TaskController, auditLogs: AuditLogController): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  router.use('/tasks', createTaskRouter(tasks, auditLogs));
  router.use('/audit-logs', createAuditLogRouter(auditLogs));

  return router;
}
