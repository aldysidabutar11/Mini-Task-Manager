import path from 'node:path';
import express, { type Express } from 'express';
import { AuditLogController } from './controllers/auditLogController.js';
import { errorHandler, notFoundHandler } from './controllers/errorHandler.js';
import { TaskController } from './controllers/taskController.js';
import { AuditLogRepository } from './repositories/auditLogRepository.js';
import type { Db } from './repositories/database.js';
import { TaskRepository } from './repositories/taskRepository.js';
import { createApiRouter } from './routes/index.js';
import { AuditLogService } from './services/auditLogService.js';
import { TaskService, type Clock } from './services/taskService.js';

export interface AppOptions {
  db: Db;
  clock?: Clock;
  /** When set, the built React app is served from this directory (production mode). */
  clientDistDir?: string;
}

/** Composition root: wires repositories -> services -> controllers -> routes. */
export function createApp({ db, clock, clientDistDir }: AppOptions): Express {
  const taskRepository = new TaskRepository(db);
  const auditLogRepository = new AuditLogRepository(db);

  const taskService = new TaskService(db, taskRepository, auditLogRepository, clock);
  const auditLogService = new AuditLogService(taskRepository, auditLogRepository);

  const taskController = new TaskController(taskService);
  const auditLogController = new AuditLogController(auditLogService);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createApiRouter(taskController, auditLogController));
  app.use('/api', notFoundHandler);

  if (clientDistDir) {
    app.use(express.static(clientDistDir));
    // Single-page-app fallback: any other GET renders the React shell.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
