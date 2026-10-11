import { TaskNotFoundError } from '../domain/errors.js';
import type { AuditLog } from '../domain/types.js';
import type { AuditLogRepository } from '../repositories/auditLogRepository.js';
import type { TaskRepository } from '../repositories/taskRepository.js';

/** Read-only access to the audit trail. Writing happens only inside TaskService.changeStatus. */
export class AuditLogService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  /** History is available for archived (deleted) tasks too; 404 only if the id never existed. */
  getTaskHistory(taskId: number): AuditLog[] {
    if (!this.tasks.exists(taskId)) {
      throw new TaskNotFoundError(taskId);
    }
    return this.auditLogs.findByTaskId(taskId);
  }

  getGlobalFeed(limit: number): AuditLog[] {
    return this.auditLogs.findLatest(limit);
  }
}
