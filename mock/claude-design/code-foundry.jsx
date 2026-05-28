/* global React, Ic, StatusDot, Badge, Btn, Bar, Panel, BlockCard, AgentBanner,
   PinnedWidget, ContractWidget,
   BLOCK_TYPES, BLOCK_CATEGORIES, BLOCKS */
/* Unified Foundry page (replaces old Catalog) + Block detail w/ workflow editor */

const { useState: useStateF, useEffect: useEffectF } = React;

/* ═══════════════════════════════════════════════════════════════
   FOUNDRY · Library tab — full catalog of blocks
   keyboard: j/k nav · Enter open · n new · /search
   ═══════════════════════════════════════════════════════════════ */
const FoundryLibrary = ({ onOpen, blocks }) => {
  const [cat, setCat] = useStateF('all');     // all | compose | execute | define | quality | control | state | mine
  const [type, setType] = useStateF('all');   // narrow filter
  const [focusIdx, setFocusIdx] = useStateF(0);
  const [view, setView] = useStateF('list');  // list | grid

  const visible = blocks.filter(b => {
    if (cat === 'mine') return b.scope === 'user';
    if (cat !== 'all' && BLOCK_TYPES[b.type].cat !== cat) return false;
    if (type !== 'all' && b.type !== type) return false;
    return true;
  });

  useEffectF(() => {
    const fn = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(visible.length - 1, i + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (visible[focusIdx]) onOpen?.(visible[focusIdx]); }
      else if (e.key === 'v') setView(v => v === 'list' ? 'grid' : 'list');
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [visible, focusIdx]);

  // Quick category bar
  const types = Object.entries(BLOCK_TYPES);

  return (
    <>
      {/* Category buckets */}
      <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-0)',
                    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="t-h3" style={{ margin: 0 }}>CATEGORY</span>
        <button onClick={() => { setCat('all'); setType('all'); }}
                className={'btn sm ' + (cat === 'all' && type === 'all' ? '' : 'ghost')}>
          All <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>0</span>
        </button>
        {Object.entries(BLOCK_CATEGORIES).map(([k, v]) => (
          <button key={k} onClick={() => { setCat(k); setType('all'); }}
                  className={'btn sm ' + (cat === k ? '' : 'ghost')}>
            {v.label} <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>{v.kbd}</span>
          </button>
        ))}
        <button onClick={() => setCat('mine')}
                className={'btn sm ' + (cat === 'mine' ? '' : 'ghost')}>
          Mine <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>M</span>
        </button>
        <span className="flex-1"/>
        <span className="kbd-hint"><span className="kbd">v</span> view</span>
      </div>

      {/* Narrow type bar */}
      <div style={{ padding: '6px 18px', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-0)',
                    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
        <span className="t-h3" style={{ margin: 0 }}>TYPE</span>
        <button onClick={() => setType('all')}
                className={'btn sm ' + (type === 'all' ? '' : 'ghost')}>
          all types · {visible.length}
        </button>
        {types.filter(([k, v]) => cat === 'all' || cat === 'mine' || v.cat === cat).map(([k, v]) => {
          const count = blocks.filter(b => b.type === k && (cat !== 'mine' || b.scope === 'user')).length;
          if (count === 0) return null;
          return (
            <button key={k} onClick={() => setType(k)}
                    className={'btn sm ' + (type === k ? '' : 'ghost')}
                    style={{ borderColor: type === k ? v.color : undefined }}>
              <span style={{ color: v.color }}><Ic n={v.ic} size={11}/></span>
              <span>{v.label}</span>
              <span className="c-ink3" style={{ marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
        <span className="flex-1"/>
        {type !== 'all' && <span className="c-ink2 t-small">{BLOCK_TYPES[type].desc}</span>}
      </div>

      {/* List or grid */}
      <div style={{ padding: 0, flex: 1, overflow: 'auto' }}>
        {view === 'list' ? (
          <table className="tbl" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 28 }}/>
                <th style={{ width: 110 }}>Type</th>
                <th>Block</th>
                <th style={{ width: 50 }}>Ver</th>
                <th style={{ width: 70 }}>Scope</th>
                <th style={{ width: 70 }}>Fitness</th>
                <th style={{ width: 80 }}>Uses</th>
                <th style={{ width: 80 }}>Cost/run</th>
                <th style={{ width: 130 }}>Publisher</th>
                <th style={{ width: 60 }}>Train</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b, i) => {
                const tdef = BLOCK_TYPES[b.type];
                return (
                  <tr key={b.id} className={i === focusIdx ? 'active' : ''}
                      onClick={() => { setFocusIdx(i); onOpen?.(b); }}>
                    <td style={{ position: 'relative' }}>
                      <span className="c-accent mono">{i === focusIdx ? '❯' : ''}</span>
                      {b.agentInControl && <span className="dot pulse" style={{ background: 'var(--agent)', position: 'absolute', right: 4, top: '50%', marginTop: -3 }} title="agent is using this"/>}
                    </td>
                    <td><span style={{ color: tdef.color }}><Ic n={tdef.ic} size={11} style={{ verticalAlign: -1, marginRight: 4 }}/></span><span className="mono c-ink1">{tdef.label}</span></td>
                    <td>
                      <div className="mono c-ink0 b">{b.id}</div>
                      <div className="t-small c-ink2" style={{ marginTop: 2, lineHeight: 1.4 }}>{b.desc}</div>
                    </td>
                    <td className="mono c-ink2">{b.v}</td>
                    <td><Badge variant={b.scope === 'user' ? 'agent' : b.scope === 'project' ? 'accent' : 'outline'} mono>{b.scope}</Badge></td>
                    <td className={'mono b ' + (b.fit && b.fit >= 0.85 ? 'c-ok' : b.fit ? 'c-ink0' : 'c-ink4')}>
                      {b.fit != null ? b.fit.toFixed(2) : '—'}
                    </td>
                    <td className="mono c-ink2 t-num">{b.uses.toLocaleString()}</td>
                    <td className="mono c-ink2">{b.cost}</td>
                    <td className="mono c-ink3">{b.publisher}</td>
                    <td>
                      {b.training === 'live'   && <Badge variant="agent"><span className="dot pulse" style={{ background: 'var(--agent)' }}/> live</Badge>}
                      {b.training === 'queued' && <Badge variant="warn">queued</Badge>}
                      {b.training === 'idle'   && <span className="c-ink4">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
            {visible.map(b => (
              <div key={b.id} style={{ position: 'relative' }}>
                {b.agentInControl && (
                  <span style={{
                    position: 'absolute', top: -7, right: 10, zIndex: 2,
                    background: 'var(--bg-0)', padding: '0 6px',
                    fontSize: 9, color: 'var(--agent)', fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    border: '1px dashed var(--agent)', borderRadius: 3,
                  }}>
                    <Ic n="user" size={9} style={{ verticalAlign: -1 }}/> agent active
                  </span>
                )}
                <BlockCard b={b} onClick={() => onOpen?.(b)}/>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 18px', borderTop: '1px solid var(--line)', background: 'var(--bg-1)',
                    display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-3)', alignItems: 'center' }}>
        <span>{focusIdx + 1} / {visible.length}</span>
        <span>·</span>
        <span className="kbd-hint"><span className="kbd">j/k</span> nav</span>
        <span className="kbd-hint"><span className="kbd">Enter</span> open internals</span>
        <span className="kbd-hint"><span className="kbd">/</span> search</span>
        <span className="kbd-hint"><span className="kbd">v</span> list/grid</span>
        <span className="flex-1"/>
        <span className="kbd-hint"><span className="kbd">n</span> new block</span>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════
   FOUNDRY · Forge tab — training in progress (was old Foundry)
   ═══════════════════════════════════════════════════════════════ */
const FoundryForge = ({ onOpen }) => {
  const inForge = BLOCKS.filter(b => b.training === 'live' || b.training === 'queued');
  return (
    <div style={{ padding: 18, overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { k: 'Best fitness',  v: '0.89',  d: '+0.18 vs base', cl: 'c-ok' },
          { k: 'Cost per run',  v: '$0.012',d: '−42%',          cl: 'c-ok' },
          { k: 'Avg latency',   v: '1.4s',  d: '−0.6s',         cl: 'c-ok' },
          { k: 'Tokens / run',  v: '1,200', d: '−38%',          cl: 'c-ok' },
        ].map(s => (
          <div key={s.k} style={{ padding: 14, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
            <div className="t-h3">{s.k}</div>
            <div className="mono c-ink0 b" style={{ fontSize: 20, marginTop: 4 }}>{s.v}</div>
            <div className={'t-small mono ' + s.cl}>{s.d}</div>
          </div>
        ))}
      </div>

      <Panel title="ACTIVE TRAINING" meta={inForge.length + ' blocks'} flush>
        <table className="tbl">
          <thead><tr><th style={{width:14}}/><th>Block</th><th>Type</th><th>Driver</th><th>Iter</th><th>Baseline</th><th>Best</th><th>Δ cost</th><th></th></tr></thead>
          <tbody>
            <tr className="active" onClick={() => onOpen?.(BLOCKS.find(b => b.id === 'commit-message.generator'))}>
              <td><StatusDot status="ok" pulse/></td>
              <td className="mono c-ink0 b">commit-message.generator</td>
              <td><Badge variant="agent">agent</Badge></td>
              <td><Badge variant="agent" mono><Ic n="user" size={9} style={{verticalAlign:-1}}/> agent.maestro</Badge></td>
              <td className="mono">5 / 8</td>
              <td className="mono c-ink2">0.71</td>
              <td className="mono c-ok b">0.89</td>
              <td className="mono c-ok">−42%</td>
              <td><Btn variant="ghost" size="sm" iconRight="arrowRight">Open</Btn></td>
            </tr>
            <tr>
              <td><StatusDot status="warn"/></td>
              <td className="mono c-ink0 b">workflow.docs-pass</td>
              <td><Badge variant="accent">workflow</Badge></td>
              <td className="mono c-ink2">you</td>
              <td className="mono">0 / 8</td>
              <td className="mono c-ink2">0.78</td>
              <td className="c-ink4">—</td>
              <td className="c-ink4">—</td>
              <td><Btn variant="ghost" size="sm">Start</Btn></td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <div style={{ height: 16 }}/>

      <div className="row gap-12" style={{ marginBottom: 8 }}>
        <span className="t-h3" style={{ margin: 0 }}>RECENTLY PROMOTED</span>
        <span className="flex-1"/>
        <span className="kbd-hint"><span className="kbd">p</span> publish from forge</span>
      </div>
      <Panel flush>
        <table className="tbl">
          <thead><tr><th>When</th><th>Block</th><th>From</th><th>To</th><th>Fitness</th><th>Promoted by</th></tr></thead>
          <tbody>
            {[
              { t: 'just now', b: 'commit-message.generator', f: 'foundry', to: 'user', fit: '0.89', who: 'agent.maestro' },
              { t: '3h ago',   b: 'agent.debugger v2',        f: 'foundry', to: 'user', fit: '0.74', who: 'you' },
              { t: 'yesterday',b: 'agent.planner v4',         f: 'user',    to: 'global', fit: '0.91', who: 'maestro/core' },
              { t: '2d ago',   b: 'router.tier-by-budget v2', f: 'project', to: 'global', fit: '—', who: 'you' },
            ].map((r, i) => (
              <tr key={i}>
                <td className="c-ink2">{r.t}</td>
                <td className="mono c-ink0 b">{r.b}</td>
                <td className="mono c-ink2">{r.f}</td>
                <td><Ic n="arrowRight" size={10} style={{color:'var(--ink-3)',marginRight:4}}/><Badge variant="ok">{r.to}</Badge></td>
                <td className="mono">{r.fit}</td>
                <td className="mono c-ink3">{r.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   FOUNDRY · Bench tab — benchmark matrix
   ═══════════════════════════════════════════════════════════════ */
const FoundryBench = () => {
  const models = ['claude-sonnet-4.5', 'claude-haiku-4', 'gpt-4o', 'gpt-4o-mini', 'llama-3.1-70b', 'qwen-2.5-coder'];
  const examples = ['feat-auth', 'fix-race', 'refactor-fs', 'docs-readme', 'chore-deps', 'perf-cache'];
  const seed = (m, e) => {
    const v = ((m*7 + e*3) % 11) / 10 + 0.5 - (e === 4 ? 0.25 : 0);
    return Math.max(0.2, Math.min(0.99, v + (m === 1 ? 0.06 : m === 0 ? 0.04 : 0)));
  };
  const heat = (v) => {
    if (v >= 0.85) return { bg: 'var(--ok-soft)',  fg: 'var(--ok)' };
    if (v >= 0.7)  return { bg: 'transparent',     fg: 'var(--ink-0)' };
    if (v >= 0.55) return { bg: 'var(--warn-soft)',fg: 'var(--warn)' };
    return                  { bg: 'var(--err-soft)', fg: 'var(--err)' };
  };
  return (
    <div style={{ padding: 18, overflow: 'auto' }}>
      <div className="row gap-12" style={{ marginBottom: 12 }}>
        <span className="t-h3" style={{ margin: 0 }}>BENCH · commit-message.generator</span>
        <Badge variant="agent" mono><Ic n="user" size={9} style={{verticalAlign:-1}}/> driven by agent.maestro</Badge>
        <span className="flex-1"/>
        <Btn variant="ghost" size="sm" icon="db">Change dataset</Btn>
        <Btn variant="primary" size="sm" icon="bolt">Re-run bench</Btn>
      </div>

      <Panel title="MATRIX" meta="6 models × 6 examples · ds.commit-eval v2">
        <table className="tbl" style={{ fontSize: 11 }}>
          <thead>
            <tr><th>Model</th>{examples.map(e => <th key={e} style={{ textAlign: 'center' }}>{e}</th>)}<th style={{ textAlign: 'right' }}>Avg</th></tr>
          </thead>
          <tbody>
            {models.map((m, mi) => {
              const scores = examples.map((_, ei) => seed(mi, ei));
              const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
              const best = mi === 1;
              return (
                <tr key={m} style={{ background: best ? 'var(--accent-soft)' : 'transparent' }}>
                  <td>
                    <span className="row gap-6">
                      {best && <Ic n="bolt" size={11} style={{ color: 'var(--accent)' }}/>}
                      <span className="mono c-ink0 b">{m}</span>
                    </span>
                  </td>
                  {scores.map((s, i) => {
                    const h = heat(s);
                    return (
                      <td key={i} style={{ padding: 4, textAlign: 'center' }}>
                        <span className="mono b" style={{ background: h.bg, color: h.fg, padding: '3px 6px', borderRadius: 3, display: 'inline-block', minWidth: 40 }}>{s.toFixed(2)}</span>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'right' }}><span className={'mono b ' + (best ? 'c-accent' : 'c-ink0')}>{avg.toFixed(2)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row gap-12" style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)' }}>
          <span><span style={{ background: 'var(--ok-soft)', padding: '0 6px', color: 'var(--ok)' }} className="mono">0.85+</span> winner</span>
          <span><span style={{ background: 'var(--warn-soft)', padding: '0 6px', color: 'var(--warn)' }} className="mono">0.55-0.7</span> needs work</span>
          <span><span style={{ background: 'var(--err-soft)', padding: '0 6px', color: 'var(--err)' }} className="mono">&lt;0.55</span> failing</span>
          <span className="flex-1"/>
          <span>Winner: <span className="c-accent b mono">claude-haiku-4</span> — 4× cheaper than baseline</span>
        </div>
      </Panel>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAGE · Foundry (THE unified Blocks page)
   3 tabs: Library | Forge | Bench
   ═══════════════════════════════════════════════════════════════ */
const PageFoundryNew = ({ onRoute }) => {
  const [tab, setTab] = useStateF('library');
  const [showNew, setShowNew] = useStateF(false);

  useEffectF(() => {
    const fn = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'L' || (e.shiftKey && e.key === 'l')) setTab('library');
      else if (e.key === 'F' || (e.shiftKey && e.key === 'f')) setTab('forge');
      else if (e.key === 'B' || (e.shiftKey && e.key === 'b')) setTab('bench');
      else if (e.key === 'n' && !showNew) setShowNew(true);
      else if (e.key === 'Escape') setShowNew(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [showNew]);

  const onOpenBlock = (b) => onRoute?.('block', b);

  return (
    <div className="main" style={{ overflow: 'hidden' }}>
      <AgentBanner
        title="Maestro is driving the foundry"
        activity="iterating commit-message.generator · v3.4 hit 0.87 fit"
        cta="see in console"
        kbd="1"/>

      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
      }}>
        <span className="c-ink2"><Ic n="foundry" size={14} style={{ verticalAlign: -2 }}/> Foundry</span>
        <span className="c-ink2">— browse, forge and publish blocks</span>
        <Badge variant="outline">{BLOCKS.length} total</Badge>
        <Badge variant="ok"><span className="dot ok pulse"/> 1 training</Badge>
        <span className="flex-1"/>
        <div className="input-bar" style={{ margin: 0, padding: '4px 10px', minWidth: 220 }}>
          <Ic n="search" size={13} style={{ color: 'var(--ink-3)' }}/>
          <span className="c-ink3" style={{ fontSize: 12 }}>Search blocks…</span>
          <span className="kbd">/</span>
        </div>
        <Btn variant="outline" size="sm" icon="download">Import</Btn>
        <Btn variant="primary" size="sm" icon="plus" onClick={() => setShowNew(true)}>New block <span className="kbd" style={{ background: 'transparent', borderColor: 'rgba(0,0,0,0.2)', marginLeft: 4 }}>n</span></Btn>
      </div>

      <div className="subtabs">
        <div className={'subtab' + (tab === 'library' ? ' active' : '')} onClick={() => setTab('library')}>
          <Ic n="blocks" size={12}/> Library <span className="count">{BLOCKS.length}</span>
          <span className="kbd" style={{ marginLeft: 6, fontSize: 9 }}>L</span>
        </div>
        <div className={'subtab' + (tab === 'forge' ? ' active' : '')} onClick={() => setTab('forge')}>
          <Ic n="foundry" size={12}/> Forge <span className="count">{BLOCKS.filter(b => b.training !== 'idle').length}</span>
          <span className="kbd" style={{ marginLeft: 6, fontSize: 9 }}>F</span>
        </div>
        <div className={'subtab' + (tab === 'bench' ? ' active' : '')} onClick={() => setTab('bench')}>
          <Ic n="pulse" size={12}/> Bench
          <span className="kbd" style={{ marginLeft: 6, fontSize: 9 }}>B</span>
        </div>
        <span style={{ flex: 1 }}/>
        <span className="c-ink3 t-small" style={{ alignSelf: 'center', paddingRight: 16 }}>
          {tab === 'library' && 'Browse the 142 blocks · click or Enter to open internals'}
          {tab === 'forge' && 'Blocks under active training · agent + user can drive'}
          {tab === 'bench' && 'Benchmark a block against models on a dataset'}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {tab === 'library' && <FoundryLibrary blocks={BLOCKS} onOpen={onOpenBlock}/>}
        {tab === 'forge'   && <FoundryForge onOpen={onOpenBlock}/>}
        {tab === 'bench'   && <FoundryBench/>}
      </div>

      {showNew && <NewBlockPicker onClose={() => setShowNew(false)} onPick={(type) => { setShowNew(false); onRoute?.('block', { type, id: `new.${type}`, v: 'v0', scope: 'user', publisher: 'you' }); }}/>}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   New block type picker — keyboard-driven
   ═══════════════════════════════════════════════════════════════ */
const NewBlockPicker = ({ onClose, onPick }) => {
  const types = Object.entries(BLOCK_TYPES);
  const [focus, setFocus] = useStateF(0);
  useEffectF(() => {
    const fn = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setFocus(f => Math.min(types.length - 1, f + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp')   { e.preventDefault(); setFocus(f => Math.max(0, f - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); onPick(types[focus][0]); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [focus]);

  let lastCat = null;
  return (
    <div className="cmdp-overlay" onClick={onClose}>
      <div className="cmdp" onClick={e => e.stopPropagation()} style={{ width: 640 }}>
        <div className="cmdp-input">
          <Ic n="plus" size={16} style={{ color: 'var(--accent)' }}/>
          <span className="c-ink0 b">New block · pick a type</span>
          <span className="flex-1"/>
          <span className="t-small c-ink3">j/k · Enter · Esc</span>
        </div>
        <div className="cmdp-list" style={{ maxHeight: 500 }}>
          {types.map(([key, t], i) => {
            const showCat = t.cat !== lastCat;
            lastCat = t.cat;
            return (
              <React.Fragment key={key}>
                {showCat && <div className="cmdp-group">{BLOCK_CATEGORIES[t.cat].label} · {BLOCK_CATEGORIES[t.cat].hint}</div>}
                <div className={'cmdp-item' + (i === focus ? ' sel' : '')}
                     onClick={() => onPick(key)} onMouseEnter={() => setFocus(i)}
                     style={{ gridTemplateColumns: '18px 100px 1fr auto' }}>
                  <span className="ic" style={{ color: t.color }}><Ic n={t.ic} size={14}/></span>
                  <span className="mono c-ink0 b">{t.label}</span>
                  <span className="c-ink2 t-small">{t.desc}</span>
                  <span className="kbd">↵</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PageFoundryNew, NewBlockPicker, FoundryLibrary });
