import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './repositories/database.js';

// Node version guard. It must run before better-sqlite3 is loaded: its bundled binary needs
// Node-API 10 (Node 22.14+) and crashes older Node versions with a segmentation fault instead
// of a readable error. That is why the app and database modules are imported dynamically below.
// Supported: ^22.14.0 || ^24.0.0 || ^26.0.0 (same as "engines" in package.json).
function isSupportedNodeVersion(version: string): boolean {
  const [major = 0, minor = 0] = version.replace(/^v/, '').split('.').map(Number);
  return (major === 22 && minor >= 14) || major === 24 || major === 26;
}

if (!isSupportedNodeVersion(process.version)) {
  console.error(
    `[server] Node.js 22.14+, 24.x, or 26.x is required (found ${process.version}). ` +
      "better-sqlite3's bundled binary needs Node-API 10.",
  );
  process.exit(1);
}

const { createApp } = await import('./app.js');
const { openDatabase, OutdatedSchemaError } = await import('./repositories/database.js');

// Resolves to the server/ folder both from src/ (tsx) and dist/ (compiled).
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const port = Number(process.env.PORT ?? 5000);
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(serverRoot, 'data', 'tasks.db');
const clientDist = path.resolve(serverRoot, '..', 'client', 'dist');

let db: Db;
try {
  db = openDatabase(dbPath);
} catch (error) {
  if (!(error instanceof OutdatedSchemaError)) throw error;
  console.error(`[server] ${error.message}`);
  process.exit(1);
}

const app = createApp({
  db,
  clientDistDir: fs.existsSync(path.join(clientDist, 'index.html')) ? clientDist : undefined,
});

const server = app.listen(port, () => {
  console.log(`[server] API listening on http://localhost:${port}/api`);
  console.log(`[server] SQLite database: ${dbPath}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE' ? `[server] Port ${port} is already in use. Set PORT to use another one.` : error,
  );
  db.close();
  process.exit(1);
});

function shutdown(signal: string): void {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
