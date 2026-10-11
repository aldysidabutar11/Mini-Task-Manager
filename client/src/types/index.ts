/**
 * Mirrors server/src/domain/types.ts. The server is the single source of truth for
 * every business rule; these types only describe the shapes exchanged over HTTP.
 */
export const TASK_STATUSES = ['to_do', 'pending', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ACTORS = ['Aldy Samuel', 'Budi Santoso', 'Johan Sutheja'] as const;
export type Actor = (typeof ACTORS)[number];

/**
 * One lifecycle event: creation (fromStatus = null, toStatus = 'to_do'), a status change,
 * or deletion (fromStatus = status at deletion, toStatus = null).
 */
export interface AuditLog {
  id: number;
  taskId: number;
  taskTitle: string;
  actor: Actor;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  timestamp: string;
}

export type StatusChangeEntry = AuditLog & { fromStatus: TaskStatus; toStatus: TaskStatus };

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: Actor | null;
  lastChange: StatusChangeEntry | null;
}

export interface TaskDetailsPayload {
  title: string;
  description: string | null;
}

export interface CreateTaskPayload extends TaskDetailsPayload {
  actor: Actor;
}

export interface ChangeStatusPayload {
  status: TaskStatus;
  actor: Actor;
}

export interface DeleteTaskPayload {
  actor: Actor;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ViewMode = 'board' | 'activity';

/** Identifies whose history to show; works for archived tasks that are no longer listed. */
export interface HistoryTarget {
  taskId: number;
  title: string;
}

export interface TaskActionHandlers {
  onAdvance: (task: Task) => void;
  onShowHistory: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}
