import { ValidationError } from './errors.js';
import { ACTORS, INITIAL_TASK_STATUS, TASK_STATUSES, type Actor, type SortOrder, type TaskStatus } from './types.js';

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const AUDIT_FEED_DEFAULT_LIMIT = 100;
export const AUDIT_FEED_MAX_LIMIT = 500;

export interface CreateTaskInput {
  title: string;
  description: string | null;
  actor: Actor;
}

export interface UpdateTaskDetailsInput {
  title?: string;
  description?: string | null;
}

export interface ChangeStatusInput {
  status: TaskStatus;
  actor: Actor;
}

export interface DeleteTaskInput {
  actor: Actor;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isActor(value: unknown): value is Actor {
  return typeof value === 'string' && (ACTORS as readonly string[]).includes(value);
}

function quoteList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

function throwIfAny(issues: string[]): void {
  if (issues.length > 0) {
    throw new ValidationError(issues.join('; '), { issues });
  }
}

/** Returns the trimmed title, or pushes an issue and returns undefined. */
function readTitle(value: unknown, issues: string[]): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push('title is required and must be a non-empty string');
    return undefined;
  }
  const title = value.trim();
  if (title.length > TITLE_MAX_LENGTH) {
    issues.push(`title must be at most ${TITLE_MAX_LENGTH} characters`);
    return undefined;
  }
  return title;
}

/** Empty / whitespace-only descriptions are normalised to null. */
function readDescription(value: unknown, issues: string[]): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    issues.push('description must be a string');
    return null;
  }
  const description = value.trim();
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    issues.push(`description must be at most ${DESCRIPTION_MAX_LENGTH} characters`);
  }
  return description.length > 0 ? description : null;
}

export function parseCreateTaskInput(body: unknown): CreateTaskInput {
  const data = requireObject(body);
  const issues: string[] = [];

  const title = readTitle(data.title, issues);
  const description = readDescription(data.description, issues);
  if (!isActor(data.actor)) {
    issues.push(`actor must be one of ${quoteList(ACTORS)}`);
  }
  if ('status' in data) {
    issues.push(`status cannot be set on creation; new tasks always start as '${INITIAL_TASK_STATUS}'`);
  }

  throwIfAny(issues);
  return { title: title as string, description, actor: data.actor as Actor };
}

export function parseUpdateTaskDetailsInput(body: unknown): UpdateTaskDetailsInput {
  const data = requireObject(body);
  const issues: string[] = [];
  const input: UpdateTaskDetailsInput = {};

  if ('status' in data) {
    issues.push('status cannot be changed here; use PUT /api/tasks/:id/status');
  }
  if (!('title' in data) && !('description' in data)) {
    issues.push('at least one of title or description must be provided');
  }
  if ('title' in data) {
    const title = readTitle(data.title, issues);
    if (title !== undefined) input.title = title;
  }
  if ('description' in data) {
    input.description = readDescription(data.description, issues);
  }

  throwIfAny(issues);
  return input;
}

export function parseChangeStatusInput(body: unknown): ChangeStatusInput {
  const data = requireObject(body);
  const issues: string[] = [];

  if (!isTaskStatus(data.status)) {
    issues.push(`status must be one of ${quoteList(TASK_STATUSES)}`);
  }
  if (!isActor(data.actor)) {
    issues.push(`actor must be one of ${quoteList(ACTORS)}`);
  }

  throwIfAny(issues);
  return { status: data.status as TaskStatus, actor: data.actor as Actor };
}

export function parseDeleteTaskInput(body: unknown): DeleteTaskInput {
  const data = requireObject(body);
  if (!isActor(data.actor)) {
    throw new ValidationError(`actor must be one of ${quoteList(ACTORS)}`);
  }
  return { actor: data.actor };
}

export function parseTaskId(raw: unknown): number {
  const id = typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) {
    throw new ValidationError('Task id must be a positive integer', { id: raw });
  }
  return id;
}

export function parseSortOrder(raw: unknown): SortOrder {
  if (raw === undefined) return 'desc';
  if (raw === 'asc' || raw === 'desc') return raw;
  throw new ValidationError("order must be either 'asc' or 'desc'");
}

export function parseFeedLimit(raw: unknown): number {
  if (raw === undefined) return AUDIT_FEED_DEFAULT_LIMIT;
  const limit = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > AUDIT_FEED_MAX_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${AUDIT_FEED_MAX_LIMIT}`);
  }
  return limit;
}
