import { describe, expect, it } from 'vitest';
import { decideTransition, getNextStatus } from '../src/domain/taskStateMachine.js';
import { TASK_STATUSES, type TaskStatus } from '../src/domain/types.js';

describe('task state machine', () => {
  it('defines the forward-only workflow to_do -> pending -> in_progress -> done', () => {
    expect(getNextStatus('to_do')).toBe('pending');
    expect(getNextStatus('pending')).toBe('in_progress');
    expect(getNextStatus('in_progress')).toBe('done');
    expect(getNextStatus('done')).toBeNull();
  });

  it.each<[TaskStatus, TaskStatus]>([
    ['to_do', 'pending'],
    ['pending', 'in_progress'],
    ['in_progress', 'done'],
  ])('allows %s -> %s', (from, to) => {
    expect(decideTransition(from, to)).toEqual({ type: 'advance' });
  });

  it.each(TASK_STATUSES)('treats a same-status request (%s) as unchanged (idempotent)', (status) => {
    expect(decideTransition(status, status)).toEqual({ type: 'unchanged' });
  });

  it.each<[TaskStatus, TaskStatus]>([
    ['to_do', 'in_progress'],
    ['to_do', 'done'],
    ['pending', 'done'],
  ])('rejects skipping steps: %s -> %s', (from, to) => {
    const decision = decideTransition(from, to);
    expect(decision.type).toBe('rejected');
    expect(decision.type === 'rejected' && decision.reason).toMatch(/cannot be skipped/);
  });

  it.each<[TaskStatus, TaskStatus]>([
    ['pending', 'to_do'],
    ['in_progress', 'pending'],
    ['in_progress', 'to_do'],
  ])('rejects moving backward: %s -> %s', (from, to) => {
    const decision = decideTransition(from, to);
    expect(decision.type).toBe('rejected');
    expect(decision.type === 'rejected' && decision.reason).toMatch(/backward/);
  });

  it.each<TaskStatus>(['to_do', 'pending', 'in_progress'])('rejects leaving the final status: done -> %s', (to) => {
    const decision = decideTransition('done', to);
    expect(decision.type).toBe('rejected');
    expect(decision.type === 'rejected' && decision.reason).toMatch(/final status/);
  });
});
