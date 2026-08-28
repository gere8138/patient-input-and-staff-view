'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/realtime/client';
import type { PresenceStatus } from '@/lib/presence';
import type { SessionPatch, SessionState } from '@/lib/realtime/events';
import { compareByStatus } from '@/lib/presence';
import { REQUIRED_FIELDS } from '@/lib/fields';

export type StaffConnection = 'connecting' | 'live' | 'reconnecting';

interface StaffSessions {
  sessions: SessionState[];
  byId: Record<string, SessionState>;
  connection: StaffConnection;
  lastUpdateAt: number | null;
  /** Clears away an abandoned session. The server refuses anything not inactive. */
  deleteSession: (sessionId: string) => void;
}

export function useStaffSessions(): StaffSessions {
  const [byId, setById] = useState<Record<string, SessionState>>({});
  const [connection, setConnection] = useState<StaffConnection>('connecting');
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  // Re-sorts the list as sessions cross idle/inactive thresholds even when the
  // server has nothing new to say.
  const [, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const socket = getSocket();

    const onConnect = () => {
      setConnection('live');
      socket.emit('staff:join', {});
    };
    const onDisconnect = () => setConnection('reconnecting');

    const onList = (list: SessionState[]) => {
      setById(Object.fromEntries(list.map((session) => [session.sessionId, session])));
      setLastUpdateAt(Date.now());
    };

    const onPatch = (event: SessionPatch) => {
      setById((current) => {
        const existing = current[event.sessionId];
        const base: SessionState = existing ?? {
          sessionId: event.sessionId,
          data: {},
          activeField: null,
          completedFields: 0,
          requiredFields: REQUIRED_FIELDS.length,
          status: event.status,
          connected: true,
          startedAt: event.lastActivityAt,
          lastActivityAt: event.lastActivityAt,
          submittedAt: event.submittedAt,
        };
        return {
          ...current,
          [event.sessionId]: {
            ...base,
            data: { ...base.data, ...event.patch },
            activeField: event.activeField,
            completedFields: event.completedFields,
            status: event.status,
            lastActivityAt: event.lastActivityAt,
            submittedAt: event.submittedAt,
          },
        };
      });
      setLastUpdateAt(Date.now());
    };

    const onStatus = ({
      sessionId,
      status,
      lastActivityAt,
      connected,
    }: {
      sessionId: string;
      status: PresenceStatus;
      lastActivityAt: number;
      connected: boolean;
    }) => {
      setById((current) => {
        const existing = current[sessionId];
        if (!existing) return current;
        return {
          ...current,
          [sessionId]: {
            ...existing,
            status,
            lastActivityAt,
            connected,
            activeField: status === 'filling' ? existing.activeField : null,
          },
        };
      });
    };

    const onRemoved = ({ sessionId }: { sessionId: string }) => {
      setById((current) => {
        if (!(sessionId in current)) return current;
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session:list', onList);
    socket.on('session:patch', onPatch);
    socket.on('session:status', onStatus);
    socket.on('session:removed', onRemoved);

    if (socket.connected) onConnect();
    else socket.connect();

    const tick = setInterval(() => setTick((n) => n + 1), 1000);

    return () => {
      mounted.current = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session:list', onList);
      socket.off('session:patch', onPatch);
      socket.off('session:status', onStatus);
      socket.off('session:removed', onRemoved);
      clearInterval(tick);
    };
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    getSocket().emit('staff:delete', { sessionId });
  }, []);

  const sessions = Object.values(byId).sort(compareByStatus);
  return { sessions, byId, connection, lastUpdateAt, deleteSession };
}
