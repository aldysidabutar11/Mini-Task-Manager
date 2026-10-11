import { STATUS_LABELS, STATUS_STYLES } from '../lib/status';
import type { TaskStatus } from '../types';

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 align-middle text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STATUS_STYLES[status].badge}`}
    >
      <span className={`size-1.5 rounded-full ${STATUS_STYLES[status].dot}`} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
