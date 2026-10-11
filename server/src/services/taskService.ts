import {
  ConcurrentModificationError,
  InvalidTransitionError,
  TaskNotFoundError,
} from '../domain/errors.js';
import { decideTransition, getNextStatus } from '../domain/taskStateMachine.js';
import { INITIAL_TASK_STATUS, type SortOrder, type Task } from '../domain/types.js';
import type {
  ChangeStatusInput,
  CreateTaskInput,
  DeleteTaskInput,
  UpdateTaskDetailsInput,
} from '../domain/validation.js';
import type { AuditLogRepository } from '../repositories/auditLogRepository.js';
import type { Db } from '../repositories/database.js';
import type { TaskRepository } from '../repositories/taskRepository.js';

export type Clock = () => Date;

export interface StatusChangeResult {
  task: Task;
  /** false when the request was an idempotent no-op (same status, no audit log). */
  changed: boolean;
}

export class TaskService {
  private readonly createTaskTx;
  private readonly changeStatusTx;
  private readonly updateDetailsTx;
  private readonly deleteTaskTx;

  constructor(
    db: Db,
    private readonly tasks: TaskRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly clock: Clock = () => new Date(),
  ) {
    // Each write and its audit entry run as ONE transaction: committed together or not at all.
    this.createTaskTx = db.transaction((input: CreateTaskInput) => this.applyCreate(input));
    this.changeStatusTx = db.transaction((id: number, input: ChangeStatusInput) => this.applyStatusChange(id, input));
    this.updateDetailsTx = db.transaction((id: number, input: UpdateTaskDetailsInput) => this.applyDetailsUpdate(id, input));
    this.deleteTaskTx = db.transaction((id: number, input: DeleteTaskInput) => this.applyDelete(id, input));
  }

  listTasks(order: SortOrder): Task[] {
    return this.tasks.findAllActive(order);
  }

  createTask(input: CreateTaskInput): Task {
    return this.createTaskTx.immediate(input);
  }

  updateTaskDetails(id: number, input: UpdateTaskDetailsInput): Task {
    return this.updateDetailsTx.immediate(id, input);
  }

  /**
   * BEGIN IMMEDIATE takes SQLite's write lock before the task is read, so no other
   * writer (even another process) can change the task between validation and update.
   */
  changeStatus(id: number, input: ChangeStatusInput): StatusChangeResult {
    return this.changeStatusTx.immediate(id, input);
  }

  /**
   * Archives the task and records who deleted it, in one IMMEDIATE transaction. Earlier
   * entries are untouched and remain queryable. Unknown or already-deleted tasks: 404, nothing written.
   */
  deleteTask(id: number, input: DeleteTaskInput): void {
    this.deleteTaskTx.immediate(id, input);
  }

  private applyCreate({ title, description, actor }: CreateTaskInput): Task {
    const now = this.now();
    const id = this.tasks.create(title, description, INITIAL_TASK_STATUS, now);

    this.auditLogs.append({
      taskId: id,
      taskTitle: title,
      actor,
      fromStatus: null,
      toStatus: INITIAL_TASK_STATUS,
      timestamp: now,
    });

    return this.requireActiveTask(id);
  }

  private applyStatusChange(id: number, { status, actor }: ChangeStatusInput): StatusChangeResult {
    const task = this.requireActiveTask(id);

    const decision = decideTransition(task.status, status);
    if (decision.type === 'unchanged') {
      return { task, changed: false };
    }
    if (decision.type === 'rejected') {
      throw new InvalidTransitionError(decision.reason, {
        taskId: id,
        currentStatus: task.status,
        requestedStatus: status,
        allowedNextStatus: getNextStatus(task.status),
      });
    }

    const now = this.now();
    if (!this.tasks.compareAndSetStatus(id, task.status, status, now)) {
      // Unreachable while the IMMEDIATE lock is held; kept as a defensive guard.
      throw new ConcurrentModificationError(`Task ${id} was modified concurrently; please reload and try again`, {
        taskId: id,
      });
    }

    this.auditLogs.append({
      taskId: id,
      taskTitle: task.title,
      actor,
      fromStatus: task.status,
      toStatus: status,
      timestamp: now,
    });

    return { task: this.requireActiveTask(id), changed: true };
  }

  private applyDelete(id: number, { actor }: DeleteTaskInput): void {
    const task = this.requireActiveTask(id);
    const now = this.now();
    if (!this.tasks.archive(id, now)) {
      // Unreachable while the IMMEDIATE lock is held; kept as a defensive guard.
      throw new ConcurrentModificationError(`Task ${id} was modified concurrently; please reload and try again`, {
        taskId: id,
      });
    }

    this.auditLogs.append({
      taskId: id,
      taskTitle: task.title,
      actor,
      fromStatus: task.status,
      toStatus: null,
      timestamp: now,
    });
  }

  private applyDetailsUpdate(id: number, input: UpdateTaskDetailsInput): Task {
    const task = this.requireActiveTask(id);

    const title = input.title ?? task.title;
    const description = input.description !== undefined ? input.description : task.description;
    this.tasks.updateDetails(id, title, description, this.now());

    // Audit logs keep their own title snapshot, so renaming never rewrites history.
    return this.requireActiveTask(id);
  }

  private requireActiveTask(id: number): Task {
    const task = this.tasks.findActiveById(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }
    return task;
  }

  private now(): string {
    return this.clock().toISOString();
  }
}
