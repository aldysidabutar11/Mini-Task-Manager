import type { AuditLog, ChangeStatusPayload, CreateTaskPayload, DeleteTaskPayload, Task, TaskDetailsPayload } from '../types';
import { request } from './client';

export const tasksApi = {
  list: (signal?: AbortSignal) => request<Task[]>('/tasks?order=desc', { signal }),

  create: (payload: CreateTaskPayload) => request<Task>('/tasks', { method: 'POST', body: payload }),

  update: (id: number, payload: TaskDetailsPayload) => request<Task>(`/tasks/${id}`, { method: 'PATCH', body: payload }),

  changeStatus: (id: number, payload: ChangeStatusPayload) =>
    request<Task>(`/tasks/${id}/status`, { method: 'PUT', body: payload }),

  remove: (id: number, payload: DeleteTaskPayload) => request<void>(`/tasks/${id}`, { method: 'DELETE', body: payload }),

  auditLogs: (id: number, signal?: AbortSignal) => request<AuditLog[]>(`/tasks/${id}/audit-logs`, { signal }),
};

export const auditLogsApi = {
  feed: (limit = 100, signal?: AbortSignal) => request<AuditLog[]>(`/audit-logs?limit=${limit}`, { signal }),
};
