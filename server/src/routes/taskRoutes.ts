import { Router } from 'express';
import type { AuditLogController } from '../controllers/auditLogController.js';
import type { TaskController } from '../controllers/taskController.js';

export function createTaskRouter(tasks: TaskController, auditLogs: AuditLogController): Router {
  const router = Router();

  router.get('/', tasks.list);
  router.post('/', tasks.create);
  router.patch('/:id', tasks.updateDetails);
  router.delete('/:id', tasks.remove);
  router.put('/:id/status', tasks.changeStatus);
  router.get('/:id/audit-logs', auditLogs.listForTask);

  return router;
}
