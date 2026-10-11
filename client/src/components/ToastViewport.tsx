import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from 'lucide-react';
import type { Toast, ToastVariant } from '../hooks/useToasts';

const VARIANT_STYLES: Record<ToastVariant, { icon: LucideIcon; className: string; iconClass: string }> = {
  success: { icon: CircleCheck, className: 'border-emerald-200', iconClass: 'text-emerald-600' },
  error: { icon: CircleAlert, className: 'border-rose-200', iconClass: 'text-rose-600' },
  info: { icon: Info, className: 'border-sky-200', iconClass: 'text-sky-600' },
};

interface ToastViewportProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96">
      {toasts.map((toast) => {
        const { icon: Icon, className, iconClass } = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg ${className}`}
          >
            <Icon className={`mt-0.5 size-5 shrink-0 ${iconClass}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              {toast.message && <p className="mt-0.5 text-sm break-words text-slate-600">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-0.5 text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
