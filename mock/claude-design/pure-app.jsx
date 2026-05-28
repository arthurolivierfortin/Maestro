/* global React, ReactDOM,
   TitleBar, TabBar, StatusLine, CmdLine, Box, Bar, Spark, B,
   PageConsole, PageSpaces, PageFoundry, PageModels, PageMonitor, HelpOverlay,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect */

const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "phosphor": "amber",
  "route": "console",
  "crt": "on",
  "fontSize": 13
}/*EDITMODE-END*/;

const TABS = [
  { id: 'console',  label: 'Console',  k: '1' },
  { id: 'spaces',   label: 'Spaces',   k: '2' },
  { id: 'foundry',  label: 'Foundry',  k: '3' },
  { id: 'models',   label: 'Models',   k: '4' },
  { id: 'monitor',  label: 'Monitor',  k: '5' },
];

const PAGES = {
  console: 'PageConsole',
  spaces:  'PageSpaces',
  foundry: 'PageFoundry',
  models:  'PageModels',
  monitor: 'PageMonitor',
};

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [help, setHelp] = useStateA(false);
  const [cmdMode, setCmdMode] = useStateA(false);
  const [cmd, setCmd] = useStateA('');

  useEffectA(() => {
    document.documentElement.dataset.tui = t.phosphor;
    document.documentElement.dataset.crt = t.crt;
    document.documentElement.style.setProperty('--term-fz', t.fontSize + 'px');
    document.body.style.fontSize = t.fontSize + 'px';
  }, [t.phosphor, t.crt, t.fontSize]);

  useEffectA(() => {
    const fn = (e) => {
      // Don't intercept while typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === '?') { e.preventDefault(); setHelp(h => !h); return; }
      if (e.key === ':') { e.preventDefault(); setCmdMode(true); setCmd(''); return; }
      if (e.key === 'Escape') { setCmdMode(false); setHelp(false); return; }

      if (cmdMode) {
        if (e.key === 'Enter') {
          const c = cmd.trim();
          if (c) {
            const t = TABS.find(t => c === t.label.toLowerCase() || c === t.id);
            if (t) setTweak('route', t.id);
            else if (c === 'q' || c === 'quit') setCmdMode(false);
          }
          setCmdMode(false); setCmd('');
        } else if (e.key === 'Backspace') {
          setCmd(c => c.slice(0, -1));
        } else if (e.key.length === 1) {
          setCmd(c => c + e.key);
        }
        return;
      }

      const tab = TABS.find(x => x.k === e.key);
      if (tab) { setTweak('route', tab.id); return; }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [cmdMode, cmd]);

  const Page = window[PAGES[t.route]] || PageConsole;

  return (
    <div className="shell">
      <div className="term" data-route={t.route}>
        <TitleBar session="ses_8af4"/>
        <TabBar items={TABS} route={t.route} onRoute={(r) => setTweak('route', r)}/>
        <Page/>
        {cmdMode ? (
          <CmdLine value={cmd} placeholder="type a command — e.g. 'foundry', 'monitor', 'q'"/>
        ) : (
          <StatusLine mode={help ? 'HELP' : 'NORMAL'} items={[
            <span><span className="k">1-5</span> tab</span>,
            <span><span className="k">:</span> cmd</span>,
            <span><span className="k">?</span> help</span>,
            <span><span className="k">p</span> pin</span>,
            <span><span className="k">Tab</span> pane</span>,
            <span><span className="k">q</span> quit</span>,
            <span className="gauge"><span className="c3">gpu</span><span className="bar"><span style={{ color: 'var(--ac)' }}>{'▓'.repeat(8)}</span><span style={{ color: 'var(--fg-4)' }}>{'░'.repeat(2)}</span></span><span className="c3">76%</span></span>,
            <span className="gauge"><span className="c3">tok</span><span className="c1">14.2k</span></span>,
            <span className="gauge"><span className="c3">$</span><span className="c1">0.21</span></span>,
            <span className="gauge"><span className="c3">14:28:24</span></span>,
          ]}/>
        )}

        <HelpOverlay open={help} onClose={() => setHelp(false)}/>
      </div>

      <TweaksPanel title="Tweaks" defaultPos={{ right: 24, bottom: 48 }}>
        <TweakSection title="Phosphor">
          <TweakRadio label="Color" value={t.phosphor} onChange={v => setTweak('phosphor', v)}
            options={[
              { value: 'amber', label: 'Amber' },
              { value: 'green', label: 'Green' },
              { value: 'white', label: 'White' },
            ]}/>
        </TweakSection>
        <TweakSection title="CRT effects">
          <TweakRadio label="Scanlines + vignette" value={t.crt} onChange={v => setTweak('crt', v)}
            options={[
              { value: 'on',  label: 'On' },
              { value: 'off', label: 'Off' },
            ]}/>
        </TweakSection>
        <TweakSection title="Density">
          <TweakRadio label="Font size" value={String(t.fontSize)} onChange={v => setTweak('fontSize', parseInt(v, 10))}
            options={[
              { value: '12', label: '12' },
              { value: '13', label: '13' },
              { value: '14', label: '14' },
            ]}/>
        </TweakSection>
        <TweakSection title="Navigate">
          <TweakSelect label="Tab" value={t.route} onChange={v => setTweak('route', v)}
            options={TABS.map(x => ({ value: x.id, label: `${x.k} · ${x.label}` }))}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
