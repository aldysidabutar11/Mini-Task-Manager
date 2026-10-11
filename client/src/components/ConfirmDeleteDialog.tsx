import { CircleAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '../api/client';
import type { Actor, Task } from '../types';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDeleteDialogProps {
  task: Task;
  /** Recorded as the actor of the deletion entry. */
  actor: Actor;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDeleteDialog({ task, actor, onConfirm, onClose }: ConfirmDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      setDeleting(false);
    }
  }

  return (
    <Modal
      title="Delete task?"
      onClose={() => !deleting && onClose()}
      footer={
        <>
          <Button onClick={onClose} disabled={deleting} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} loading={deleting} onClick={handleConfirm}>
            Delete task
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        “<span className="font-semibold break-words">{task.title}</span>” will be removed from the board.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        The deletion is recorded in the audit trail as <strong className="font-semibold text-slate-700">{actor}</strong>.
        Its history is preserved and stays visible in the Activity view.
      </p>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </Modal>
  );
}
