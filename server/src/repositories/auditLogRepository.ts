import type { Statement } from 'better-sqlite3';
import type { Actor, AuditLog, NewAuditLog, TaskStatus } from '../domain/types.js';
import type { Db } from './database.js';

interface AuditLogRow {
  id: number;
  task_id: number;
  task_title: string;
  actor: Actor;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  timestamp: string;
}

const AUDIT_COLUMNS = 'id, task_id, task_title, actor, from_status, to_status, timestamp';

function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    actor: row.actor,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    timestamp: row.timestamp,
  };
}

/**
 * Append-only access to the audit trail. By design this class exposes no update or
 * delete operations; the database triggers enforce the same rule underneath it.
 *
 * Ordering uses the monotonically increasing `id` (insertion order) rather than the
 * timestamp, so entries written within the same millisecond keep a stable order.
 */
export class AuditLogRepository {
  private readonly insertStmt: Statement<[number, string, Actor, TaskStatus | null, TaskStatus | null, string], AuditLogRow>;
  private readonly byTaskStmt: Statement<[number], AuditLogRow>;
  private readonly feedStmt: Statement<[number], AuditLogRow>;

  constructor(db: Db) {
    this.insertStmt = db.prepare(
      `INSERT INTO audit_logs (task_id, task_title, actor, from_status, to_status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING ${AUDIT_COLUMNS}`,
    );
    this.byTaskStmt = db.prepare(`SELECT ${AUDIT_COLUMNS} FROM audit_logs WHERE task_id = ? ORDER BY id ASC`);
    this.feedStmt = db.prepare(`SELECT ${AUDIT_COLUMNS} FROM audit_logs ORDER BY id DESC LIMIT ?`);
  }

  append(entry: NewAuditLog): AuditLog {
    const row = this.insertStmt.get(
      entry.taskId,
      entry.taskTitle,
      entry.actor,
      entry.fromStatus,
      entry.toStatus,
      entry.timestamp,
    );
    if (!row) {
      throw new Error('Audit log insert did not return a row');
    }
    return toAuditLog(row);
  }

  /** Chronological (oldest first) history of one task. */
  findByTaskId(taskId: number): AuditLog[] {
    return this.byTaskStmt.all(taskId).map(toAuditLog);
  }

  /** Global feed, newest first. */
  findLatest(limit: number): AuditLog[] {
    return this.feedStmt.all(limit).map(toAuditLog);
  }
}
