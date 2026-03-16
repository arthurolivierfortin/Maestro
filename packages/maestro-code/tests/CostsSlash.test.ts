import { describe, it, expect } from 'vitest';
import { parseCostsCommand } from '../App.ts';

describe('parseCostsCommand', () => {
  it("'/costs' returns { action: 'summary' }", () => {
    expect(parseCostsCommand('/costs')).toEqual({ action: 'summary' });
  });

  it("'/costs summary' returns { action: 'summary' }", () => {
    expect(parseCostsCommand('/costs summary')).toEqual({ action: 'summary' });
  });

  it("'/costs limits' returns { action: 'limits' }", () => {
    expect(parseCostsCommand('/costs limits')).toEqual({ action: 'limits' });
  });

  it("'/costs set --per-day 5.00' returns set with perDay", () => {
    expect(parseCostsCommand('/costs set --per-day 5.00')).toEqual({
      action: 'set',
      limits: { perDay: 5.0 },
    });
  });

  it("'/costs set --per-session 1 --per-day 5 --per-month 50' returns 3 limits", () => {
    expect(parseCostsCommand('/costs set --per-session 1 --per-day 5 --per-month 50')).toEqual({
      action: 'set',
      limits: { perSession: 1, perDay: 5, perMonth: 50 },
    });
  });

  it("'/costs clear' returns { action: 'clear' }", () => {
    expect(parseCostsCommand('/costs clear')).toEqual({ action: 'clear' });
  });

  it("'/costs set' with no flags returns null", () => {
    expect(parseCostsCommand('/costs set')).toBeNull();
  });

  it("'/costs invalid' returns null", () => {
    expect(parseCostsCommand('/costs invalid')).toBeNull();
  });

  it("'/cost' (no 's') returns null", () => {
    expect(parseCostsCommand('/cost')).toBeNull();
  });

  // ═══ Phase 59-PRE-2-T: enforcement & auto-resume tests (#34-40) ═══

  // #34 — enforcement block
  it("'/costs set --per-day 5 --enforcement block' returns enforcement block", () => {
    expect(parseCostsCommand('/costs set --per-day 5 --enforcement block')).toEqual({
      action: 'set',
      limits: { perDay: 5 },
      enforcement: 'block',
    });
  });

  // #35 — enforcement warn
  it("'/costs set --per-day 5 --enforcement warn' returns enforcement warn", () => {
    expect(parseCostsCommand('/costs set --per-day 5 --enforcement warn')).toEqual({
      action: 'set',
      limits: { perDay: 5 },
      enforcement: 'warn',
    });
  });

  // #36 — default enforcement (not specified)
  it("'/costs set --per-day 5' without --enforcement has no enforcement field", () => {
    const result = parseCostsCommand('/costs set --per-day 5');
    expect(result).not.toBeNull();
    expect(result!.action).toBe('set');
    expect(result!.limits).toEqual({ perDay: 5 });
    expect(result!.enforcement).toBeUndefined();
  });

  // #37 — auto-resume flag
  it("'/costs set --per-day 5 --auto-resume' returns autoResume true", () => {
    expect(parseCostsCommand('/costs set --per-day 5 --auto-resume')).toEqual({
      action: 'set',
      limits: { perDay: 5 },
      autoResume: true,
    });
  });

  // #38 — enforcement + auto-resume together
  it("'/costs set --per-day 5 --enforcement warn --auto-resume' returns both flags", () => {
    expect(parseCostsCommand('/costs set --per-day 5 --enforcement warn --auto-resume')).toEqual({
      action: 'set',
      limits: { perDay: 5 },
      enforcement: 'warn',
      autoResume: true,
    });
  });

  // #39 — invalid enforcement value
  it("'/costs set --per-day 5 --enforcement invalid' returns null", () => {
    expect(parseCostsCommand('/costs set --per-day 5 --enforcement invalid')).toBeNull();
  });

  // #40 — /costs status
  it("'/costs status' returns { action: 'status' }", () => {
    expect(parseCostsCommand('/costs status')).toEqual({ action: 'status' });
  });
});
