import { countCompletedRequired, REQUIRED_FIELDS } from '../fields';
import { deriveStatus, SESSION_TTL_MS } from '../presence';
import type { PatientData, PatientField } from '../schema';
import type { SessionState } from './events';

/**
 * The one interface the rest of the server talks to. Swapping the in-memory
 * map for Redis (see spec §14) means implementing this and nothing else.
 */
export interface SessionStore {
  get(sessionId: string): SessionState | undefined;
  all(): SessionState[];
  ensure(sessionId: string): SessionState;
  applyPatch(
    sessionId: string,
    patch: Partial<PatientData>,
    activeField: PatientField | null,
  ): SessionState;
  setActiveField(sessionId: string, field: PatientField | null): SessionState;
  touch(sessionId: string): SessionState;
  markSubmitted(sessionId: string, data: PatientData): SessionState;
  /** Re-derives status for every session; returns the ones that changed. */
  refreshStatuses(now?: number): SessionState[];
  /** Drops sessions past their TTL; returns the removed ids. */
  sweepExpired(now?: number): string[];
}

function blankSession(sessionId: string, now: number): SessionState {
  return {
    sessionId,
    data: {},
    activeField: null,
    completedFields: 0,
    requiredFields: REQUIRED_FIELDS.length,
    status: 'filling',
    startedAt: now,
    lastActivityAt: now,
    submittedAt: null,
  };
}

export function createMemoryStore(): SessionStore {
  const sessions = new Map<string, SessionState>();

  function ensure(sessionId: string): SessionState {
    const existing = sessions.get(sessionId);
    if (existing) return existing;
    const created = blankSession(sessionId, Date.now());
    sessions.set(sessionId, created);
    return created;
  }

  function touch(sessionId: string): SessionState {
    const session = ensure(sessionId);
    if (session.submittedAt === null) {
      session.lastActivityAt = Date.now();
      session.status = deriveStatus(session);
    }
    return session;
  }

  return {
    get: (sessionId) => sessions.get(sessionId),
    all: () => [...sessions.values()],
    ensure,
    touch,

    applyPatch(sessionId, patch, activeField) {
      const session = ensure(sessionId);
      // Submitted is terminal: late-arriving patches must not reopen a session.
      if (session.submittedAt !== null) return session;
      session.data = { ...session.data, ...patch };
      session.activeField = activeField;
      session.completedFields = countCompletedRequired(session.data);
      session.lastActivityAt = Date.now();
      session.status = deriveStatus(session);
      return session;
    },

    setActiveField(sessionId, field) {
      const session = ensure(sessionId);
      if (session.submittedAt !== null) return session;
      session.activeField = field;
      session.lastActivityAt = Date.now();
      session.status = deriveStatus(session);
      return session;
    },

    markSubmitted(sessionId, data) {
      const session = ensure(sessionId);
      session.data = { ...session.data, ...data };
      session.activeField = null;
      session.completedFields = countCompletedRequired(session.data);
      session.submittedAt = Date.now();
      session.lastActivityAt = session.submittedAt;
      session.status = 'submitted';
      return session;
    },

    refreshStatuses(now = Date.now()) {
      const changed: SessionState[] = [];
      for (const session of sessions.values()) {
        const next = deriveStatus(session, now);
        if (next !== session.status) {
          session.status = next;
          if (next === 'inactive' || next === 'idle') session.activeField = null;
          changed.push(session);
        }
      }
      return changed;
    },

    sweepExpired(now = Date.now()) {
      const removed: string[] = [];
      for (const [sessionId, session] of sessions) {
        if (now - session.lastActivityAt > SESSION_TTL_MS) {
          sessions.delete(sessionId);
          removed.push(sessionId);
        }
      }
      return removed;
    },
  };
}
