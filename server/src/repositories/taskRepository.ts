import type { Statement } from 'better-sqlite3';
import type { Actor, SortOrder, Task, TaskStatus } from '../domain/types.js';
import type { Db } from './database.js';

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  created_by: Actor | null;
  change_id: number | null;
  change_task_title: string | null;
  change_actor: Actor | null;
  change_from: TaskStatus | null;
  change_to: TaskStatus | null;
  change_timestamp: string | null;
}

/**
 * Tasks joined with the two audit entries the board needs, in ONE statement (no N+1):
 * - creation:    the task's first audit entry (lowest id)  -> createdBy
 * - last_change: its latest status change (both statuses set) -> lastChange
 * Both lookups are index seeks on audit_logs (task_id, id).
 */
const TASK_SELECT = `
SELECT t.id, t.title, t.description, t.status, t.created_at, t.updated_at,
       creation.actor          AS created_by,
       last_change.id          AS change_id,
       last_change.task_title  AS change_task_title,
       last_change.actor       AS change_actor,
       last_change.from_status AS change_from,
       last_change.to_status   AS change_to,
       last_change.timestamp   AS change_timestamp
FROM tasks AS t
LEFT JOIN audit_logs AS creation
       ON creation.id = (SELECT MIN(a.id) FROM audit_logs AS a WHERE a.task_id = t.id)
LEFT JOIN audit_logs AS last_change
       ON last_change.id = (SELECT MAX(a.id) FROM audit_logs AS a WHERE a.task_id = t.id AND a.from_status IS NOT NULL AND a.to_status IS NOT NULL)
WHERE t.deleted_at IS NULL`;

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastChange:
      row.change_id === null
        ? null
        : {
            id: row.change_id,
            taskId: row.id,
            taskTitle: row.change_task_title as string,
            actor: row.change_actor as Actor,
            fromStatus: row.change_from as TaskStatus,
            toStatus: row.change_to as TaskStatus,
            timestamp: row.change_timestamp as string,
          },
  };
}

/**
 * Data access for tasks. "Active" tasks are those that have not been archived
 * (deleted_at IS NULL); archived rows are kept so their audit history stays resolvable.
 */
export class TaskRepository {
  private readonly listAscStmt: Statement<[], TaskRow>;
  private readonly listDescStmt: Statement<[], TaskRow>;
  private readonly findActiveStmt: Statement<[number], TaskRow>;
  private readonly existsStmt: Statement<[number], { found: 1 }>;
  private readonly insertStmt: Statement<[string, string | null, TaskStatus, string, string], { id: number }>;
  private readonly updateDetailsStmt: Statement<[string, string | null, string, number]>;
  private readonly compareAndSetStatusStmt: Statement<[TaskStatus, string, number, TaskStatus]>;
  private readonly archiveStmt: Statement<[string, number]>;

  constructor(db: Db) {
    const active = 'deleted_at IS NULL';
    this.listAscStmt = db.prepare(`${TASK_SELECT} ORDER BY t.created_at ASC, t.id ASC`);
    this.listDescStmt = db.prepare(`${TASK_SELECT} ORDER BY t.created_at DESC, t.id DESC`);
    this.findActiveStmt = db.prepare(`${TASK_SELECT} AND t.id = ?`);
    this.existsStmt = db.prepare('SELECT 1 AS found FROM tasks WHERE id = ?');
    this.insertStmt = db.prepare(
      `INSERT INTO tasks (title, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`,
    );
    this.updateDetailsStmt = db.prepare(
      `UPDATE tasks SET title = ?, description = ?, updated_at = ? WHERE id = ? AND ${active}`,
    );
    // Compare-and-set: only succeeds if the status is still what the caller validated against.
    this.compareAndSetStatusStmt = db.prepare(
      `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND status = ? AND ${active}`,
    );
    this.archiveStmt = db.prepare(`UPDATE tasks SET deleted_at = ? WHERE id = ? AND ${active}`);
  }

  findAllActive(order: SortOrder): Task[] {
    const stmt = order === 'asc' ? this.listAscStmt : this.listDescStmt;
    return stmt.all().map(toTask);
  }

  findActiveById(id: number): Task | undefined {
    const row = this.findActiveStmt.get(id);
    return row ? toTask(row) : undefined;
  }

  /** True if the task ever existed, including archived tasks. */
  exists(id: number): boolean {
    return this.existsStmt.get(id) !== undefined;
  }

  /** Inserts the task row and returns its id. */
  create(title: string, description: string | null, status: TaskStatus, now: string): number {
    const row = this.insertStmt.get(title, description, status, now, now);
    if (!row) {
      throw new Error('Task insert did not return a row');
    }
    return row.id;
  }

  updateDetails(id: number, title: string, description: string | null, now: string): boolean {
    return this.updateDetailsStmt.run(title, description, now, id).changes === 1;
  }

  /** Returns false if the task is gone or its status is no longer `expected`. */
  compareAndSetStatus(id: number, expected: TaskStatus, next: TaskStatus, now: string): boolean {
    return this.compareAndSetStatusStmt.run(next, now, id, expected).changes === 1;
  }

  archive(id: number, now: string): boolean {
    return this.archiveStmt.run(now, id).changes === 1;
  }
}
