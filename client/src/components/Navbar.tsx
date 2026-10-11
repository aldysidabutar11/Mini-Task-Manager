import { ClipboardList, Plus, UserRound } from 'lucide-react';
import { ACTORS, type Actor } from '../types';
import { Button } from './Button';

interface NavbarProps {
  actor: Actor;
  onActorChange: (actor: Actor) => void;
  onCreateTask: () => void;
}

export function Navbar({ actor, onActorChange, onCreateTask }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="mr-auto flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">Mini Task Manager</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Task creation and every status change are audited</p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-lg bg-slate-100 py-1 pr-1 pl-2.5 text-sm">
          <UserRound className="size-4 text-slate-500" aria-hidden />
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">Acting as</span>
          <select
            id="actor"
            name="actor"
            value={actor}
            onChange={(event) => onActorChange(event.target.value as Actor)}
            aria-label="Acting as"
            className="h-7 cursor-pointer rounded-md border-0 bg-white px-2 text-sm font-medium text-slate-900 shadow-xs ring-1 ring-slate-300 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            {ACTORS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <Button variant="primary" icon={Plus} onClick={onCreateTask} aria-label="Create new task">
          <span className="hidden sm:inline">New task</span>
        </Button>
      </div>
    </header>
  );
}
