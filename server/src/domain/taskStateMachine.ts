import { TASK_STATUSES, type TaskStatus } from './types.js';

/**
 * Outcome of evaluating a requested status change:
 * - `unchanged`: target equals current status (idempotent no-op, no audit log)
 * - `advance`:   target is exactly the next step in the workflow
 * - `rejected`:  backward move, skipped step, or move out of a terminal status
 */
export type TransitionDecision =
  | { type: 'unchanged' }
  | { type: 'advance' }
  | { type: 'rejected'; reason: string };

function positionOf(status: TaskStatus): number {
  return TASK_STATUSES.indexOf(status);
}

/** The only status a task may move to next, or `null` if it is terminal. */
export function getNextStatus(status: TaskStatus): TaskStatus | null {
  return TASK_STATUSES[positionOf(status) + 1] ?? null;
}

export function decideTransition(from: TaskStatus, to: TaskStatus): TransitionDecision {
  if (from === to) {
    return { type: 'unchanged' };
  }

  const next = getNextStatus(from);
  if (next === to) {
    return { type: 'advance' };
  }

  if (next === null) {
    return {
      type: 'rejected',
      reason: `Task is already '${from}', which is a final status; it cannot be moved to '${to}'.`,
    };
  }

  const direction = positionOf(to) < positionOf(from) ? 'backward transitions are not allowed' : 'workflow steps cannot be skipped';

  return {
    type: 'rejected',
    reason: `Invalid status transition from '${from}' to '${to}': ${direction}. The only allowed next status is '${next}'.`,
  };
}
