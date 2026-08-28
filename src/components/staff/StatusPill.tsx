import { STATUS_LABEL, type PresenceStatus } from '@/lib/presence';

const STYLES: Record<PresenceStatus, { box: string; dot: string; pulse: boolean }> = {
  filling: { box: 'border-signal/40 bg-signal/12 text-signal', dot: 'bg-signal', pulse: true },
  idle: { box: 'border-muted/35 bg-muted/10 text-muted', dot: 'bg-muted', pulse: false },
  inactive: { box: 'border-console-line bg-console-line/40 text-muted', dot: 'bg-muted/60', pulse: false },
  submitted: { box: 'border-ok/40 bg-ok/12 text-ok', dot: 'bg-ok', pulse: false },
};

export function StatusPill({ status, compact = false }: { status: PresenceStatus; compact?: boolean }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium ${style.box} ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot} ${style.pulse ? 'animate-caret' : ''}`}
        aria-hidden="true"
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
