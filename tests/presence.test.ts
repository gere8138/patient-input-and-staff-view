import { describe, expect, it } from 'vitest';
import {
  compareByStatus,
  deriveStatus,
  IDLE_AFTER_MS,
  INACTIVE_AFTER_MS,
  relativeTime,
} from '@/lib/presence';

const NOW = 1_700_000_000_000;

describe('deriveStatus', () => {
  it('is filling while activity is recent', () => {
    expect(deriveStatus({ lastActivityAt: NOW - 1_000, submittedAt: null }, NOW)).toBe('filling');
  });

  it('crosses to idle exactly at the threshold', () => {
    expect(deriveStatus({ lastActivityAt: NOW - IDLE_AFTER_MS + 1, submittedAt: null }, NOW)).toBe('filling');
    expect(deriveStatus({ lastActivityAt: NOW - IDLE_AFTER_MS, submittedAt: null }, NOW)).toBe('idle');
  });

  it('crosses to inactive exactly at the threshold', () => {
    expect(deriveStatus({ lastActivityAt: NOW - INACTIVE_AFTER_MS + 1, submittedAt: null }, NOW)).toBe('idle');
    expect(deriveStatus({ lastActivityAt: NOW - INACTIVE_AFTER_MS, submittedAt: null }, NOW)).toBe('inactive');
  });

  it('treats submitted as terminal no matter how stale the session is', () => {
    expect(deriveStatus({ lastActivityAt: NOW - 10 * INACTIVE_AFTER_MS, submittedAt: NOW - 1 }, NOW)).toBe(
      'submitted',
    );
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
