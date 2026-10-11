import type { Request, Response } from 'express';
import {
  parseChangeStatusInput,
  parseCreateTaskInput,
  parseDeleteTaskInput,
  parseSortOrder,
  parseTaskId,
  parseUpdateTaskDetailsInput,
} from '../domain/validation.js';
import type { TaskService } from '../services/taskService.js';

/** Translates HTTP requests into service calls. No business rules live here. */
export class TaskController {
  constructor(private readonly service: TaskService) {}

  list = (req: Request, res: Response): void => {
    const order = parseSortOrder(req.query.order);
    res.json(this.service.listTasks(order));
  };

  create = (req: Request, res: Response): void => {
    const task = this.service.createTask(parseCreateTaskInput(req.body));
    res.status(201).location(`/api/tasks/${task.id}`).json(task);
  };

  updateDetails = (req: Request, res: Response): void => {
    const id = parseTaskId(req.params.id);
    res.json(this.service.updateTaskDetails(id, parseUpdateTaskDetailsInput(req.body)));
  };

  changeStatus = (req: Request, res: Response): void => {
    const id = parseTaskId(req.params.id);
    const { task } = this.service.changeStatus(id, parseChangeStatusInput(req.body));
    // Same response for a real change and an idempotent no-op: 200 + current task.
    res.json(task);
  };

  remove = (req: Request, res: Response): void => {
    const id = parseTaskId(req.params.id);
    this.service.deleteTask(id, parseDeleteTaskInput(req.body));
    res.status(204).end();
  };
}
