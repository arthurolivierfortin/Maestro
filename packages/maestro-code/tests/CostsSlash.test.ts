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
});
