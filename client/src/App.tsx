import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, getErrorMessage, isAbortError } from './api/client';
import { tasksApi } from './api/tasks';
import { ActivityFeed } from './components/ActivityFeed';
import { AuditTrailModal } from './components/AuditTrailModal';
import { Button } from './components/Button';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { KanbanBoard } from './components/KanbanBoard';
import { Navbar } from './components/Navbar';
import { TaskModal } from './components/TaskModal';
import { ToastViewport } from './components/ToastViewport';
import { ViewSwitcher } from './components/ViewSwitcher';
import { useActor } from './hooks/useActor';
import { useToasts } from './hooks/useToasts';
import { getNextStatus, STATUS_LABELS } from './lib/status';
import type { HistoryTarget, Task, TaskActionHandlers, TaskDetailsPayload, TaskStatus, ViewMode } from './types';

type TaskModalState = { mode: 'create' } | { mode: 'edit'; task: Task } | null;
type LoadState = 'loading' | 'ready' | 'error';

const VIEW_COPY: Record<ViewMode, { title: string; hint: string }> = {
  board: {
    title: 'Board',
    hint: 'Advance a task one step at a time, or drag a card to another column. The server validates every move.',
  },
  activity: {
    title: 'Activity',
    hint: 'Immutable history of every task creation and status change, including deleted tasks.',
  },
};

export default function App() {
  const [actor, setActor] = useActor();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const [view, setView] = useState<ViewMode>('board');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskIds, setBusyTaskIds] = useState<ReadonlySet<number>>(() => new Set());
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  /** Resolves to true on success. Never throws, so it is safe to fire-and-forget. */
  const loadTasks = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      setTasks(await tasksApi.list(signal));
      setLoadState('ready');
      return true;
    } catch (error) {
      if (isAbortError(error)) return false;
      setLoadError(getErrorMessage(error));
      setLoadState((current) => (current === 'ready' ? current : 'error'));
      return false;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadTasks(controller.signal);
    return () => controller.abort();
  }, [loadTasks]);

  async function refreshTasks() {
    setRefreshing(true);
    const ok = await loadTasks();
    setRefreshing(false);
    if (!ok && loadState === 'ready') {
      pushToast({ variant: 'error', title: 'Could not refresh tasks', message: 'Showing the last known state.' });
    }
  }

  const replaceTask = useCallback((updated: Task) => {
    setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
  }, []);

  const setTaskBusy = useCallback((id: number, busy: boolean) => {
    setBusyTaskIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const changeStatus = useCallback(
    async (task: Task, status: TaskStatus) => {
      setTaskBusy(task.id, true);
      try {
        const updated = await tasksApi.changeStatus(task.id, { status, actor });
        replaceTask(updated);
        pushToast({
          variant: 'success',
          title: `Moved to ${STATUS_LABELS[updated.status]}`,
          message: `“${updated.title}”, recorded as ${actor}.`,
        });
      } catch (error) {
        const rejected = error instanceof ApiError && error.status === 400;
        pushToast({
          variant: 'error',
          title: rejected ? 'Status change rejected' : 'Could not change status',
          message: getErrorMessage(error),
        });
        // The board may be stale (e.g. another user already moved the task): resync.
        void loadTasks();
      } finally {
        setTaskBusy(task.id, false);
      }
    },
    [actor, loadTasks, pushToast, replaceTask, setTaskBusy],
  );

  const taskActions: TaskActionHandlers = {
    onAdvance: (task) => {
      const next = getNextStatus(task.status);
      if (next) void changeStatus(task, next);
    },
    onShowHistory: (task) => setHistoryTarget({ taskId: task.id, title: task.title }),
    onEdit: (task) => setTaskModal({ mode: 'edit', task }),
    onDelete: setTaskToDelete,
  };

  async function handleSubmitTask(payload: TaskDetailsPayload) {
    if (taskModal?.mode === 'edit') {
      const updated = await tasksApi.update(taskModal.task.id, payload);
      replaceTask(updated);
      pushToast({ variant: 'success', title: 'Task updated', message: `“${updated.title}”` });
    } else {
      const created = await tasksApi.create({ ...payload, actor });
      setTasks((current) => [created, ...current]);
      pushToast({ variant: 'success', title: 'Task created', message: `“${created.title}” was added to To Do.` });
    }
    setTaskModal(null);
  }

  async function handleConfirmDelete() {
    if (!taskToDelete) return;
    const { id } = taskToDelete;
    try {
      await tasksApi.remove(id, { actor });
      pushToast({
        variant: 'info',
        title: 'Task deleted',
        message: `Recorded as ${actor}. Its audit trail is preserved in the Activity view.`,
      });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
      pushToast({ variant: 'info', title: 'Task was already deleted' });
    }
    setTasks((current) => current.filter((task) => task.id !== id));
    setTaskToDelete(null);
  }

  function renderContent() {
    if (view === 'activity') {
      return <ActivityFeed onShowHistory={setHistoryTarget} />;
    }

    if (loadState === 'loading') {
      return (
        <p className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          Loading tasks…
        </p>
      );
    }

    if (loadState === 'error') {
      return (
        <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-xs ring-1 ring-rose-200">
          <CircleAlert className="size-8 text-rose-500" aria-hidden />
          <div>
            <p className="font-semibold text-slate-900">Could not load tasks</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
          </div>
          <Button icon={RefreshCw} loading={refreshing} onClick={refreshTasks}>
            Try again
          </Button>
        </div>
      );
    }

    return <KanbanBoard tasks={tasks} busyTaskIds={busyTaskIds} onMove={changeStatus} {...taskActions} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar actor={actor} onActorChange={setActor} onCreateTask={() => setTaskModal({ mode: 'create' })} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900">{VIEW_COPY[view].title}</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">{VIEW_COPY[view].hint}</p>
            {view !== 'activity' && (
              <p className="mt-1 text-xs text-slate-500">
                New tasks and status changes are recorded as{' '}
                <strong className="font-semibold text-slate-700">{actor}</strong>.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ViewSwitcher value={view} onChange={setView} />
            {view !== 'activity' && (
              <Button icon={RefreshCw} loading={refreshing} onClick={refreshTasks} aria-label="Refresh tasks" title="Refresh tasks" />
            )}
          </div>
        </div>

        {renderContent()}
      </main>

      {taskModal && (
        <TaskModal
          task={taskModal.mode === 'edit' ? taskModal.task : undefined}
          actor={actor}
          onSubmit={handleSubmitTask}
          onClose={() => setTaskModal(null)}
        />
      )}
      {historyTarget && <AuditTrailModal target={historyTarget} onClose={() => setHistoryTarget(null)} />}
      {taskToDelete && (
        <ConfirmDeleteDialog
          task={taskToDelete}
          actor={actor}
          onConfirm={handleConfirmDelete}
          onClose={() => setTaskToDelete(null)}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
