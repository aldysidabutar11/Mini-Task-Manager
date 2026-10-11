import { useCallback, useState } from 'react';
import { ACTORS, type Actor } from '../types';

const STORAGE_KEY = 'mini-task-manager.actor';

function isActor(value: unknown): value is Actor {
  return typeof value === 'string' && (ACTORS as readonly string[]).includes(value);
}

function readStoredActor(): Actor {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isActor(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); fall back to the default.
  }
  return ACTORS[0];
}

/** The globally selected actor, remembered per browser for convenience. */
export function useActor(): [Actor, (actor: Actor) => void] {
  const [actor, setActorState] = useState<Actor>(readStoredActor);

  const setActor = useCallback((next: Actor) => {
    setActorState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisting is acceptable; the selection still applies to this session.
    }
  }, []);

  return [actor, setActor];
}
