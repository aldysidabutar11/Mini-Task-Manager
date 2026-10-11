import { TASK_STATUSES, type TaskStatus } from '../types';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

export const STATUS_STYLES: Record<TaskStatus, { badge: string; dot: string; column: string }> = {
  to_do: { badge: 'bg-slate-100 text-slate-700 ring-slate-300', dot: 'bg-slate-400', column: 'border-t-slate-400' },
  pending: { badge: 'bg-amber-50 text-amber-800 ring-amber-300', dot: 'bg-amber-400', column: 'border-t-amber-400' },
  in_progress: { badge: 'bg-sky-50 text-sky-800 ring-sky-300', dot: 'bg-sky-500', column: 'border-t-sky-500' },
  done: { badge: 'bg-emerald-50 text-emerald-800 ring-emerald-300', dot: 'bg-emerald-500', column: 'border-t-emerald-500' },
};

/**
 * Used only to label the "Advance to ..." button. Whether a move is actually allowed
 * is decided by the server, which rejects anything invalid with HTTP 400.
 */
export function getNextStatus(status: TaskStatus): TaskStatus | null {
  return TASK_STATUSES[TASK_STATUSES.indexOf(status) + 1] ?? null;
}
