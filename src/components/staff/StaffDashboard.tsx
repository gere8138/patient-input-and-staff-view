'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStaffSessions } from '@/hooks/useStaffSessions';
import { STATUS_LABEL, type PresenceStatus } from '@/lib/presence';
import { relativeTime } from '@/lib/presence';
import { EmptyState } from './EmptyState';
import { SessionDetail } from './SessionDetail';
import { SessionList } from './SessionList';

const COUNTED: PresenceStatus[] = ['filling', 'idle', 'submitted', 'inactive'];

export function StaffDashboard({ focusSessionId }: { focusSessionId?: string }) {
  const { sessions, byId, connection, lastUpdateAt, deleteSession } = useStaffSessions();
  const [selectedId, setSelectedId] = useState<string | null>(focusSessionId ?? null);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Keep the URL shareable without a route change that would drop the socket view.
  useEffect(() => {
    const path = selectedId ? `/staff/${selectedId}` : '/staff';
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
  }, [selectedId]);

  // Desktop shows a detail pane by default; on mobile the list comes first and
  // a row has to be tapped, so nothing is auto-selected there.
  useEffect(() => {
    if (isWide && selectedId === null && sessions.length > 0) setSelectedId(sessions[0].sessionId);
  }, [isWide, sessions, selectedId]);

  const counts = useMemo(() => {
    const out: Record<PresenceStatus, number> = { filling: 0, idle: 0, inactive: 0, submitted: 0 };
    for (const session of sessions) out[session.status] += 1;
    return out;
  }, [sessions]);

  const selected = selectedId ? byId[selectedId] : undefined;
  const missing = selectedId !== null && selected === undefined && connection === 'live';

  return (
    <main className="console flex min-h-dvh flex-col bg-console text-console-ink">
      <header className="border-b border-console-line px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Intake Form Console</h1>
            <p className="mt-0.5 font-mono text-[11px] tracking-widest text-muted uppercase">
              Agnos · staff console
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <dl className="flex items-center gap-4 text-xs">
              {COUNTED.map((status) => (
                <div key={status} className="flex items-baseline gap-1.5">
                  <dt className="text-muted">{STATUS_LABEL[status]}</dt>
                  <dd className="font-mono text-console-ink">{counts[status]}</dd>
                </div>
              ))}
            </dl>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                connection === 'live'
                  ? 'border-console-line text-muted'
                  : 'border-signal/50 bg-signal/10 text-signal'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connection === 'live' ? 'bg-ok' : 'animate-caret bg-signal'}`}
                aria-hidden="true"
              />
              {connection === 'live' ? 'Live' : 'Reconnecting to live updates'}
            </span>
          </div>
        </div>

        {connection !== 'live' && lastUpdateAt && (
          <p className="mt-3 text-xs text-signal">
            Showing the last data received {relativeTime(lastUpdateAt)}.
          </p>
        )}
      </header>

      <p aria-live="polite" className="sr-only">
        {counts.filling} patients actively filling, {counts.submitted} submitted.
      </p>

      <div className="flex-1 lg:grid lg:min-h-0 lg:grid-cols-[320px_1fr] lg:overflow-hidden">
        <section
          className={`overflow-y-auto border-console-line px-4 py-4 sm:px-6 lg:block lg:border-r lg:px-4 ${
            selected || missing ? 'hidden' : 'block'
          }`}
          aria-label="Patient sessions"
        >
          {sessions.length === 0 ? (
            <EmptyState />
          ) : (
            <SessionList
              sessions={sessions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={deleteSession}
            />
          )}
        </section>

        <section className={`${selected || missing ? 'block' : 'hidden lg:block'} lg:overflow-hidden`}>
          {selected ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="m-4 min-h-[40px] rounded-lg border border-console-line px-3 text-sm text-muted lg:hidden"
              >
                ← All patients
              </button>
              <SessionDetail session={selected} onDelete={deleteSession} />
            </>
          ) : missing ? (
            <div className="px-6 py-10 text-center">
              <p className="text-console-ink">This session has ended or expired.</p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mt-4 text-sm text-signal underline underline-offset-4"
              >
                Back to the list
              </button>
            </div>
          ) : (
            <div className="hidden h-full items-center justify-center px-6 text-center text-muted lg:flex">
              <p>Select a patient to watch their form fill in.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
