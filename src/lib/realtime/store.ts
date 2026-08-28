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
  markSubmitted(sessionId: string, data: PatientData): SessionState;
  /** Records that a patient tab has the form open. */
  attachSocket(sessionId: string, socketId: string): SessionState;
  /** Drops a closed tab; returns the sessions whose connection state changed. */
  detachSocket(socketId: string): SessionState[];
  /** Staff removing an abandoned session. Returns false if it was not allowed. */
  remove(sessionId: string): boolean;
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
    status: 'inactive',
    connected: false,
    startedAt: now,
    lastActivityAt: now,
    submittedAt: null,
  };
}

export function createMemoryStore(): SessionStore {
  const sessions = new Map<string, SessionState>();
  /** Which patient tabs currently hold each session open. */
  const openTabs = new Map<string, Set<string>>();

  function ensure(sessionId: string): SessionState {
    const existing = sessions.get(sessionId);
    if (existing) return existing;
    const created = blankSession(sessionId, Date.now());
    sessions.set(sessionId, created);
    return created;
  }

  /** Any real input: typing, changing a field, moving the caret. */
  function registerActivity(session: SessionState): SessionState {
    if (session.submittedAt !== null) return session;
    session.lastActivityAt = Date.now();
    session.status = deriveStatus(session);
    return session;
  }

  return {
    get: (sessionId) => sessions.get(sessionId),
    all: () => [...sessions.values()],
    ensure,

    attachSocket(sessionId, socketId) {
      const session = ensure(sessionId);
      const tabs = openTabs.get(sessionId) ?? new Set<string>();
      tabs.add(socketId);
      openTabs.set(sessionId, tabs);
      session.connected = true;
      session.status = deriveStatus(session);
      return session;
    },

    detachSocket(socketId) {
      const changed: SessionState[] = [];
      for (const [sessionId, tabs] of openTabs) {
        if (!tabs.delete(socketId)) continue;
        if (tabs.size === 0) openTabs.delete(sessionId);
        const session = sessions.get(sessionId);
        if (!session) continue;
        // Another tab of the same session may still be open.
        const connected = tabs.size > 0;
        if (connected === session.connected) continue;
        session.connected = connected;
        const next = deriveStatus(session);
        if (next !== session.status) {
          session.status = next;
          if (next === 'inactive') session.activeField = null;
        }
        changed.push(session);
      }
      return changed;
    },

    applyPatch(sessionId, patch, activeField) {
      const session = ensure(sessionId);
      // Submitted is terminal: late-arriving patches must not reopen a session.
      if (session.submittedAt !== null) return session;
      session.data = { ...session.data, ...patch };
      session.activeField = activeField;
      session.completedFields = countCompletedRequired(session.data);
      return registerActivity(session);
    },

    setActiveField(sessionId, field) {
      const session = ensure(sessionId);
      if (session.submittedAt !== null) return session;
      session.activeField = field;
      return registerActivity(session);
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

    remove(sessionId) {
      // Staff can only clear away abandoned forms, never a live or completed one.
      const session = sessions.get(sessionId);
      if (!session || session.status !== 'inactive') return false;
      sessions.delete(sessionId);
      openTabs.delete(sessionId);
      return true;
    },

    refreshStatuses(now = Date.now()) {
      const changed: SessionState[] = [];
      for (const session of sessions.values()) {
        const next = deriveStatus(session, now);
        if (next !== session.status) {
          session.status = next;
          if (next !== 'filling') session.activeField = null;
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
          openTabs.delete(sessionId);
          removed.push(sessionId);
        }
      }
      return removed;
    },
  };
}
