import { Inbox } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { STATUS_LABELS, STATUS_STYLES } from '../lib/status';
import { TASK_STATUSES, type Task, type TaskActionHandlers, type TaskStatus } from '../types';
import { TASK_DRAG_TYPE, TaskCard } from './TaskCard';

interface KanbanBoardProps extends TaskActionHandlers {
  tasks: Task[];
  busyTaskIds: ReadonlySet<number>;
  /** Drag-and-drop to any column. The server decides whether the move is valid. */
  onMove: (task: Task, status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, busyTaskIds, onMove, ...actions }: KanbanBoardProps) {
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = { to_do: [], pending: [], in_progress: [], done: [] };
    for (const task of tasks) groups[task.status].push(task);
    return groups;
  }, [tasks]);

  function handleDragOver(event: DragEvent<HTMLElement>, status: TaskStatus) {
    if (!event.dataTransfer.types.includes(TASK_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(status);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    setDropTarget(null);
    const task = tasks.find((candidate) => String(candidate.id) === event.dataTransfer.getData(TASK_DRAG_TYPE));
    if (task && task.status !== status && !busyTaskIds.has(task.id)) onMove(task, status);
  }

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasksByStatus[status];
        return (
          <section
            key={status}
            aria-label={`${STATUS_LABELS[status]} column`}
            onDragOver={(event) => handleDragOver(event, status)}
            onDragLeave={handleDragLeave}
            onDrop={(event) => handleDrop(event, status)}
            className={`flex flex-col rounded-2xl border-t-4 bg-slate-100/80 p-3 transition-colors ${STATUS_STYLES[status].column} ${
              dropTarget === status ? 'bg-indigo-50 ring-2 ring-indigo-300' : ''
            }`}
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className={`size-2 rounded-full ${STATUS_STYLES[status].dot}`} aria-hidden />
                {STATUS_LABELS[status]}
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {columnTasks.length}
              </span>
            </header>

            <div className="flex min-h-28 flex-col gap-3">
              {columnTasks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 p-6 text-xs text-slate-400">
                  <Inbox className="size-5" aria-hidden />
                  No tasks
                </div>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} busy={busyTaskIds.has(task.id)} {...actions} />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
