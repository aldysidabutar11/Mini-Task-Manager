/**
 * Domain errors are transport-agnostic: they carry a stable machine-readable
 * `code`, and the HTTP layer decides which status code each one maps to.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/** The request payload or parameters are malformed. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}

/** The requested status change breaks the forward-only workflow. */
export class InvalidTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';
}

export class TaskNotFoundError extends DomainError {
  readonly code = 'TASK_NOT_FOUND';

  constructor(taskId: number) {
    super(`Task with id ${taskId} was not found`, { taskId });
  }
}

/** The task changed between being read and being written (lost compare-and-set). */
export class ConcurrentModificationError extends DomainError {
  readonly code = 'CONCURRENT_MODIFICATION';
}
