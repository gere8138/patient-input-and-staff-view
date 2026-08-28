import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@/lib/realtime/store';
import { IDLE_AFTER_MS } from '@/lib/presence';
import type { PatientData } from '@/lib/schema';

const SESSION = 'ABCD-2345';

const complete: PatientData = {
  firstName: 'Somchai',
  middleName: '',
  lastName: 'Wongsawat',
  dateOfBirth: '1988-04-12',
  gender: 'male',
  phoneCountry: 'TH',
  phone: '0812345678',
  email: 'somchai@example.com',
  address: '221 Sukhumvit Road, Khlong Toei, Bangkok 10110',
  preferredLanguage: 'thai',
  nationality: 'TH',
  emergencyContactPhoneCountry: 'TH',
  emergencyContactPhone: '0899876543',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  religion: '',
};

describe('connection tracking', () => {
  it('starts inactive and becomes filling when a tab opens it', () => {
    const store = createMemoryStore();
    expect(store.ensure(SESSION).status).toBe('inactive');
    expect(store.attachSocket(SESSION, 'socket-1').status).toBe('filling');
  });

  it('goes inactive when the last tab closes', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    const [changed] = store.detachSocket('socket-1');
    expect(changed.status).toBe('inactive');
    expect(changed.connected).toBe(false);
  });

  it('stays open while a second tab of the same session is still there', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    store.attachSocket(SESSION, 'socket-2');
    expect(store.detachSocket('socket-1')).toHaveLength(0);
    expect(store.get(SESSION)?.status).toBe('filling');
    expect(store.detachSocket('socket-2')[0].status).toBe('inactive');
  });

  it('ignores a socket that never joined', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    expect(store.detachSocket('a-staff-socket')).toHaveLength(0);
    expect(store.get(SESSION)?.status).toBe('filling');
  });

  it('pauses an open form after 15 seconds without input, and never sooner', () => {
    const store = createMemoryStore();
    const session = store.attachSocket(SESSION, 'socket-1');
    session.lastActivityAt = Date.now() - IDLE_AFTER_MS + 2_000;
    expect(store.refreshStatuses()).toHaveLength(0);

    session.lastActivityAt = Date.now() - IDLE_AFTER_MS;
    expect(store.refreshStatuses()[0].status).toBe('idle');
  });

  it('returns to filling as soon as the patient types again', () => {
    const store = createMemoryStore();
    const session = store.attachSocket(SESSION, 'socket-1');
    session.lastActivityAt = Date.now() - IDLE_AFTER_MS;
    store.refreshStatuses();
    expect(store.get(SESSION)?.status).toBe('idle');
    expect(store.applyPatch(SESSION, { firstName: 'Somchai' }, 'firstName').status).toBe('filling');
  });
});

describe('staff deletion', () => {
  it('removes an inactive session', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    store.detachSocket('socket-1');
    expect(store.remove(SESSION)).toBe(true);
    expect(store.get(SESSION)).toBeUndefined();
  });

  it('refuses to remove a session that is still being filled in', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    expect(store.remove(SESSION)).toBe(false);
    expect(store.get(SESSION)).toBeDefined();
  });

  it('refuses to remove a paused session, since the patient still has it open', () => {
    const store = createMemoryStore();
    const session = store.attachSocket(SESSION, 'socket-1');
    session.lastActivityAt = Date.now() - IDLE_AFTER_MS;
    store.refreshStatuses();
    expect(store.get(SESSION)?.status).toBe('idle');
    expect(store.remove(SESSION)).toBe(false);
  });

  it('refuses to remove a submitted session', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    store.markSubmitted(SESSION, complete);
    store.detachSocket('socket-1');
    expect(store.get(SESSION)?.status).toBe('submitted');
    expect(store.remove(SESSION)).toBe(false);
  });

  it('refuses an unknown session id', () => {
    expect(createMemoryStore().remove('ZZZZ-9999')).toBe(false);
  });
});

describe('submitted sessions', () => {
  it('stay submitted after the tab closes', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    store.markSubmitted(SESSION, complete);
    store.detachSocket('socket-1');
    expect(store.get(SESSION)?.status).toBe('submitted');
  });

  it('count every required field once complete', () => {
    const store = createMemoryStore();
    store.attachSocket(SESSION, 'socket-1');
    const session = store.markSubmitted(SESSION, complete);
    expect(session.completedFields).toBe(session.requiredFields);
  });
});
