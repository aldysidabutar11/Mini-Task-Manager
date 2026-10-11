import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditLog, Task } from '../src/domain/types.js';
import { changeStatus, createTask, createTestContext, deleteTask, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(() => {
  ctx = createTestContext();
});

async function auditLogsOf(id: number): Promise<AuditLog[]> {
  const res = await ctx.api.get(`/api/tasks/${id}/audit-logs`).expect(200);
  return res.body as AuditLog[];
}

async function listTasks(): Promise<Task[]> {
  const res = await ctx.api.get('/api/tasks').expect(200);
  return res.body as Task[];
}

describe('POST /api/tasks', () => {
  it('creates a task in to_do with trimmed fields', async () => {
    const res = await ctx.api
      .post('/api/tasks')
      .send({ title: '  Prepare demo  ', description: '  slides  ', actor: 'Budi Santoso' })
      .expect(201);

    expect(res.headers.location).toBe(`/api/tasks/${res.body.id}`);
    expect(res.body).toMatchObject({
      title: 'Prepare demo',
      description: 'slides',
      status: 'to_do',
      createdBy: 'Budi Santoso',
      lastChange: null,
    });
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
  });

  it('writes exactly one creation entry (null -> to_do) in the audit trail', async () => {
    const task = await createTask(ctx, 'Audited creation', undefined, 'Johan Sutheja');

    expect(await auditLogsOf(task.id)).toEqual([
      {
        id: expect.any(Number),
        taskId: task.id,
        taskTitle: 'Audited creation',
        actor: 'Johan Sutheja',
        fromStatus: null,
        toStatus: 'to_do',
        timestamp: task.createdAt,
      },
    ]);
  });

  it.each([{}, { actor: '' }, { actor: 'Mallory' }, { actor: 42 }])('requires a valid actor: %j', async (extra) => {
    const res = await ctx.api.post('/api/tasks').send({ title: 'Needs an actor', ...extra }).expect(400);
    expect(res.body.error.message).toMatch(/actor must be one of/);

    expect(await listTasks()).toEqual([]);
    const feed = await ctx.api.get('/api/audit-logs').expect(200);
    expect(feed.body).toEqual([]);
  });

  it('stores an empty description as null', async () => {
    const task = await createTask(ctx, 'No details', '   ');
    expect(task.description).toBeNull();
  });

  it.each([{}, { title: '' }, { title: '   ' }, { title: 42 }, { title: 'x'.repeat(201) }])(
    'rejects an invalid title: %j',
    async (body) => {
      const res = await ctx.api.post('/api/tasks').send({ ...body, actor: 'Aldy Samuel' }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('does not allow choosing the initial status', async () => {
    const res = await ctx.api.post('/api/tasks').send({ title: 'Sneaky', status: 'done', actor: 'Aldy Samuel' }).expect(400);
    expect(res.body.error.message).toMatch(/status cannot be set on creation/);
  });

  it('answers malformed JSON with 400', async () => {
    const res = await ctx.api.post('/api/tasks').set('Content-Type', 'application/json').send('{"title":').expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/tasks', () => {
  it('lists active tasks sorted by created date (desc by default, asc on request)', async () => {
    const first = await createTask(ctx, 'First');
    const second = await createTask(ctx, 'Second');

    expect((await listTasks()).map((t) => t.id)).toEqual([second.id, first.id]);

    const asc = await ctx.api.get('/api/tasks?order=asc').expect(200);
    expect(asc.body.map((t: Task) => t.id)).toEqual([first.id, second.id]);
  });

  it('rejects an unknown sort order', async () => {
    await ctx.api.get('/api/tasks?order=sideways').expect(400);
  });

  it('returns createdBy and the latest status change per task', async () => {
    const a = await createTask(ctx, 'A', undefined, 'Budi Santoso');
    const b = await createTask(ctx, 'B', undefined, 'Johan Sutheja');
    const c = await createTask(ctx, 'C', undefined, 'Aldy Samuel');
    await changeStatus(ctx, a.id, 'pending', 'Johan Sutheja').expect(200);
    await changeStatus(ctx, b.id, 'pending', 'Aldy Samuel').expect(200);
    await changeStatus(ctx, a.id, 'in_progress', 'Aldy Samuel').expect(200);

    const byId = new Map((await listTasks()).map((t) => [t.id, t]));

    expect(byId.get(a.id)).toMatchObject({
      createdBy: 'Budi Santoso',
      lastChange: { taskId: a.id, actor: 'Aldy Samuel', fromStatus: 'pending', toStatus: 'in_progress' },
    });
    expect(byId.get(b.id)).toMatchObject({
      createdBy: 'Johan Sutheja',
      lastChange: { taskId: b.id, actor: 'Aldy Samuel', fromStatus: 'to_do', toStatus: 'pending' },
    });
    expect(byId.get(c.id)).toMatchObject({ createdBy: 'Aldy Samuel', lastChange: null });

    // lastChange is exactly the newest status-change entry of that task's trail.
    const trail = await auditLogsOf(a.id);
    expect(byId.get(a.id)!.lastChange).toEqual(trail.at(-1));
  });

  it('keeps createdBy and lastChange unchanged by idempotent requests and detail edits', async () => {
    const task = await createTask(ctx, 'Stable', undefined, 'Budi Santoso');
    await changeStatus(ctx, task.id, 'pending', 'Johan Sutheja').expect(200);
    const before = (await listTasks())[0]!;

    await changeStatus(ctx, task.id, 'pending', 'Aldy Samuel').expect(200);
    await ctx.api.patch(`/api/tasks/${task.id}`).send({ title: 'Stable (renamed)' }).expect(200);

    const after = (await listTasks())[0]!;
    expect(after.createdBy).toBe('Budi Santoso');
    expect(after.lastChange).toEqual(before.lastChange);
  });
});

describe('PUT /api/tasks/:id/status', () => {
  it('advances one step, returns the task and appends exactly one audit log', async () => {
    const task = await createTask(ctx, 'Ship feature');

    const res = await changeStatus(ctx, task.id, 'pending', 'Budi Santoso').expect(200);
    expect(res.body).toMatchObject({ id: task.id, status: 'pending' });

    const logs = await auditLogsOf(task.id);
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({
      taskId: task.id,
      taskTitle: 'Ship feature',
      actor: 'Budi Santoso',
      fromStatus: 'to_do',
      toStatus: 'pending',
    });
    expect(logs[1]!.timestamp).toBe(res.body.updatedAt);
    expect(res.body.lastChange).toEqual(logs[1]);
  });

  it('walks the full workflow and records a chronological trail', async () => {
    const task = await createTask(ctx, 'Write report', undefined, 'Johan Sutheja');
    await changeStatus(ctx, task.id, 'pending', 'Aldy Samuel').expect(200);
    await changeStatus(ctx, task.id, 'in_progress', 'Budi Santoso').expect(200);
    await changeStatus(ctx, task.id, 'done', 'Johan Sutheja').expect(200);

    const logs = await auditLogsOf(task.id);
    expect(logs.map((l) => [l.actor, l.fromStatus, l.toStatus])).toEqual([
      ['Johan Sutheja', null, 'to_do'],
      ['Aldy Samuel', 'to_do', 'pending'],
      ['Budi Santoso', 'pending', 'in_progress'],
      ['Johan Sutheja', 'in_progress', 'done'],
    ]);
    const timestamps = logs.map((l) => l.timestamp);
    expect([...timestamps].sort()).toEqual(timestamps);
  });

  it('rejects skipping a step with 400 and writes no log', async () => {
    const task = await createTask(ctx);

    const res = await changeStatus(ctx, task.id, 'done').expect(400);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(res.body.error.message).toMatch(/cannot be skipped/);
    expect(res.body.error.details).toMatchObject({ currentStatus: 'to_do', allowedNextStatus: 'pending' });

    expect(await auditLogsOf(task.id)).toHaveLength(1);
    expect((await listTasks())[0]!.status).toBe('to_do');
  });

  it('rejects moving backward with 400 and writes no log', async () => {
    const task = await createTask(ctx);
    await changeStatus(ctx, task.id, 'pending').expect(200);
    await changeStatus(ctx, task.id, 'in_progress').expect(200);

    const res = await changeStatus(ctx, task.id, 'pending').expect(400);
    expect(res.body.error.message).toMatch(/backward/);
    expect(await auditLogsOf(task.id)).toHaveLength(3);
  });

  it('rejects any change once the task is done', async () => {
    const task = await createTask(ctx);
    for (const status of ['pending', 'in_progress', 'done']) {
      await changeStatus(ctx, task.id, status).expect(200);
    }
    await changeStatus(ctx, task.id, 'to_do').expect(400);
  });

  it('is idempotent: same status returns 200 with the existing task and writes nothing', async () => {
    const task = await createTask(ctx);

    const sameAsInitial = await changeStatus(ctx, task.id, 'to_do').expect(200);
    expect(sameAsInitial.body).toEqual(task);
    expect(await auditLogsOf(task.id)).toHaveLength(1);

    const advanced = await changeStatus(ctx, task.id, 'pending').expect(200);
    const repeated = await changeStatus(ctx, task.id, 'pending', 'Johan Sutheja').expect(200);
    expect(repeated.body).toEqual(advanced.body);
    expect(await auditLogsOf(task.id)).toHaveLength(2);
  });

  it.each([
    [{ status: 'pending' }, /actor must be one of/],
    [{ status: 'pending', actor: 'Mallory' }, /actor must be one of/],
    [{ actor: 'Aldy Samuel' }, /status must be one of/],
    [{ status: 'archived', actor: 'Aldy Samuel' }, /status must be one of/],
  ])('validates the payload %j', async (body, message) => {
    const task = await createTask(ctx);
    const res = await ctx.api.put(`/api/tasks/${task.id}/status`).send(body).expect(400);
    expect(res.body.error.message).toMatch(message);
  });

  it('returns 404 for unknown tasks and 400 for malformed ids', async () => {
    await changeStatus(ctx, 999, 'pending').expect(404);
    await changeStatus(ctx, 'abc' as unknown as number, 'pending').expect(400);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates details without touching the title snapshot stored in past logs', async () => {
    const task = await createTask(ctx, 'Old title');
    await changeStatus(ctx, task.id, 'pending').expect(200);

    const res = await ctx.api.patch(`/api/tasks/${task.id}`).send({ title: 'New title' }).expect(200);
    expect(res.body).toMatchObject({ title: 'New title', status: 'pending' });

    await changeStatus(ctx, task.id, 'in_progress').expect(200);
    const logs = await auditLogsOf(task.id);
    expect(logs.map((l) => l.taskTitle)).toEqual(['Old title', 'Old title', 'New title']);
  });

  it('cannot be used to change the status', async () => {
    const task = await createTask(ctx);
    await ctx.api.patch(`/api/tasks/${task.id}`).send({ status: 'done' }).expect(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  async function feed(): Promise<AuditLog[]> {
    return (await ctx.api.get('/api/audit-logs').expect(200)).body as AuditLog[];
  }

  it.each([
    ['no body', undefined],
    ['empty object', {}],
    ['unknown actor', { actor: 'Mallory' }],
    ['non-string actor', { actor: 42 }],
  ])('requires a valid actor (%s) and writes nothing', async (_label, body) => {
    const task = await createTask(ctx);
    const request = ctx.api.delete(`/api/tasks/${task.id}`);
    const res = await (body === undefined ? request : request.send(body)).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/actor must be one of|Request body must be a JSON object/);

    expect((await listTasks()).map((t) => t.id)).toEqual([task.id]);
    expect(await auditLogsOf(task.id)).toHaveLength(1);
  });

  it('archives the task and writes exactly one deletion entry (status -> null)', async () => {
    const task = await createTask(ctx, 'Temporary', undefined, 'Johan Sutheja');
    await changeStatus(ctx, task.id, 'pending').expect(200);

    await deleteTask(ctx, task.id, 'Budi Santoso').expect(204);

    expect(await listTasks()).toEqual([]);
    const logs = await auditLogsOf(task.id);
    expect(logs.map((l) => [l.actor, l.taskTitle, l.fromStatus, l.toStatus])).toEqual([
      ['Johan Sutheja', 'Temporary', null, 'to_do'],
      ['Aldy Samuel', 'Temporary', 'to_do', 'pending'],
      ['Budi Santoso', 'Temporary', 'pending', null],
    ]);
    expect(logs.filter((l) => l.toStatus === null)).toHaveLength(1);

    // The deleted task's history and the global feed both show the deletion entry.
    expect((await feed())[0]).toEqual(logs[2]);
  });

  it('returns 404 for an already-deleted task and writes no second entry', async () => {
    const task = await createTask(ctx);
    await deleteTask(ctx, task.id).expect(204);
    const before = await feed();

    const res = await deleteTask(ctx, task.id, 'Johan Sutheja').expect(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
    expect(await feed()).toEqual(before);
  });

  it('returns 404 for an unknown task and writes nothing', async () => {
    await createTask(ctx);
    const before = await feed();

    await deleteTask(ctx, 99999).expect(404);
    expect(await feed()).toEqual(before);
  });

  it('makes the archived task unavailable for further changes', async () => {
    const task = await createTask(ctx);
    await deleteTask(ctx, task.id).expect(204);

    await changeStatus(ctx, task.id, 'pending').expect(404);
    await ctx.api.patch(`/api/tasks/${task.id}`).send({ title: 'Revived' }).expect(404);
  });

  it('never reuses the id of a deleted task', async () => {
    const deleted = await createTask(ctx, 'A');
    await deleteTask(ctx, deleted.id).expect(204);
    const next = await createTask(ctx, 'B');
    expect(next.id).toBeGreaterThan(deleted.id);
  });
});

describe('audit log endpoints', () => {
  it('returns 404 for the history of a task that never existed', async () => {
    await ctx.api.get('/api/tasks/12345/audit-logs').expect(404);
  });

  it('serves a global feed, newest first, with a limit', async () => {
    const a = await createTask(ctx, 'A');
    const b = await createTask(ctx, 'B');
    await changeStatus(ctx, a.id, 'pending').expect(200);
    await changeStatus(ctx, b.id, 'pending').expect(200);
    await changeStatus(ctx, a.id, 'in_progress').expect(200);

    const feed = await ctx.api.get('/api/audit-logs').expect(200);
    expect(feed.body.map((l: AuditLog) => [l.taskTitle, l.fromStatus, l.toStatus])).toEqual([
      ['A', 'pending', 'in_progress'],
      ['B', 'to_do', 'pending'],
      ['A', 'to_do', 'pending'],
      ['B', null, 'to_do'],
      ['A', null, 'to_do'],
    ]);

    const limited = await ctx.api.get('/api/audit-logs?limit=1').expect(200);
    expect(limited.body).toHaveLength(1);
    await ctx.api.get('/api/audit-logs?limit=0').expect(400);
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)('refuses %s on the audit log collection and items', async (method) => {
    const task = await createTask(ctx);
    await changeStatus(ctx, task.id, 'pending').expect(200);
    const before = await auditLogsOf(task.id);

    const collection = await ctx.api[method]('/api/audit-logs').send({}).expect(405);
    expect(collection.body.error.code).toBe('AUDIT_LOG_IMMUTABLE');
    expect(collection.headers.allow).toBe('GET');

    const item = await ctx.api[method](`/api/audit-logs/${before[0]!.id}`).send({ actor: 'Mallory' }).expect(405);
    expect(item.body.error.code).toBe('AUDIT_LOG_IMMUTABLE');
    expect(item.headers.allow).toBe('GET');

    expect(await auditLogsOf(task.id)).toEqual(before);
  });
});
