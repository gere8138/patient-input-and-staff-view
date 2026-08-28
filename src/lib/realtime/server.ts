import type { Server as SocketServer, Socket } from 'socket.io';
import { SWEEP_INTERVAL_MS } from '../presence';
import { fieldErrors, patientSchema } from '../schema';
import type { PatientField } from '../schema';
import { FIELD_BY_KEY } from '../fields';
import {
  STAFF_LOBBY,
  isValidSessionId,
  sessionRoom,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SessionPatch,
  type SessionState,
} from './events';
import { createMemoryStore, type SessionStore } from './store';

type IO = SocketServer<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function toPatchEvent(session: SessionState, patch: SessionState['data']): SessionPatch {
  return {
    sessionId: session.sessionId,
    patch,
    activeField: session.activeField,
    completedFields: session.completedFields,
    status: session.status,
    lastActivityAt: session.lastActivityAt,
    submittedAt: session.submittedAt,
  };
}

/** Keeps unknown keys and non-string values out of the shared session state. */
function sanitisePatch(raw: unknown): SessionState['data'] {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in FIELD_BY_KEY)) continue;
    if (typeof value !== 'string') continue;
    out[key] = value.slice(0, 300);
  }
  return out as SessionState['data'];
}

function asField(value: unknown): PatientField | null {
  return typeof value === 'string' && value in FIELD_BY_KEY ? (value as PatientField) : null;
}

export function attachRealtime(io: IO, store: SessionStore = createMemoryStore()): SessionStore {
  const broadcastPatch = (session: SessionState, patch: SessionState['data']) => {
    const event = toPatchEvent(session, patch);
    io.to(STAFF_LOBBY).emit('session:patch', event);
    io.to(sessionRoom(session.sessionId)).emit('session:patch', event);
  };

  const broadcastStatus = (session: SessionState) => {
    const payload = {
      sessionId: session.sessionId,
      status: session.status,
      lastActivityAt: session.lastActivityAt,
      connected: session.connected,
    };
    io.to(STAFF_LOBBY).emit('session:status', payload);
    io.to(sessionRoom(session.sessionId)).emit('session:status', payload);
  };

  io.on('connection', (socket: IOSocket) => {
    socket.on('session:join', ({ sessionId }, ack) => {
      if (!isValidSessionId(sessionId)) return;
      // Only the patient's own tab counts as holding the form open; staff
      // watching a session must never keep it out of "inactive".
      const session = store.attachSocket(sessionId, socket.id);
      socket.join(sessionRoom(sessionId));
      ack?.(session);
      io.to(STAFF_LOBBY).emit('session:patch', toPatchEvent(session, session.data));
    });

    socket.on('staff:join', (_payload, ack) => {
      socket.join(STAFF_LOBBY);
      ack?.(store.all());
      socket.emit('session:list', store.all());
    });

    socket.on('staff:watch', ({ sessionId }, ack) => {
      if (!isValidSessionId(sessionId)) return ack?.(null);
      socket.join(sessionRoom(sessionId));
      ack?.(store.get(sessionId) ?? null);
    });

    socket.on('form:update', ({ sessionId, patch, activeField }) => {
      if (!isValidSessionId(sessionId)) return;
      const clean = sanitisePatch(patch);
      const session = store.applyPatch(sessionId, clean, asField(activeField));
      broadcastPatch(session, clean);
    });

    socket.on('form:focus', ({ sessionId, field }) => {
      if (!isValidSessionId(sessionId)) return;
      const session = store.setActiveField(sessionId, asField(field));
      broadcastPatch(session, {});
    });

    socket.on('staff:delete', ({ sessionId }, ack) => {
      if (!isValidSessionId(sessionId)) {
        ack?.({ ok: false });
        return;
      }
      const removed = store.remove(sessionId);
      ack?.({ ok: removed });
      if (removed) {
        io.to(STAFF_LOBBY).emit('session:removed', { sessionId });
        io.to(sessionRoom(sessionId)).emit('session:removed', { sessionId });
      }
    });

    socket.on('disconnect', () => {
      for (const session of store.detachSocket(socket.id)) {
        broadcastStatus(session);
      }
    });

    socket.on('form:submit', ({ sessionId, data }, ack) => {
      if (!isValidSessionId(sessionId)) {
        ack?.({ ok: false, errors: { _form: 'This session has ended. Please start a new form.' } });
        return;
      }
      // The client already validated; the server does it again with the same
      // schema so a tampered or stale payload cannot land in the store.
      const parsed = patientSchema.safeParse(data);
      if (!parsed.success) {
        ack?.({ ok: false, errors: fieldErrors(parsed.error) });
        return;
      }
      const session = store.markSubmitted(sessionId, parsed.data);
      ack?.({ ok: true, reference: sessionId });
      broadcastPatch(session, session.data);
    });
  });

  const sweep = setInterval(() => {
    for (const session of store.refreshStatuses()) {
      broadcastStatus(session);
    }
    for (const sessionId of store.sweepExpired()) {
      io.to(STAFF_LOBBY).emit('session:removed', { sessionId });
      io.to(sessionRoom(sessionId)).emit('session:removed', { sessionId });
    }
  }, SWEEP_INTERVAL_MS);
  sweep.unref?.();

  return store;
}
