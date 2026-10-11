import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Built on the native <dialog> element: showModal() gives focus trapping, Escape
 * handling, inert background and top-layer stacking without extra libraries.
 */
export function Modal({ title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressStartedOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // React handles autoFocus in JS (before the dialog is open), so focus explicitly.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Close only when both press and release happen on the backdrop, so selecting
        // text inside an input and releasing outside does not dismiss the form.
        if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose();
      }}
      className={`m-auto max-h-[85vh] w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 ${
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
      }`}
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && <div className="mt-0.5 text-sm text-slate-500">{description}</div>}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} className="-mr-2 -mt-1" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</footer>
        )}
      </div>
    </dialog>
  );
}
