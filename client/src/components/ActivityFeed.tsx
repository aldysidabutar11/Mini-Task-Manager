import { Activity, CircleAlert, History, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage, isAbortError } from '../api/client';
import { auditLogsApi } from '../api/tasks';
import { formatAuditEntry } from '../lib/format';
import type { AuditLog, HistoryTarget } from '../types';
import { Button } from './Button';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; logs: AuditLog[] };

interface ActivityFeedProps {
  onShowHistory: (target: HistoryTarget) => void;
}

/** Global, newest-first feed of every status change, including changes to deleted tasks. */
export function ActivityFeed({ onShowHistory }: ActivityFeedProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback((signal?: AbortSignal) => {
    setState({ kind: 'loading' });
    auditLogsApi
      .feed(100, signal)
      .then((logs) => setState({ kind: 'ready', logs }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setState({ kind: 'error', message: getErrorMessage(error) });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Global activity log</h3>
          <p className="text-xs text-slate-500">Latest 100 audit entries (task creations and status changes), newest first.</p>
        </div>
        <Button size="sm" icon={RefreshCw} onClick={() => load()} loading={state.kind === 'loading'}>
          Refresh
        </Button>
      </header>

      {state.kind === 'loading' && (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading activity…
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="m-4 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      {state.kind === 'ready' && state.logs.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
          <Activity className="size-6 text-slate-300" aria-hidden />
          No activity recorded yet.
        </div>
      )}

      {state.kind === 'ready' && state.logs.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {state.logs.map((log) => (
            <li key={log.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-sm leading-6 break-words text-slate-700">{formatAuditEntry(log)}</p>
              <Button
                size="sm"
                variant="ghost"
                icon={History}
                onClick={() => onShowHistory({ taskId: log.taskId, title: log.taskTitle })}
                className="self-start sm:self-center"
              >
                Task history
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
