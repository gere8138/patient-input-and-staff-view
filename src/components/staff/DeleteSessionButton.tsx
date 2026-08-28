'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onConfirm: () => void;
  /** The list rows are cramped; the detail header has room for words. */
  size?: 'compact' | 'regular';
  sessionName: string;
}

/**
 * Two-step rather than a browser confirm(): deleting is irreversible and the
 * console is a busy screen, but a modal for clearing away an abandoned form
 * would be heavier than the action deserves.
 */
export function DeleteSessionButton({ onConfirm, size = 'regular', sessionName }: Props) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Disarm on its own so a half-pressed button never lingers.
  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 4000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  const compact = size === 'compact';
  const base = compact ? 'shrink-0 px-2 py-1 text-[11px]' : 'min-h-[36px] px-3 text-xs';

  if (!armed) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setArmed(true);
        }}
        aria-label={`Delete the inactive session for ${sessionName}`}
        className={`rounded-md border border-console-line text-muted transition-colors hover:border-alert/60 hover:text-alert ${base}`}
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onConfirm();
        }}
        aria-label={`Confirm deleting the session for ${sessionName}`}
        className={`rounded-md bg-alert font-medium text-white transition-colors hover:bg-[var(--color-alert-strong)] focus-visible:bg-[var(--color-alert-strong)] ${base}`}
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setArmed(false);
        }}
        className={`rounded-md border border-console-line text-muted transition-colors hover:border-muted hover:text-console-ink ${base}`}
      >
        Cancel
      </button>
    </span>
  );
}
