import { describe, it, expect } from 'vitest';
import {
  sessionStatusGroup,
  canStart,
  canStop,
  canPause,
  canResume,
  statusColorClass,
  type SessionStatusGroup,
} from '../sessionStatus';

// The 11 statuses observed live on the backend (:5000) plus `cancelled`
// (canonical, not in the current data snapshot) and `active` (frontend-legacy,
// never emitted by the backend but encoded in existing component tests).
const groupCases: Array<[string, SessionStatusGroup]> = [
  ['running', 'active'],
  ['idle', 'idle'],
  ['paused', 'paused'],
  ['created', 'pending'],
  ['pending', 'pending'],
  ['new', 'pending'],
  ['completed', 'done'],
  ['done', 'done'],
  ['stopped', 'done'],
  ['cancelled', 'done'],
  ['failed', 'error'],
  ['error', 'error'],
  ['updated', 'neutral'],
  ['active', 'active'],
];

describe('sessionStatusGroup', () => {
  it.each(groupCases)('maps %s to group %s', (status, group) => {
    expect(sessionStatusGroup(status)).toBe(group);
  });

  it('returns neutral for unknown and empty statuses', () => {
    expect(sessionStatusGroup('something-new')).toBe('neutral');
    expect(sessionStatusGroup('')).toBe('neutral');
  });

  it('is case-insensitive', () => {
    expect(sessionStatusGroup('RUNNING')).toBe('active');
    expect(sessionStatusGroup('Idle')).toBe('idle');
  });
});

describe('canStart / canStop', () => {
  // [status, canStart, canStop]
  const cases: Array<[string, boolean, boolean]> = [
    ['running', false, true],
    ['active', false, true],
    ['idle', true, true], // only status where both are true
    ['paused', false, true],
    ['created', true, false],
    ['new', true, false],
    ['pending', false, true],
    ['completed', true, false],
    ['done', true, false],
    ['stopped', true, false],
    ['cancelled', true, false],
    ['failed', true, false],
    ['error', true, false],
    ['updated', false, false], // ambiguous artefact — fail safe
    ['something-new', false, false], // unknown — fail safe
  ];

  it.each(cases)('%s -> canStart=%s canStop=%s', (status, start, stop) => {
    expect(canStart(status)).toBe(start);
    expect(canStop(status)).toBe(stop);
  });

  it('idle is the only status where both canStart and canStop are true', () => {
    const both = cases.filter(([, s, st]) => s && st).map(([status]) => status);
    expect(both).toEqual(['idle']);
  });
});

describe('canPause / canResume', () => {
  it('canPause is true only for running and active', () => {
    expect(canPause('running')).toBe(true);
    expect(canPause('active')).toBe(true);
    expect(canPause('idle')).toBe(false);
    expect(canPause('paused')).toBe(false);
    expect(canPause('created')).toBe(false);
  });

  it('canResume is true only for paused', () => {
    expect(canResume('paused')).toBe(true);
    expect(canResume('running')).toBe(false);
    expect(canResume('active')).toBe(false);
    expect(canResume('idle')).toBe(false);
  });
});

describe('statusColorClass', () => {
  const cases: Array<[string, string]> = [
    ['running', 'cok'],
    ['active', 'cok'],
    ['idle', 'cok'],
    ['created', 'ca'],
    ['new', 'ca'],
    ['pending', 'cwarn'],
    ['paused', 'cwarn'],
    ['completed', 'c3'],
    ['done', 'c3'],
    ['stopped', 'c3'],
    ['cancelled', 'c3'],
    ['failed', 'cerr'],
    ['error', 'cerr'],
    ['updated', 'c2'],
    ['something-new', 'c2'],
  ];

  it.each(cases)('%s -> %s', (status, cls) => {
    expect(statusColorClass(status)).toBe(cls);
  });
});
