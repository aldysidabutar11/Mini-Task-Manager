import type { AuditLog } from '../types';

const pad = (value: number) => String(value).padStart(2, '0');

/** "YYYY-MM-DD HH:mm" in the viewer's local time zone. */
export function formatAuditTimestamp(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Audit lines use the raw status values, exactly like the spec example:
 * Creation:      User "Aldy Samuel" created Task "Prepare Invoice" at 2025-01-01 10:00
 * Status change: User "Aldy Samuel" changed Task "Prepare Invoice" status from "pending" to "in_progress" at 2025-01-01 10:00
 * Deletion:      User "Aldy Samuel" deleted Task "Prepare Invoice" (status "in_progress") at 2025-01-01 10:00
 */
export function formatAuditEntry(log: AuditLog): string {
  const at = formatAuditTimestamp(log.timestamp);
  if (log.toStatus === null) {
    return `User "${log.actor}" deleted Task "${log.taskTitle}" (status "${log.fromStatus}") at ${at}`;
  }
  if (log.fromStatus === null) {
    return `User "${log.actor}" created Task "${log.taskTitle}" at ${at}`;
  }
  return `User "${log.actor}" changed Task "${log.taskTitle}" status from "${log.fromStatus}" to "${log.toStatus}" at ${at}`;
}
