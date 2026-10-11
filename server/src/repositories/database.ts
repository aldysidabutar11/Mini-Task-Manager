import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { INITIAL_TASK_STATUS, TASK_STATUSES } from '../domain/types.js';

export type Db = Database.Database;

const STATUS_SQL_LIST = TASK_STATUSES.map((status) => `'${status}'`).join(', ');

/** Bump whenever SCHEMA_SQL changes in a way CREATE ... IF NOT EXISTS cannot apply. */
const SCHEMA_VERSION = 3;

/**
 * Schema notes
 * - AUTOINCREMENT guarantees ids are never reused, so an audit log can never be
 *   attributed to a different task that later received the same id.
 * - Tasks are archived (deleted_at) instead of physically removed. The foreign key
 *   uses ON DELETE RESTRICT, so a task with history can never be hard-deleted and
 *   its audit logs can never be cascaded away.
 * - audit_logs is append-only: BEFORE UPDATE / BEFORE DELETE triggers abort any
 *   attempt to modify a row, regardless of which code path issues the statement.
 * - One entry per lifecycle event: creation (NULL -> 'to_do'), status change (A -> B),
 *   deletion (status -> NULL). SQLite CHECKs pass when they evaluate to NULL, so "not both
 *   NULL" needs its own CHECK; the creation rule alone would let NULL -> NULL through.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  status      TEXT    NOT NULL CHECK (status IN (${STATUS_SQL_LIST})),
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  task_title  TEXT    NOT NULL,
  actor       TEXT    NOT NULL CHECK (length(trim(actor)) > 0),
  from_status TEXT             CHECK (from_status IS NULL OR from_status IN (${STATUS_SQL_LIST})),
  to_status   TEXT             CHECK (to_status IS NULL OR to_status IN (${STATUS_SQL_LIST})),
  timestamp   TEXT    NOT NULL,
  CHECK (from_status IS NOT NULL OR to_status IS NOT NULL),
  CHECK (from_status IS NOT NULL OR to_status = '${INITIAL_TASK_STATUS}'),
  CHECK (from_status IS NULL OR to_status IS NULL OR from_status <> to_status)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs (task_id, id);

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_block_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: UPDATE is not allowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_block_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: DELETE is not allowed');
END;
`;

/** Opens (or creates) the SQLite database and applies the idempotent schema. */
export function openDatabase(filename: string): Db {
  const inMemory = filename === ':memory:';
  if (!inMemory) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  if (!inMemory) {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  const hasSchema = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get() !== undefined;
  const version = db.pragma('user_version', { simple: true });
  if (hasSchema && version !== SCHEMA_VERSION) {
    db.close();
    throw new OutdatedSchemaError(filename);
  }

  db.exec(SCHEMA_SQL);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);

  return db;
}

export class OutdatedSchemaError extends Error {
  constructor(filename: string) {
    super(
      `The database at ${filename} was created by an older version of this app and its schema is outdated. ` +
        'Stop the server, delete the server/data/ folder (or that file), and start again.',
    );
    this.name = 'OutdatedSchemaError';
  }
}
