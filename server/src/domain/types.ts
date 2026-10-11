/**
 * Core domain types. The order of TASK_STATUSES *is* the workflow:
 * a task may only ever move one step to the right.
 */
export const TASK_STATUSES = ['to_do', 'pending', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const INITIAL_TASK_STATUS: TaskStatus = 'to_do';

/** Predefined actors. There is no authentication; the actor is chosen in the UI. */
export const ACTORS = ['Aldy Samuel', 'Budi Santoso', 'Johan Sutheja'] as const;
export type Actor = (typeof ACTORS)[number];

export type SortOrder = 'asc' | 'desc';

/**
 * An immutable audit entry for one lifecycle event:
 * - creation:      fromStatus = null,           toStatus = 'to_do'
 * - status change: fromStatus = previous status, toStatus = new status
 * - deletion:      fromStatus = status at delete, toStatus = null
 */
export interface AuditLog {
  id: number;
  taskId: number;
  /** Snapshot of the task title at the moment of the entry. */
  taskTitle: string;
  actor: Actor;
  /** null only for the creation entry. */
  fromStatus: TaskStatus | null;
  /** null only for the deletion entry. */
  toStatus: TaskStatus | null;
  /** ISO 8601 timestamp (UTC). */
  timestamp: string;
}

export type NewAuditLog = Omit<AuditLog, 'id'>;

export type StatusChangeEntry = AuditLog & { fromStatus: TaskStatus; toStatus: TaskStatus };

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  /** Actor of the task's first audit entry (its creation). */
  createdBy: Actor | null;
  /** Most recent status-change entry; null while only the creation entry exists. */
  lastChange: StatusChangeEntry | null;
}
