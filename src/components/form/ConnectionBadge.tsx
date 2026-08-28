import type { ConnectionState } from '@/hooks/usePatientSession';

const COPY: Record<ConnectionState, { text: string; dot: string; box: string }> = {
  connecting: {
    text: 'Connecting…',
    dot: 'bg-muted',
    box: 'border-line bg-paper-raised text-ink-soft',
  },
  live: {
    text: 'Saved live',
    dot: 'bg-ok',
    box: 'border-line bg-paper-raised text-ink-soft',
  },
  reconnecting: {
    text: 'Reconnecting — your answers are kept on this device.',
    dot: 'bg-signal',
    box: 'border-signal/50 bg-signal/10 text-ink',
  },
};

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const { text, dot, box } = COPY[state];
  return (
    <p
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${box}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </p>
  );
}
