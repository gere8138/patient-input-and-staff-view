import { describe, expect, it } from 'vitest';
import { compareByStatus, deriveStatus, IDLE_AFTER_MS, relativeTime } from '@/lib/presence';

const NOW = 1_700_000_000_000;

const open = (lastActivityAt: number) => ({ lastActivityAt, submittedAt: null, connected: true });
const closed = (lastActivityAt: number) => ({ lastActivityAt, submittedAt: null, connected: false });

describe('deriveStatus', () => {
  it('is filling while the patient is still entering things', () => {
    expect(deriveStatus(open(NOW - 1_000), NOW)).toBe('filling');
  });

  it('pauses after exactly 15 seconds without input', () => {
    expect(deriveStatus(open(NOW - IDLE_AFTER_MS + 1), NOW)).toBe('filling');
    expect(deriveStatus(open(NOW - IDLE_AFTER_MS), NOW)).toBe('idle');
  });

  it('stays paused, not inactive, however long the form sits open', () => {
    expect(deriveStatus(open(NOW - 60 * 60_000), NOW)).toBe('idle');
  });

  it('is inactive once the tab is gone and nothing was submitted', () => {
    expect(deriveStatus(closed(NOW - 1_000), NOW)).toBe('inactive');
    expect(deriveStatus(closed(NOW), NOW)).toBe('inactive');
  });

  it('treats submitted as terminal, open tab or not', () => {
    expect(deriveStatus({ lastActivityAt: NOW, submittedAt: NOW, connected: true }, NOW)).toBe('submitted');
    expect(
      deriveStatus({ lastActivityAt: NOW - 10 * 60_000, submittedAt: NOW - 1, connected: false }, NOW),
    ).toBe('submitted');
  });
});

describe('compareByStatus', () => {
  it('puts the patients who need attention first', () => {
    const sessions = [
      { status: 'inactive' as const, lastActivityAt: 5 },
      { status: 'submitted' as const, lastActivityAt: 4 },
      { status: 'filling' as const, lastActivityAt: 3 },
      { status: 'idle' as const, lastActivityAt: 2 },
    ];
    expect([...sessions].sort(compareByStatus).map((s) => s.status)).toEqual([
      'filling',
      'idle',
      'submitted',
      'inactive',
    ]);
  });

  it('breaks ties with the most recent activity', () => {
    const older = { status: 'filling' as const, lastActivityAt: 1 };
    const newer = { status: 'filling' as const, lastActivityAt: 2 };
    expect([older, newer].sort(compareByStatus)[0]).toBe(newer);
  });
});

describe('relativeTime', () => {
  it('reads naturally at each scale', () => {
    expect(relativeTime(NOW - 1_000, NOW)).toBe('just now');
    expect(relativeTime(NOW - 30_000, NOW)).toBe('30s ago');
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5m ago');
    expect(relativeTime(NOW - 2 * 3_600_000, NOW)).toBe('2h ago');
  });
});
