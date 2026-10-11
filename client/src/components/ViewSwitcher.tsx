import { Activity, SquareKanban, type LucideIcon } from 'lucide-react';
import type { ViewMode } from '../types';

const VIEWS: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: 'board', label: 'Board', icon: SquareKanban },
  { value: 'activity', label: 'Activity', icon: Activity },
];

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div role="group" aria-label="Choose view" className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
      {VIEWS.map(({ value: view, label, icon: Icon }) => {
        const active = view === value;
        return (
          <button
            key={view}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(view)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
              active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
