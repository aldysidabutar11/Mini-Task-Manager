import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase, type Db } from '../src/repositories/database.js';
import type { Task } from '../src/domain/types.js';

export interface TestContext {
  db: Db;
  api: ReturnType<typeof request>;
}

/** Fresh in-memory database per test, with a clock that ticks one second per call. */
export function createTestContext(): TestContext {
  const db = openDatabase(':memory:');
  let tick = Date.parse('2026-01-01T00:00:00.000Z');
  const clock = () => new Date((tick += 1000));
  return { db, api: request(createApp({ db, clock })) };
}

export async function createTask(
  ctx: TestContext,
  title = 'Write report',
  description?: string,
  actor = 'Aldy Samuel',
): Promise<Task> {
  const res = await ctx.api.post('/api/tasks').send({ title, description, actor }).expect(201);
  return res.body as Task;
}

export function changeStatus(ctx: TestContext, id: number, status: string, actor = 'Aldy Samuel') {
  return ctx.api.put(`/api/tasks/${id}/status`).send({ status, actor });
}

export function deleteTask(ctx: TestContext, id: number, actor = 'Aldy Samuel') {
  return ctx.api.delete(`/api/tasks/${id}`).send({ actor });
}
