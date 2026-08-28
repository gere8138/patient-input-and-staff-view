'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/realtime/client';
import type { SubmitResult } from '@/lib/realtime/events';
import type { PatientData, PatientField } from '@/lib/schema';

const FLUSH_INTERVAL_MS = 250;
const PING_INTERVAL_MS = 5000;

export type ConnectionState = 'connecting' | 'live' | 'reconnecting';

interface PatientSession {
  connection: ConnectionState;
  /** Queue a changed field. Coalesced and sent at most every 250ms. */
  pushField: (field: PatientField, value: string) => void;
  /** Immediate — this drives the caret marker in the staff console. */
  setFocus: (field: PatientField | null) => void;
  submit: (data: PatientData) => Promise<SubmitResult>;
}

export function usePatientSession(
  sessionId: string,
  getValues: () => Partial<PatientData>,
): PatientSession {
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const pending = useRef<Partial<PatientData>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeField = useRef<PatientField | null>(null);
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;

  const flush = useCallback(() => {
    flushTimer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    getSocket().emit('form:update', { sessionId, patch, activeField: activeField.current });
  }, [sessionId]);

  const pushField = useCallback(
    (field: PatientField, value: string) => {
      pending.current = { ...pending.current, [field]: value };
      activeField.current = field;
      if (flushTimer.current === null) {
        flushTimer.current = setTimeout(flush, FLUSH_INTERVAL_MS);
      }
    },
    [flush],
  );

  const setFocus = useCallback(
    (field: PatientField | null) => {
      activeField.current = field;
      getSocket().emit('form:focus', { sessionId, field });
    },
    [sessionId],
  );

  const submit = useCallback(
    (data: PatientData) =>
      new Promise<SubmitResult>((resolve) => {
        if (flushTimer.current !== null) {
          clearTimeout(flushTimer.current);
          flush();
        }
        const timeout = setTimeout(
          () => resolve({ ok: false, errors: { _form: 'The server did not respond. Check your connection.' } }),
          8000,
        );
        getSocket().emit('form:submit', { sessionId, data }, (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      }),
    [sessionId, flush],
  );

  useEffect(() => {
    const socket = getSocket();

    const join = () => {
      socket.emit('session:join', { sessionId });
      // Repair the server's copy rather than leaving it stale after a drop.
      const values = getValuesRef.current();
      if (Object.keys(values).length > 0) {
        socket.emit('form:update', { sessionId, patch: values, activeField: activeField.current });
      }
    };

    const onConnect = () => {
      setConnection('live');
      join();
    };
    const onDisconnect = () => setConnection('reconnecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();
    else socket.connect();

    const ping = setInterval(() => {
      if (document.visibilityState === 'visible' && socket.connected) {
        socket.emit('presence:ping', { sessionId });
      }
    }, PING_INTERVAL_MS);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      clearInterval(ping);
      if (flushTimer.current !== null) clearTimeout(flushTimer.current);
    };
  }, [sessionId]);

  return { connection, pushField, setFocus, submit };
}
