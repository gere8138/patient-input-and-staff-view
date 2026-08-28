import type { PatientData, PatientField } from '../schema';
import type { PresenceStatus } from '../presence';

export const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || '/api/socket';

export const STAFF_LOBBY = 'staff:lobby';
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;

export interface SessionState {
  sessionId: string;
  data: Partial<PatientData>;
  activeField: PatientField | null;
  completedFields: number;
  requiredFields: number;
  status: PresenceStatus;
  /** Whether a patient tab still has this form open. */
  connected: boolean;
  startedAt: number;
  lastActivityAt: number;
  submittedAt: number | null;
}

export interface SessionPatch {
  sessionId: string;
  patch: Partial<PatientData>;
  activeField: PatientField | null;
  completedFields: number;
  status: PresenceStatus;
  lastActivityAt: number;
  submittedAt: number | null;
}

export interface SubmitResult {
  ok: boolean;
  errors?: Record<string, string>;
  reference?: string;
}

/** Server → client. */
export interface ServerToClientEvents {
  'session:list': (sessions: SessionState[]) => void;
  'session:state': (session: SessionState) => void;
  'session:patch': (patch: SessionPatch) => void;
  'session:status': (payload: {
    sessionId: string;
    status: PresenceStatus;
    lastActivityAt: number;
    connected: boolean;
  }) => void;
  'session:removed': (payload: { sessionId: string }) => void;
}

/** Client → server. */
export interface ClientToServerEvents {
  'session:join': (payload: { sessionId: string }, ack?: (state: SessionState) => void) => void;
  'staff:join': (payload: Record<string, never>, ack?: (sessions: SessionState[]) => void) => void;
  'staff:watch': (payload: { sessionId: string }, ack?: (state: SessionState | null) => void) => void;
  'form:update': (payload: {
    sessionId: string;
    patch: Partial<PatientData>;
    activeField: PatientField | null;
  }) => void;
  'form:focus': (payload: { sessionId: string; field: PatientField | null }) => void;
  'form:submit': (payload: { sessionId: string; data: unknown }, ack?: (result: SubmitResult) => void) => void;
  /** Staff clearing away an abandoned session. Only inactive ones are removed. */
  'staff:delete': (payload: { sessionId: string }, ack?: (result: { ok: boolean }) => void) => void;
}

export function newSessionId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(8))
      : Uint8Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

const SESSION_ID_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

/** Names the session in the staff list before the name fields are filled in. */
export function sessionDisplayName(session: Pick<SessionState, 'data'>): string {
  const first = session.data.firstName?.trim() ?? '';
  const last = session.data.lastName?.trim() ?? '';
  const name = [first, last].filter(Boolean).join(' ');
  return name || 'Unnamed patient';
}
