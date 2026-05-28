/* global React, ReactDOM, Icon, StatusDot, Badge, Button, BrandMark, Input,
   DashboardScreen, SessionScreen, CanvasScreen, FoundryScreen, CatalogScreen, ModelsScreen,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakColor, TweakToggle, TweakSlider */
const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#00d8ff",
  "theme": "dark",
  "density": "comfortable",
  "showCommandPalette": false
}/*EDITMODE-END*/;

const ACCENT_OKLCH = {
  '#00d8ff': 'oklch(0.78 0.14 220)',  // cyan (brand)
  '#a78bfa': 'oklch(0.72 0.16 295)',  // violet
  '#f5a623': 'oklch(0.82 0.14 80)',   // amber
  '#4ade80': 'oklch(0.78 0.16 150)',  // green
};

const NavItem = ({ icon, label, active, onClick, badge, kbd }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 'var(--radius)',
      color: active ? 'var(--fg-0)' : 'var(--fg-1)',
      background: active ? 'var(--bg-2)' : 'transparent',
      width: '100%', fontSize: 13, fontWeight: 500,
      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      transition: 'background 80ms',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-1)'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >
    <Icon name={icon} size={15} style={{ color: active ? 'var(--accent)' : 'var(--fg-2)' }}/>
    <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
    {badge && <Badge variant={active ? 'accent' : 'outline'} mono>{badge}</Badge>}
    {kbd && <span className="kbd">{kbd}</span>}
  </button>
);

const Sidebar = ({ route, onNavigate }) => (
  <div style={{
    width: 220, background: 'var(--bg-1)',
    borderRight: '1px solid var(--line)',
    display: 'flex', flexDirection: 'column',
    flexShrink: 0,
  }}>
    {/* brand */}
    <div style={{
      padding: '14px 14px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: '1px solid var(--line)',
    }}>
      <BrandMark size={26}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Maestro</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-2)' }}>v0.4.1 · b-one</div>
      </div>
      <Icon name="chevronDown" size={14} style={{ color: 'var(--fg-2)' }}/>
    </div>

    {/* project selector */}
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ fontSize: 10, color: 'var(--fg-2)', letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 6 }}>Active project</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', background: 'var(--bg-0)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius)',
        cursor: 'pointer',
      }}>
        <Icon name="folder" size={13} style={{ color: 'var(--accent)' }}/>
        <span className="mono" style={{ fontSize: 12, flex: 1 }}>cantante</span>
        <Icon name="chevronDown" size={12} style={{ color: 'var(--fg-2)' }}/>
      </div>
    </div>

    {/* nav */}
    <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <NavItem icon="home"     label="Dashboard" active={route === 'dashboard'} onClick={() => onNavigate('dashboard')} kbd="1"/>
      <NavItem icon="activity" label="Sessions"  active={route === 'session'}   onClick={() => onNavigate('session')}  badge="3" kbd="2"/>
      <NavItem icon="graph"    label="Workflows" active={route === 'canvas'}    onClick={() => onNavigate('canvas')}    kbd="3"/>
      <NavItem icon="foundry"  label="Foundry"   active={route === 'foundry'}   onClick={() => onNavigate('foundry')}   badge="1" kbd="4"/>
      <NavItem icon="blocks"   label="Catalog"   active={route === 'catalog'}   onClick={() => onNavigate('catalog')}   badge="142" kbd="5"/>
      <NavItem icon="cpu"      label="Models"    active={route === 'models'}    onClick={() => onNavigate('models')}    kbd="6"/>
    </nav>

    <div style={{ height: 1, background: 'var(--line)', margin: '6px 12px' }}/>

    <nav style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <NavItem icon="history" label="History"/>
      <NavItem icon="settings" label="Settings"/>
    </nav>

    <div style={{ flex: 1 }}/>

    {/* foot — usage / model */}
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-2)' }}>
        <StatusDot status="success" pulse/>
        backend
        <span style={{ marginLeft: 'auto' }} className="mono">5000</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>
        <StatusDot status="success"/>
        llm-provider
        <span style={{ marginLeft: 'auto' }} className="mono">5010</span>
      </div>
      <div style={{
        marginTop: 10, padding: 8, borderRadius: 'var(--radius)',
        background: 'var(--bg-0)', border: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#cc785c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>A</span>
          <span className="mono" style={{ fontSize: 11 }}>claude-sonnet-4.5</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-2)', marginTop: 4 }}>$8.42 today · 2.41M tokens</div>
      </div>
    </div>
  </div>
);

const TitleBar = ({ onCommandPalette }) => (
  <div style={{
    height: 36, background: 'var(--bg-1)',
    borderBottom: '1px solid var(--line)',
    display: 'flex', alignItems: 'center',
    padding: '0 12px', gap: 12,
    flexShrink: 0,
    userSelect: 'none', WebkitAppRegion: 'drag',
  }}>
    {/* traffic lights (faux macOS) */}
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }}/>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }}/>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', display: 'inline-block' }}/>
    </div>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 11, color: 'var(--fg-2)' }}>
      <BrandMark size={14}/>
      <span>Maestro</span>
      <span style={{ opacity: 0.5 }}>—</span>
      <span className="mono">cantante</span>
    </div>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--fg-2)', WebkitAppRegion: 'no-drag' }}>
      <button onClick={onCommandPalette} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 8px', border: '1px solid var(--line)',
        background: 'var(--bg-0)', borderRadius: 4,
      }}>
        <Icon name="search" size={11}/> <span style={{ fontSize: 11 }}>Search…</span>
        <span className="kbd">⌘K</span>
      </button>
    </div>
  </div>
);

const StatusBar = () => (
  <div style={{
    height: 26, background: 'var(--bg-1)',
    borderTop: '1px solid var(--line)',
    display: 'flex', alignItems: 'center',
    padding: '0 14px', gap: 14, fontSize: 11,
    color: 'var(--fg-2)', flexShrink: 0,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name="branch" size={11}/>
      <span className="mono">main</span>
      <span style={{ color: 'var(--fg-3)' }}>·</span>
      <span style={{ color: 'var(--ok)' }} className="mono">+184 −47</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <StatusDot status="running" pulse size={6}/>
      <span>3 running</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name="bolt" size={11}/>
      <span className="mono">2.41M tok</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name="pulse" size={11}/>
      <span className="mono">$8.42</span>
    </div>
    <div style={{ flex: 1 }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name="cpu" size={11}/>
      <span className="mono">RTX 4090 · 18.4/24 GB</span>
    </div>
    <span className="mono">ses_8af4</span>
    <span className="mono">UTC+02</span>
  </div>
);

/* Command palette overlay */
const CommandPalette = ({ open, onClose, onNavigate }) => {
  if (!open) return null;
  const items = [
    { group: 'Navigate', items: [
      { icon: 'home',     label: 'Dashboard',  hint: 'Overview',    go: 'dashboard' },
      { icon: 'activity', label: 'Sessions',   hint: '3 running',   go: 'session' },
      { icon: 'graph',    label: 'Workflows',  hint: 'Canvas editor', go: 'canvas' },
      { icon: 'foundry',  label: 'Foundry',    hint: 'Train blocks', go: 'foundry' },
      { icon: 'blocks',   label: 'Catalog',    hint: '142 blocks',  go: 'catalog' },
      { icon: 'cpu',      label: 'Models',     hint: '8 available', go: 'models' },
    ]},
    { group: 'Actions', items: [
      { icon: 'plus',     label: 'New session…',     hint: 'Pick template' },
      { icon: 'foundry',  label: 'Start foundry session…', hint: 'Train a block' },
      { icon: 'package',  label: 'Publish block…',    hint: 'From foundry → global' },
      { icon: 'terminal', label: 'Open terminal',     hint: 'Embedded shell' },
      { icon: 'git',      label: 'Open PR',           hint: '4 commits ahead' },
    ]},
    { group: 'Sessions', items: [
      { icon: 'activity', label: 'Cantante — File Tree Module', hint: 'ses_8af4 · running', go: 'session' },
      { icon: 'activity', label: 'Maestro — Telemetry Backfill', hint: 'ses_71bc · running', go: 'session' },
    ]},
  ];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 99,
      background: 'oklch(0 0 0 / 0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 110,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxHeight: 480, overflow: 'auto',
        background: 'var(--bg-1)', border: '1px solid var(--line)',
        borderRadius: 12, boxShadow: 'var(--shadow-2)',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" size={15} style={{ color: 'var(--fg-2)' }}/>
          <input autoFocus placeholder="Search, navigate, or run a command…" style={{
            flex: 1, fontSize: 14, background: 'transparent', border: 0, outline: 'none', color: 'var(--fg-0)',
          }}/>
          <span className="kbd">Esc</span>
        </div>
        {items.map(g => (
          <div key={g.group}>
            <div style={{ padding: '8px 12px 4px', fontSize: 10, color: 'var(--fg-2)', letterSpacing: 0.06, textTransform: 'uppercase' }}>{g.group}</div>
            {g.items.map((it, i) => (
              <div key={i}
                onClick={() => { if (it.go) onNavigate(it.go); onClose(); }}
                style={{
                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', fontSize: 13,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <Icon name={it.icon} size={14} style={{ color: 'var(--fg-2)' }}/>
                <span style={{ flex: 1 }}>{it.label}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{it.hint}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* App root */
const App = () => {
  const [route, setRoute] = useStateA('dashboard');
  const [palette, setPalette] = useStateA(false);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // apply tweaks
  useEffectA(() => {
    document.documentElement.dataset.theme = t.theme;
    const oklch = ACCENT_OKLCH[t.accent] || ACCENT_OKLCH['#00d8ff'];
    document.documentElement.style.setProperty('--accent', oklch);
    // derive soft / line variants
    document.documentElement.style.setProperty('--accent-soft', oklch.replace(')', ' / 0.14)'));
    document.documentElement.style.setProperty('--accent-line', oklch.replace(')', ' / 0.4)'));
    document.body.style.fontSize = t.density === 'compact' ? '12px' : '13px';
  }, [t.theme, t.accent, t.density]);

  // keyboard shortcuts
  useEffectA(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPalette(p => !p); }
      if (e.key === 'Escape') setPalette(false);
      if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[1-6]$/.test(e.key) && document.activeElement?.tagName !== 'INPUT') {
        const map = ['dashboard','session','canvas','foundry','catalog','models'];
        setRoute(map[parseInt(e.key, 10) - 1]);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const onNavigate = (r) => setRoute(r);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 0,
      background: 'var(--bg-0)', color: 'var(--fg-0)',
    }}>
      <TitleBar onCommandPalette={() => setPalette(true)}/>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar route={route} onNavigate={onNavigate}/>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {route === 'dashboard' && <DashboardScreen onNavigate={onNavigate}/>}
          {route === 'session'   && <SessionScreen   onNavigate={onNavigate}/>}
          {route === 'canvas'    && <CanvasScreen    onNavigate={onNavigate}/>}
          {route === 'foundry'   && <FoundryScreen   onNavigate={onNavigate}/>}
          {route === 'catalog'   && <CatalogScreen   onNavigate={onNavigate}/>}
          {route === 'models'    && <ModelsScreen    onNavigate={onNavigate}/>}
        </div>
      </div>
      <StatusBar/>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onNavigate={onNavigate}/>

      <TweaksPanel title="Tweaks" defaultPos={{ right: 24, bottom: 48 }}>
        <TweakSection title="Accent">
          <TweakColor label="Color" value={t.accent} onChange={v => setTweak('accent', v)}
            options={['#00d8ff','#a78bfa','#f5a623','#4ade80']}/>
        </TweakSection>
        <TweakSection title="Theme">
          <TweakRadio label="Mode" value={t.theme} onChange={v => setTweak('theme', v)}
            options={[{value:'dark',label:'Dark'},{value:'light',label:'Light'}]}/>
          <TweakRadio label="Density" value={t.density} onChange={v => setTweak('density', v)}
            options={[{value:'comfortable',label:'Comfortable'},{value:'compact',label:'Compact'}]}/>
        </TweakSection>
        <TweakSection title="Try it">
          <div style={{ fontSize: 11, color: 'var(--fg-2, #888)', lineHeight: 1.5 }}>
            Press <span className="kbd">⌘K</span> for the command palette.<br/>
            Press <span className="kbd">1</span>–<span className="kbd">6</span> to switch sections.
          </div>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
