import { describe, expect, it, vi } from 'vitest';
import { AuditLogRepository } from '../src/repositories/auditLogRepository.js';
import { openDatabase } from '../src/repositories/database.js';
import { TaskRepository } from '../src/repositories/taskRepository.js';
import { TaskService } from '../src/services/taskService.js';

function setup() {
  const db = openDatabase(':memory:');
  const tasks = new TaskRepository(db);
  const auditLogs = new AuditLogRepository(db);
  return { tasks, auditLogs, service: new TaskService(db, tasks, auditLogs) };
}

describe('deleteTask transaction', () => {
  it('rolls back the archive when writing the deletion entry fails', () => {
    const { tasks, auditLogs, service } = setup();
    const task = service.createTask({ title: 'Keep me', description: null, actor: 'Aldy Samuel' });

    const archive = vi.spyOn(tasks, 'archive');
    vi.spyOn(auditLogs, 'append').mockImplementation(() => {
      throw new Error('simulated audit insert failure');
    });

    expect(() => service.deleteTask(task.id, { actor: 'Budi Santoso' })).toThrow('simulated audit insert failure');

    // The archive UPDATE did run inside the transaction...
    expect(archive).toHaveReturnedWith(true);
    // ...and was rolled back together with the failed insert.
    expect(tasks.findActiveById(task.id)).toMatchObject({ id: task.id, status: 'to_do' });
    expect(auditLogs.findByTaskId(task.id).map((l) => [l.fromStatus, l.toStatus])).toEqual([[null, 'to_do']]);
  });
});
