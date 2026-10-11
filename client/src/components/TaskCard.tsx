import { ArrowRight, CircleCheckBig, Clock, History, Pencil, Trash2, UserRound } from 'lucide-react';
import { formatAuditTimestamp } from '../lib/format';
import { getNextStatus, STATUS_LABELS } from '../lib/status';
import type { Task, TaskActionHandlers } from '../types';
import { Button, IconButton } from './Button';
import { StatusBadge } from './StatusBadge';

export const TASK_DRAG_TYPE = 'application/x-task-id';

interface TaskCardProps extends TaskActionHandlers {
  task: Task;
  busy: boolean;
}

export function TaskCard({ task, busy, onAdvance, onShowHistory, onEdit, onDelete }: TaskCardProps) {
  const next = getNextStatus(task.status);

  return (
    <article
      draggable={!busy}
      onDragStart={(event) => {
        event.dataTransfer.setData(TASK_DRAG_TYPE, String(task.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      aria-busy={busy || undefined}
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md ${
        busy ? 'opacity-70' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-semibold break-words text-slate-900">{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>

      {task.description && (
        <p className="mt-1.5 line-clamp-3 text-sm break-words whitespace-pre-line text-slate-600">{task.description}</p>
      )}

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p className="flex items-center gap-1.5">
          <UserRound className="size-3.5 shrink-0" aria-hidden />
          {task.createdBy && (
            <span className="min-w-0 truncate">
              Created by <span className="font-medium text-slate-700">{task.createdBy}</span>
            </span>
          )}
          <span className="ml-auto text-slate-400">#{task.id}</span>
        </p>
        {task.lastChange && (
          <p className="flex items-start gap-1.5">
            <Clock className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0">
              Moved to {STATUS_LABELS[task.lastChange.toStatus]} by{' '}
              <span className="font-medium text-slate-700">{task.lastChange.actor}</span> ·{' '}
              <time dateTime={task.lastChange.timestamp}>{formatAuditTimestamp(task.lastChange.timestamp)}</time>
            </span>
          </p>
        )}
      </div>

      <div className="mt-3">
        {next ? (
          <Button
            variant="primary"
            size="sm"
            icon={ArrowRight}
            iconRight
            loading={busy}
            onClick={() => onAdvance(task)}
            className="w-full"
          >
            Advance to {STATUS_LABELS[next]}
          </Button>
        ) : (
          <p className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-xs font-medium text-emerald-700">
            <CircleCheckBig className="size-3.5" aria-hidden />
            Completed
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">
        <Button variant="ghost" size="sm" icon={History} onClick={() => onShowHistory(task)}>
          History / Logs
        </Button>
        <span className="flex-1" />
        <IconButton icon={Pencil} label={`Edit "${task.title}"`} onClick={() => onEdit(task)} disabled={busy} />
        <IconButton icon={Trash2} label={`Delete "${task.title}"`} tone="danger" onClick={() => onDelete(task)} disabled={busy} />
      </div>
    </article>
  );
}
