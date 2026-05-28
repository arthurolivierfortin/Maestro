/* global React, ReactDOM, AppHeader, NavRail, AppFooter, NAV, Ic, Btn,
   PageFirstRun, PageConsole, PageWorkflow, PageSessions, PageSpaces,
   PageCatalog, PageBlock, PageBlockNew, PageFoundry, PageFoundryNew,
   PageModels, PageProviders, PageMonitor,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect */

const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "style": "paper",
  "route": "console",
  "fontSize": 13,
  "showOuter": true
}/*EDITMODE-END*/;

const STYLE_OPTIONS = [
  { value: 'paper',    label: 'Paper',       sub: 'mocha · light · original mock' },
  { value: 'tui',      label: 'TUI Dark',    sub: 'cyan · classic terminal' },
  { value: 'claude',   label: 'Claude Code', sub: 'cream · warm minimal' },
  { value: 'flipper',  label: 'Flipper Zero',sub: 'orange · CRT · monoline' },
  { value: 'phosphor', label: 'Phosphor',    sub: 'green · vt100 · glow' },
];

const PAGE_COMP = {
  'first-run': 'PageFirstRun',
  'console':   'PageConsole',
  'workflow':  'PageWorkflow',
  'spaces':    'PageSpaces',
  'sessions':  'PageSpaces',
  'catalog':   'PageFoundryNew',   // legacy alias
  'foundry':   'PageFoundryNew',   // unified
  'block':     'PageBlockNew',
  'models':    'PageModels',
  'providers': 'PageProviders',
  'monitor':   'PageMonitor',
};

/* ═══════════════════════════════════════════════════════════════
   Command palette — purely keyboard
   ═══════════════════════════════════════════════════════════════ */
const CMD_ITEMS = [
  { group: 'NAVIGATE', items: NAV.filter(n => !n.hidden).map(n => ({
      label: 'Go to ' + n.label, hint: n.kbd, ic: n.icon, action: { type: 'route', to: n.id }
    })),
  },
  { group: 'ACTIONS', items: [
    { label: 'New session',        hint: 'n',   ic: 'plus',     action: { type: 'route', to: 'spaces' } },
    { label: 'Open contract…',     hint: 'o',   ic: 'contract', action: { type: 'route', to: 'block' } },
    { label: 'Start training (foundry)', hint: 'f', ic: 'foundry', action: { type: 'route', to: 'foundry' } },
    { label: 'Publish a block',    hint: 'P',   ic: 'upload',   action: { type: 'route', to: 'catalog' } },
    { label: 'Pin widget to console', hint: 'p', ic: 'pin',     action: { type: 'route', to: 'console' } },
    { label: 'Toggle style…',      hint: 't',   ic: 'sparkle',  action: { type: 'style' } },
    { label: 'Show keyboard help', hint: '?',   ic: 'settings', action: { type: 'help' } },
  ]},
  { group: 'SETTINGS', items: [
    { label: 'Open tweaks panel',  hint: '⌘,',  ic: 'settings', action: { type: 'tweaks' } },
    { label: 'Switch tier…',       hint: 'T',   ic: 'bolt',     action: { type: 'route', to: 'first-run' } },
    { label: 'Configure providers', hint: 'V',  ic: 'plug',     action: { type: 'route', to: 'providers' } },
  ]},
];

const CommandPalette = ({ open, onClose, onAction }) => {
  const [q, setQ] = useStateA('');
  const [sel, setSel] = useStateA(0);

  // Flatten + filter
  const flat = [];
  CMD_ITEMS.forEach(g => {
    const items = g.items.filter(it =>
      it.label.toLowerCase().includes(q.toLowerCase()) ||
      it.hint.toLowerCase().includes(q.toLowerCase())
    );
    if (items.length) flat.push({ group: g.group, items });
  });
  const flatItems = flat.flatMap(g => g.items);

  useEffectA(() => { if (open) { setQ(''); setSel(0); } }, [open]);

  useEffectA(() => {
    if (!open) return;
    const fn = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flatItems.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const it = flatItems[sel];
        if (it) onAction(it.action);
        onClose();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, flatItems, sel]);

  if (!open) return null;
  return (
    <div className="cmdp-overlay" onClick={onClose}>
      <div className="cmdp" onClick={e => e.stopPropagation()}>
        <div className="cmdp-input">
          <Ic n="search" size={16} style={{ color: 'var(--accent)' }}/>
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setSel(0); }}
            placeholder="Type a command, page name, or block id…"/>
          <span className="kbd">Esc</span>
        </div>
        <div className="cmdp-list">
          {(() => {
            let idx = 0;
            return flat.map(g => (
              <React.Fragment key={g.group}>
                <div className="cmdp-group">{g.group}</div>
                {g.items.map(it => {
                  const myIdx = idx++;
                  return (
                    <div key={it.label}
                         className={'cmdp-item' + (myIdx === sel ? ' sel' : '')}
                         onClick={() => { onAction(it.action); onClose(); }}
                         onMouseEnter={() => setSel(myIdx)}>
                      <span className="ic"><Ic n={it.ic} size={14}/></span>
                      <span>{it.label}</span>
                      <span className="hint">{it.hint}</span>
                      <span className="kbd">↵</span>
                    </div>
                  );
                })}
              </React.Fragment>
            ));
          })()}
          {flatItems.length === 0 && (
            <div className="cmdp-item" style={{ color: 'var(--ink-3)' }}>No matches</div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Help overlay
   ═══════════════════════════════════════════════════════════════ */
const HelpOverlay = ({ open, onClose }) => {
  useEffectA(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open]);
  if (!open) return null;
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-card" onClick={e => e.stopPropagation()}>
        <div className="row gap-12" style={{ marginBottom: 18 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.16em' }}>MAESTRO</span>
          <span className="c-ink2">keyboard reference</span>
          <span className="flex-1"/>
          <span className="kbd">Esc</span> close
        </div>
        <div className="help-grid">
          <div>
            <div className="t-h3" style={{ marginBottom: 8 }}>GLOBAL</div>
            <div className="hk"><span className="k">⌘K</span><span className="v">Command palette</span></div>
            <div className="hk"><span className="k">?</span><span className="v">This help</span></div>
            <div className="hk"><span className="k">⌘,</span><span className="v">Tweaks (styles)</span></div>
            <div className="hk"><span className="k">/</span><span className="v">Focus input · filter</span></div>
            <div className="hk"><span className="k">Esc</span><span className="v">Close overlay · cancel</span></div>
            <div className="hk"><span className="k">q</span><span className="v">Quit</span></div>
          </div>
          <div>
            <div className="t-h3" style={{ marginBottom: 8 }}>NAVIGATE</div>
            <div className="hk"><span className="k">1 – 9</span><span className="v">Jump to nav item</span></div>
            <div className="hk"><span className="k">Tab</span><span className="v">Cycle panes</span></div>
            <div className="hk"><span className="k">⇧Tab</span><span className="v">Reverse cycle</span></div>
            <div className="hk"><span className="k">j / k</span><span className="v">Down / up in lists</span></div>
            <div className="hk"><span className="k">h / l</span><span className="v">Collapse / expand</span></div>
            <div className="hk"><span className="k">g / G</span><span className="v">Top / bottom</span></div>
          </div>
          <div>
            <div className="t-h3" style={{ marginBottom: 8 }}>WIDGETS</div>
            <div className="hk"><span className="k">Enter</span><span className="v">Open / select</span></div>
            <div className="hk"><span className="k">Space</span><span className="v">Toggle expanded</span></div>
            <div className="hk"><span className="k">p</span><span className="v">Pin to console</span></div>
            <div className="hk"><span className="k">x</span><span className="v">Dismiss / unpin</span></div>
            <div className="hk"><span className="k">d</span><span className="v">Delete</span></div>
            <div className="hk"><span className="k">r</span><span className="v">Retry / refresh</span></div>
          </div>
          <div>
            <div className="t-h3" style={{ marginBottom: 8 }}>SESSION</div>
            <div className="hk"><span className="k">n</span><span className="v">New session</span></div>
            <div className="hk"><span className="k">o</span><span className="v">Open contract</span></div>
            <div className="hk"><span className="k">P</span><span className="v">Publish block</span></div>
            <div className="hk"><span className="k">T</span><span className="v">Switch tier</span></div>
            <div className="hk"><span className="k">Ctrl+C</span><span className="v">Cancel current task</span></div>
            <div className="hk"><span className="k">Ctrl+L</span><span className="v">Clear console</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   App
   ═══════════════════════════════════════════════════════════════ */
const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [palette, setPalette] = useStateA(false);
  const [help, setHelp] = useStateA(false);
  const [openBlock, setOpenBlock] = useStateA(null);

  useEffectA(() => {
    document.documentElement.dataset.style = t.style;
    document.documentElement.style.setProperty('--term-fz', t.fontSize + 'px');
  }, [t.style, t.fontSize]);

  // Global keyboard
  useEffectA(() => {
    const fn = (e) => {
      // Always-on
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPalette(true); return; }
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === '?') { e.preventDefault(); setHelp(h => !h); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); openTweaks(); return; }
      // Number jump
      const it = NAV.find(n => !n.hidden && n.kbd === e.key);
      if (it) { setTweak('route', it.id); return; }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const openTweaks = () => {
    window.postMessage({ type: '__activate_edit_mode' }, '*');
  };

  const cmdAction = (a) => {
    if (a.type === 'route') setTweak('route', a.to);
    else if (a.type === 'tweaks' || a.type === 'style') openTweaks();
    else if (a.type === 'help') setHelp(true);
  };

  const onRoute = (r, payload) => {
    if (r === 'block' && payload) setOpenBlock(payload);
    setTweak('route', r);
  };
  const navItem = NAV.find(n => n.id === t.route);
  const Page = window[PAGE_COMP[t.route]] || PageConsole;

  return (
    <div className="page">
      {t.showOuter && (
        <div className="page-head">
          <div>
            <div className="title">Maestro Code</div>
            <div className="sub">
              Keyboard-first cockpit. Every action is a block. Every block fulfills a contract — measurable, optimizable, publishable.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="meta">style · <span className="c-accent b">{STYLE_OPTIONS.find(s => s.value === t.style)?.label}</span></span>
            <span className="meta">route · <span className="c-accent b">{t.route}</span></span>
          </div>
        </div>
      )}

      <div className="app-frame">
        <div className="frame-tools">
          <button className="frame-tool" onClick={() => setPalette(true)}>
            <Ic n="search" size={11}/> ⌘K
          </button>
          <button className="frame-tool" onClick={() => setHelp(true)}>? help</button>
          <button className="frame-tool" onClick={openTweaks}>
            <Ic n="sparkle" size={11}/> tweaks
          </button>
        </div>

        <AppHeader/>
        <div className="app-body">
          <NavRail route={t.route} onRoute={onRoute}/>
          <Page onRoute={onRoute} block={openBlock}/>
        </div>
        <AppFooter route={navItem?.label || t.route}
          extras={[<span><span className="kbd">⌘K</span> commands</span>, <span><span className="kbd">?</span> help</span>]}/>
      </div>

      {t.showOuter && (
        <div style={{ width: 1380, marginTop: 12, color: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
          press <span className="kbd">1</span>–<span className="kbd">9</span> nav · <span className="kbd">⌘K</span> commands · <span className="kbd">?</span> help · <span className="kbd">⌘,</span> tweaks
        </div>
      )}

      <CommandPalette open={palette} onClose={() => setPalette(false)} onAction={cmdAction}/>
      <HelpOverlay open={help} onClose={() => setHelp(false)}/>

      <TweaksPanel title="Tweaks" defaultPos={{ right: 24, bottom: 48 }}>
        <TweakSection title="Style">
          <TweakRadio label="Visual" value={t.style} onChange={v => setTweak('style', v)}
            options={STYLE_OPTIONS.map(s => ({ value: s.value, label: s.label }))}/>
          <div style={{ fontSize: 11, color: 'var(--fg-2, #888)', lineHeight: 1.5, marginTop: 4 }}>
            {STYLE_OPTIONS.find(s => s.value === t.style)?.sub}
          </div>
        </TweakSection>
        <TweakSection title="Navigation">
          <TweakSelect label="Page" value={t.route} onChange={v => setTweak('route', v)}
            options={NAV.filter(n => !n.hidden).map(n => ({ value: n.id, label: `${n.kbd} · ${n.label}` }))}/>
        </TweakSection>
        <TweakSection title="Terminal">
          <TweakRadio label="Font size" value={String(t.fontSize)} onChange={v => setTweak('fontSize', parseInt(v, 10))}
            options={[{value:'12',label:'12px'},{value:'13',label:'13px'},{value:'14',label:'14px'}]}/>
          <TweakRadio label="Outer chrome" value={t.showOuter ? 'on' : 'off'} onChange={v => setTweak('showOuter', v === 'on')}
            options={[{value:'on',label:'On'},{value:'off',label:'Off'}]}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
