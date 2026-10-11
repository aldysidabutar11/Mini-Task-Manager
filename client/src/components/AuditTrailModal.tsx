import { CircleAlert, History, LoaderCircle, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getErrorMessage, isAbortError } from '../api/client';
import { tasksApi } from '../api/tasks';
import { formatAuditEntry } from '../lib/format';
import type { AuditLog, HistoryTarget } from '../types';
import { Modal } from './Modal';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; logs: AuditLog[] };

interface AuditTrailModalProps {
  target: HistoryTarget;
  onClose: () => void;
}

export function AuditTrailModal({ target, onClose }: AuditTrailModalProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    tasksApi
      .auditLogs(target.taskId, controller.signal)
      .then((logs) => setState({ kind: 'ready', logs }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setState({ kind: 'error', message: getErrorMessage(error) });
      });
    return () => controller.abort();
  }, [target.taskId]);

  return (
    <Modal
      size="lg"
      title="Audit trail"
      description={
        <span className="break-words">
          “{target.title}” <span className="text-slate-400">#{target.taskId}</span>
        </span>
      }
      onClose={onClose}
    >
      {state.kind === 'loading' && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading history…
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      {state.kind === 'ready' && state.logs.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
          <History className="size-6 text-slate-300" aria-hidden />
          No audit entries for this task yet.
        </div>
      )}

      {state.kind === 'ready' && state.logs.length > 0 && (
        <ol className="relative ml-1.5 space-y-5 border-l-2 border-slate-200 py-1">
          {state.logs.map((log) => (
            <li key={log.id} className="relative pl-5">
              <span
                className="absolute top-1.5 -left-[7px] size-3 rounded-full border-2 border-white bg-indigo-500 ring-1 ring-indigo-200"
                aria-hidden
              />
              <p className="text-sm leading-6 break-words text-slate-700">{formatAuditEntry(log)}</p>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <Lock className="size-3.5" aria-hidden />
        Append-only record — entries cannot be edited or deleted.
      </p>
    </Modal>
  );
}
