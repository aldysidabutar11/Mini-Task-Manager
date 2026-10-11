import { CircleAlert, Save } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import type { Actor, Task, TaskDetailsPayload } from '../types';
import { Button } from './Button';
import { Modal } from './Modal';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

interface TaskModalProps {
  /** When provided the modal edits this task; otherwise it creates a new one. */
  task?: Task;
  /** Recorded as the creator of a new task. */
  actor: Actor;
  onSubmit: (payload: TaskDetailsPayload) => Promise<void>;
  onClose: () => void;
}

export function TaskModal({ task, actor, onSubmit, onClose }: TaskModalProps) {
  const formId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = task !== undefined;
  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title: trimmedTitle, description: description.trim() || null });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit task' : 'Create a new task'}
      description={
        isEdit
          ? 'Renaming does not alter past audit entries; they keep the title they were recorded with.'
          : `New tasks start in To Do. The creation is recorded in the audit trail as ${actor}.`
      }
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" icon={Save} loading={submitting} disabled={!canSubmit}>
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor={titleId} className="text-sm font-medium text-slate-700">
              Title <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-slate-400">
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={TITLE_MAX}
            required
            data-autofocus
            placeholder="e.g. Prepare sprint review"
            className="block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor={descriptionId} className="text-sm font-medium text-slate-700">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <span className="text-xs text-slate-400">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
          <textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            placeholder="Add any helpful context"
            className="block w-full resize-y rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
      </form>
    </Modal>
  );
}
