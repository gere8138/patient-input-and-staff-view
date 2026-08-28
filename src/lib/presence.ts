export type PresenceStatus = 'filling' | 'idle' | 'inactive' | 'submitted';

/** No typing, focus or field change for this long and the patient has paused. */
export const IDLE_AFTER_MS = 15_000;
/** Sessions are swept from the store this long after their last activity. */
export const SESSION_TTL_MS = 30 * 60_000;
/** How often the server re-derives status for every live session. */
export const SWEEP_INTERVAL_MS = 5_000;

export interface PresenceInput {
  /** Last real input — typing or moving between fields. Heartbeats do not count. */
  lastActivityAt: number;
  submittedAt: number | null;
  /** Whether the patient still has the form open. */
  connected: boolean;
}

/**
 * Pure status derivation. Both the sweep and every inbound event go through
 * this, so the list view and the detail view can never disagree.
 *
 * The three live states answer three different questions:
 *   filling  — typing right now
 *   paused   — form still open, but nothing entered for 15 seconds
 *   inactive — the tab is gone and the form was never submitted
 */
export function deriveStatus(input: PresenceInput, now: number = Date.now()): PresenceStatus {
  if (input.submittedAt !== null) return 'submitted';
  if (!input.connected) return 'inactive';
  return now - input.lastActivityAt >= IDLE_AFTER_MS ? 'idle' : 'filling';
}

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  filling: 'Actively filling',
  idle: 'Paused',
  inactive: 'Inactive',
  submitted: 'Submitted',
};

const STATUS_RANK: Record<PresenceStatus, number> = {
  filling: 0,
  idle: 1,
  submitted: 2,
  inactive: 3,
};

/** Sort order for the staff list: whoever needs attention first. */
export function compareByStatus(
  a: { status: PresenceStatus; lastActivityAt: number },
  b: { status: PresenceStatus; lastActivityAt: number },
): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  return b.lastActivityAt - a.lastActivityAt;
}

export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
