'use client';

import { useEffect, useState } from 'react';
import type { ConnectionState } from '@/hooks/usePatientSession';

/** A healthy connection says nothing; only a real problem is worth the space. */
const COPY: Record<Exclude<ConnectionState, 'live'>, string> = {
  reconnecting: 'Reconnecting — your answers are kept on this device.',
  connecting: 'Cannot reach the server — your answers are kept on this device.',
};

/** A momentary hiccup should not flash a warning, so a drop has to persist. */
const SETTLE_MS = 1200;

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === 'live') {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === 'live' || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-40 border-b border-signal/40 bg-signal/15 px-4 py-2 text-center text-sm text-ink backdrop-blur sm:px-6"
    >
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-caret rounded-full bg-signal" aria-hidden="true" />
        {COPY[state]}
      </span>
    </div>
  );
}
