'use client';

import { fieldsInSection, PHONE_COUNTRY_FOR, SECTIONS } from '@/lib/fields';
import { formatPhone } from '@/lib/schema';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import { relativeTime, STATUS_LABEL } from '@/lib/presence';
import { sessionDisplayName, type SessionState } from '@/lib/realtime/events';
import { FieldRow } from './FieldRow';
import { StatusPill } from './StatusPill';

export function SessionDetail({ session }: { session: SessionState }) {
  const pct = Math.round((session.completedFields / session.requiredFields) * 100);

  return (
    <article className="flex h-full flex-col">
      <header className="border-b border-console-line px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-console-ink">{sessionDisplayName(session)}</h2>
            <p className="mt-1 font-mono text-xs text-muted">
              {session.sessionId} · started {relativeTime(session.startedAt)}
            </p>
          </div>
          <StatusPill status={session.status} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-console-line">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                session.status === 'submitted' ? 'bg-ok' : 'bg-signal'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted">
            {session.completedFields}/{session.requiredFields} required
          </span>
        </div>

        <p className="sr-only" aria-live="polite">
          {sessionDisplayName(session)} is {STATUS_LABEL[session.status].toLowerCase()}.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="grid gap-6 min-[1440px]:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.id}>
              <h3 className="px-2 pb-1 font-mono text-[11px] tracking-widest text-muted uppercase">
                {section.title}
              </h3>
              <div className="divide-y divide-console-line/60">
                {fieldsInSection(section.id).map((spec) => (
                  <FieldRow
                    key={spec.key}
                    spec={spec}
                    value={session.data[spec.key]}
                    formatted={
                      PHONE_COUNTRY_FOR[spec.key]
                        ? formatPhone(
                            session.data[spec.key] ?? '',
                            session.data[PHONE_COUNTRY_FOR[spec.key]!] || DEFAULT_PHONE_COUNTRY,
                          )
                        : undefined
                    }
                    isActive={
                      session.status === 'filling' &&
                      (session.activeField === spec.key ||
                        session.activeField === PHONE_COUNTRY_FOR[spec.key])
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {session.submittedAt && (
          <p className="mt-6 rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
            Submitted {relativeTime(session.submittedAt)} — this form is final.
          </p>
        )}
      </div>
    </article>
  );
}
