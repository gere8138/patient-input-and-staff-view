'use client';

import { labelFor } from '@/lib/fields';
import { relativeTime } from '@/lib/presence';
import { sessionDisplayName, type SessionState } from '@/lib/realtime/events';
import { StatusPill } from './StatusPill';

interface Props {
  sessions: SessionState[];
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
}

export function SessionList({ sessions, selectedId, onSelect }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => {
        const selected = session.sessionId === selectedId;
        const pct = Math.round((session.completedFields / session.requiredFields) * 100);
        return (
          <li key={session.sessionId}>
            <button
              type="button"
              onClick={() => onSelect(session.sessionId)}
              aria-current={selected ? 'true' : undefined}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selected
                  ? 'border-signal/50 bg-console-raised'
                  : 'border-console-line bg-console-raised/60 hover:border-console-line hover:bg-console-raised'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-console-ink">{sessionDisplayName(session)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{session.sessionId}</p>
                </div>
                <StatusPill status={session.status} compact />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-console-line">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      session.status === 'submitted' ? 'bg-ok' : 'bg-signal'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-muted">
                  {session.completedFields}/{session.requiredFields}
                </span>
              </div>

              <p className="mt-2 truncate text-[11px] text-muted">
                {session.activeField
                  ? `Typing in ${labelFor(session.activeField)}`
                  : `Last activity ${relativeTime(session.lastActivityAt)}`}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
