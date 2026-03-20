/**
 * Tests for FocusProvider, useManagedInput, and useKeyboard focus integration.
 *
 * Phase 63-A: Priority-based focus layer system.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, useEffect, useState } from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Box, Text } from 'ink';
import { FocusProvider, useFocusContext } from '../hooks/useFocusProvider.ts';
import type { FocusLayer } from '../hooks/useFocusProvider.ts';
import { useManagedInput } from '../hooks/useManagedInput.ts';
import { useKeyboard } from '../hooks/useKeyboard.ts';

// ── Helpers ─────────────────────────────────────────────────────

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

/**
 * Test component that displays isActive status for all layers.
 * Optionally claims/releases layers via props.
 */
interface FocusStatusProps {
  claimLayers?: FocusLayer[];
}

const FocusStatus = ({ claimLayers }: FocusStatusProps) => {
  const { claim, release, isActive, activeLayer } = useFocusContext();

  useEffect(() => {
    if (claimLayers) {
      for (const layer of claimLayers) {
        claim(layer);
      }
    }
    return () => {
      if (claimLayers) {
        for (const layer of claimLayers) {
          release(layer);
        }
      }
    };
  }, [claimLayers?.join(',')]);

  const layers: FocusLayer[] = ['page', 'input', 'widget', 'modal'];
  return h(Box, { flexDirection: 'column' },
    ...layers.map(layer =>
      h(Text, { key: layer }, `${layer}:${isActive(layer) ? 'active' : 'blocked'}`)
    ),
    h(Text, { key: 'activeLayer' }, `activeLayer:${activeLayer || 'none'}`),
  );
};

// ── FocusProvider claim/release tests ───────────────────────────

describe('FocusProvider', () => {
  afterEach(() => cleanup());

  it('all layers blocked when none are claimed', async () => {
    const { lastFrame } = render(
      h(FocusProvider, null,
        h(FocusStatus, { claimLayers: [] })
      )
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    // No layers claimed = none active
    expect(frame).toContain('page:blocked');
    expect(frame).toContain('input:blocked');
    expect(frame).toContain('widget:blocked');
    expect(frame).toContain('modal:blocked');
    expect(frame).toContain('activeLayer:none');
  });

  it('claiming page makes page active', async () => {
    const { lastFrame } = render(
      h(FocusProvider, null,
        h(FocusStatus, { claimLayers: ['page'] })
      )
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('page:active');
    expect(frame).toContain('input:blocked');
    expect(frame).toContain('activeLayer:page');
  });

  it('claim(modal) blocks input, widget, page', async () => {
    const { lastFrame } = render(
      h(FocusProvider, null,
        h(FocusStatus, { claimLayers: ['page', 'input', 'modal'] })
      )
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('modal:active');
    expect(frame).toContain('page:blocked');
    expect(frame).toContain('input:blocked');
    expect(frame).toContain('widget:blocked');
    expect(frame).toContain('activeLayer:modal');
  });

  it('modal blocks widget, widget blocks input, input blocks page', async () => {
    // Test full priority chain
    const { lastFrame: f1 } = render(
      h(FocusProvider, null,
        h(FocusStatus, { claimLayers: ['page', 'input'] })
      )
    );
    await delay();
    const frame1 = stripAnsi(f1() || '');
    expect(frame1).toContain('input:active');
    expect(frame1).toContain('page:blocked');
    cleanup();

    const { lastFrame: f2 } = render(
      h(FocusProvider, null,
        h(FocusStatus, { claimLayers: ['page', 'widget'] })
      )
    );
    await delay();
    const frame2 = stripAnsi(f2() || '');
    expect(frame2).toContain('widget:active');
    expect(frame2).toContain('page:blocked');
    cleanup();

    const { lastFrame: f3 } = render(
      h(FocusProvider, null,
        h(FocusStatus, { claimLayers: ['page', 'input', 'widget'] })
      )
    );
    await delay();
    const frame3 = stripAnsi(f3() || '');
    expect(frame3).toContain('widget:active');
    expect(frame3).toContain('input:blocked');
    expect(frame3).toContain('page:blocked');
  });

  it('multiple claims - highest priority wins', async () => {
    const { lastFrame } = render(
      h(FocusProvider, null,
        h(FocusStatus, { claimLayers: ['modal', 'input', 'page'] })
      )
    );
    await delay();
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('modal:active');
    expect(frame).toContain('input:blocked');
    expect(frame).toContain('page:blocked');
    expect(frame).toContain('activeLayer:modal');
  });

  it('release reactivates the next highest layer', async () => {
    // Component that claims modal then releases it
    const ClaimThenRelease = () => {
      const { claim, release, isActive, activeLayer } = useFocusContext();
      const [released, setReleased] = useState(false);

      useEffect(() => {
        claim('page');
        claim('input');
        claim('modal');
        // Release modal after a tick
        const timer = setTimeout(() => {
          release('modal');
          setReleased(true);
        }, 20);
        return () => clearTimeout(timer);
      }, []);

      return h(Box, { flexDirection: 'column' },
        h(Text, null, `page:${isActive('page') ? 'active' : 'blocked'}`),
        h(Text, null, `input:${isActive('input') ? 'active' : 'blocked'}`),
        h(Text, null, `modal:${isActive('modal') ? 'active' : 'blocked'}`),
        h(Text, null, `activeLayer:${activeLayer || 'none'}`),
        h(Text, null, `released:${released}`),
      );
    };

    const { lastFrame } = render(
      h(FocusProvider, null, h(ClaimThenRelease))
    );

    // Before release
    await delay(10);
    const frame1 = stripAnsi(lastFrame() || '');
    expect(frame1).toContain('modal:active');
    expect(frame1).toContain('input:blocked');

    // After release
    await delay(40);
    const frame2 = stripAnsi(lastFrame() || '');
    expect(frame2).toContain('released:true');
    expect(frame2).toContain('input:active');
    expect(frame2).toContain('modal:blocked');
    expect(frame2).toContain('activeLayer:input');
  });
});

// ── useManagedInput gating tests ────────────────────────────────

describe('useManagedInput', () => {
  afterEach(() => cleanup());

  it('handler fires when layer is active', async () => {
    const handler = vi.fn();
    // useManagedInput imported statically at top

    const TestComponent = () => {
      const { claim } = useFocusContext();
      useEffect(() => { claim('page'); }, []);
      useManagedInput('page', handler);
      return h(Text, null, 'test');
    };

    const { stdin } = render(
      h(FocusProvider, null, h(TestComponent))
    );
    await delay();
    stdin.write('x');
    await delay();
    expect(handler).toHaveBeenCalled();
  });

  it('handler does NOT fire when layer is blocked by higher priority', async () => {
    const pageHandler = vi.fn();
    // useManagedInput imported statically at top

    const TestComponent = () => {
      const { claim } = useFocusContext();
      useEffect(() => {
        claim('page');
        claim('modal'); // blocks page
      }, []);
      useManagedInput('page', pageHandler);
      return h(Text, null, 'test');
    };

    const { stdin } = render(
      h(FocusProvider, null, h(TestComponent))
    );
    await delay();
    stdin.write('x');
    await delay();
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it('handler respects isActive option', async () => {
    const handler = vi.fn();
    // useManagedInput imported statically at top

    const TestComponent = () => {
      const { claim } = useFocusContext();
      useEffect(() => { claim('page'); }, []);
      useManagedInput('page', handler, { isActive: false });
      return h(Text, null, 'test');
    };

    const { stdin } = render(
      h(FocusProvider, null, h(TestComponent))
    );
    await delay();
    stdin.write('x');
    await delay();
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── useKeyboard + FocusProvider integration tests ───────────────

describe('useKeyboard + FocusProvider', () => {
  afterEach(() => cleanup());

  it('useKeyboard handler fires on page layer when no higher layer is active', async () => {
    const handler = vi.fn();
    // useKeyboard imported statically at top

    const TestComponent = () => {
      const { claim } = useFocusContext();
      useEffect(() => { claim('page'); }, []);
      useKeyboard({ q: handler });
      return h(Text, null, 'test');
    };

    const { stdin } = render(
      h(FocusProvider, null, h(TestComponent))
    );
    await delay();
    stdin.write('q');
    await delay();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('useKeyboard handler is blocked when modal layer is active', async () => {
    const handler = vi.fn();
    // useKeyboard imported statically at top

    const TestComponent = () => {
      const { claim } = useFocusContext();
      useEffect(() => {
        claim('page');
        claim('modal');
      }, []);
      useKeyboard({ q: handler }); // default layer = 'page'
      return h(Text, null, 'test');
    };

    const { stdin } = render(
      h(FocusProvider, null, h(TestComponent))
    );
    await delay(200);
    stdin.write('q');
    await delay(100);
    expect(handler).not.toHaveBeenCalled();
  });

  it('useKeyboard with custom layer works correctly', async () => {
    const handler = vi.fn();
    // useKeyboard imported statically at top

    const TestComponent = () => {
      const { claim } = useFocusContext();
      useEffect(() => {
        claim('page');
        claim('input');
      }, []);
      useKeyboard({ q: handler }, { layer: 'input' }); // input layer = active
      return h(Text, null, 'test');
    };

    const { stdin } = render(
      h(FocusProvider, null, h(TestComponent))
    );
    await delay();
    stdin.write('q');
    await delay();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('useKeyboard works without FocusProvider (permissive default)', async () => {
    const handler = vi.fn();
    // useKeyboard imported statically at top

    const TestComponent = () => {
      useKeyboard({ q: handler });
      return h(Text, null, 'test');
    };

    // No FocusProvider wrapper — should still work via DEFAULT_CONTEXT
    const { stdin } = render(h(TestComponent));
    await delay();
    stdin.write('q');
    await delay();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ── Default context (no provider) tests ─────────────────────────

describe('useFocusContext without provider', () => {
  afterEach(() => cleanup());

  it('returns permissive defaults when no FocusProvider is present', async () => {
    const results: boolean[] = [];

    const TestComponent = () => {
      const { isActive, activeLayer } = useFocusContext();
      results.push(
        isActive('page'),
        isActive('input'),
        isActive('modal'),
      );
      return h(Text, null, `activeLayer:${activeLayer || 'none'}`);
    };

    const { lastFrame } = render(h(TestComponent));
    await delay();
    // All layers return true without a provider
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(true);
    expect(results[2]).toBe(true);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('activeLayer:none');
  });
});
