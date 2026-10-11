import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, OutdatedSchemaError } from '../src/repositories/database.js';
import { changeStatus, createTask, createTestContext, type TestContext } from './helpers.js';

/**
 * These tests bypass the API and talk to SQLite directly, proving that the
 * append-only guarantee holds even if application code tried to break it.
 */
describe('audit_logs table (database level)', () => {
  let ctx: TestContext;
  let taskId: number;

  beforeEach(async () => {
    ctx = createTestContext();
    taskId = (await createTask(ctx)).id;
    await changeStatus(ctx, taskId, 'pending').expect(200);
  });

  it('aborts UPDATE statements', () => {
    expect(() => ctx.db.prepare("UPDATE audit_logs SET actor = 'Mallory'").run()).toThrow(/append-only: UPDATE/);
  });

  it('aborts DELETE statements', () => {
    expect(() => ctx.db.prepare('DELETE FROM audit_logs').run()).toThrow(/append-only: DELETE/);
  });

  it('prevents hard-deleting a task that has history (no cascading loss of logs)', () => {
    expect(() => ctx.db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId)).toThrow(/FOREIGN KEY/);
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get()).toEqual({ n: 2 });
  });

  describe('row constraints', () => {
    const insertSql = `INSERT INTO audit_logs (task_id, task_title, actor, from_status, to_status, timestamp)
       VALUES (?, 'x', 'Aldy Samuel', ?, ?, '2026-01-01T00:00:00.000Z')`;

    it('rejects rows that do not describe a real change', () => {
      const insert = ctx.db.prepare(insertSql);
      expect(() => insert.run(taskId, 'pending', 'pending')).toThrow(/CHECK/);
      expect(() => insert.run(taskId, 'pending', 'archived')).toThrow(/CHECK/);
      expect(() => insert.run(9999, 'to_do', 'pending')).toThrow(/FOREIGN KEY/);
    });

    it.each(['pending', 'in_progress', 'done'])('rejects a null from_status with to_status %s', (toStatus) => {
      expect(() => ctx.db.prepare(insertSql).run(taskId, null, toStatus)).toThrow(/CHECK/);
    });

    it('accepts a null from_status only for the creation entry (to_status = to_do)', () => {
      expect(() => ctx.db.prepare(insertSql).run(taskId, null, 'to_do')).not.toThrow();
    });

    it('rejects an entry where both statuses are null', () => {
      expect(() => ctx.db.prepare(insertSql).run(taskId, null, null)).toThrow(/CHECK/);
    });

    it('accepts a null to_status as the deletion entry (status -> null)', () => {
      expect(() => ctx.db.prepare(insertSql).run(taskId, 'pending', null)).not.toThrow();
    });
  });
});

describe('openDatabase', () => {
  it('refuses to open a database created with an older schema', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtm-schema-'));
    const file = path.join(dir, 'old.db');
    try {
      const legacy = new Database(file);
      legacy.exec('CREATE TABLE tasks (id INTEGER PRIMARY KEY)');
      legacy.close();

      expect(() => openDatabase(file)).toThrow(OutdatedSchemaError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
