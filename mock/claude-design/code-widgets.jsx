/* global React, Ic, StatusDot, Badge, Btn, Bar, Panel */
/* Pinnable widgets that live inline in the conversation. */

const { useState: useStateW } = React;

/* ═══════════════════════════════════════════════════════════════
   PinnedWidget wrapper — small chrome around any inline widget
   to signal "the agent pinned this for you"
   ═══════════════════════════════════════════════════════════════ */
const PinnedWidget = ({ title, meta, pinnedBy = 'agent', children, onUnpin, focused, kind = 'panel' }) => (
  <div className={'panel ' + (focused ? 'focused' : '')}
       style={{ margin: '12px 0', background: 'var(--bg-1)' }}>
    <div className="panel-title">{title}</div>
    <div style={{ position: 'absolute', top: -8, right: 14, background: 'var(--bg-0)',
                  padding: '0 8px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
      {meta && <span className="c-ink3">{meta}</span>}
      <span style={{ color: 'var(--agent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Ic n="pin" size={10}/> pinned by {pinnedBy}
      </span>
      <button className="btn ghost sm" onClick={onUnpin} style={{ padding: '0 4px' }}>
        <Ic n="x" size={11}/>
      </button>
    </div>
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Contract widget — input/output schema for a block
   This is the soul of the app — every block fulfills a contract.
   ═══════════════════════════════════════════════════════════════ */
const ContractWidget = ({ block = 'agent.coder', focused = false }) => (
  <PinnedWidget title={`CONTRACT · ${block}`} meta="v6 · global"
                focused={focused}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 0, alignItems: 'stretch', minHeight: 180 }}>
      {/* Inputs */}
      <div style={{ padding: 12 }}>
        <div className="t-h3" style={{ marginBottom: 8 }}>↳ Inputs</div>
        {[
          { name: 'plan',     type: 'PlanStep[]',  req: true,  desc: 'Ordered steps from agent.planner' },
          { name: 'codebase', type: 'Workspace',   req: true,  desc: 'Read-write filesystem handle' },
          { name: 'budget',   type: 'TokenBudget', req: false, desc: 'Optional cap — defaults to session limit' },
        ].map(f => (
          <div key={f.name} style={{
            border: '1px solid var(--line-soft)', borderRadius: 4, padding: '6px 10px',
            background: 'var(--bg-0)', marginBottom: 6,
            display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 8, alignItems: 'baseline',
          }}>
            <span className="mono c-ink0 b">{f.name}</span>
            <span className="c-accent" style={{ fontSize: 11 }}>{f.type}</span>
            <span style={{ fontSize: 9, color: f.req ? 'var(--err)' : 'var(--ink-3)' }}>{f.req ? 'REQ' : 'OPT'}</span>
            <span style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{f.desc}</span>
          </div>
        ))}
      </div>
      {/* Arrow column */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderLeft: '1px dashed var(--line)', borderRight: '1px dashed var(--line)' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-soft)',
                      border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ic n="arrowRight" size={12} style={{ color: 'var(--accent)' }}/>
        </div>
      </div>
      {/* Outputs */}
      <div style={{ padding: 12 }}>
        <div className="t-h3" style={{ marginBottom: 8 }}>Outputs ↴</div>
        {[
          { name: 'patch',       type: 'GitPatch', desc: 'Unified diff, one logical change per hunk' },
          { name: 'summary',     type: 'string',   desc: 'Natural-language description for reviewer' },
          { name: 'tokens_used', type: 'number',   desc: 'For budget accounting' },
        ].map(f => (
          <div key={f.name} style={{
            border: '1px solid var(--line-soft)', borderRadius: 4, padding: '6px 10px',
            background: 'var(--bg-0)', marginBottom: 6,
            display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'baseline',
          }}>
            <span className="mono c-ink0 b">{f.name}</span>
            <span className="c-accent" style={{ fontSize: 11 }}>{f.type}</span>
            <span style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{f.desc}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="divider dashed" style={{ margin: '4px 0' }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 4px', fontSize: 11, color: 'var(--ink-2)' }}>
      <span><Ic n="check" size={11} style={{ color: 'var(--ok)', verticalAlign: -1 }}/> 24 / 24 contract tests pass</span>
      <span className="c-ink4">·</span>
      <span><Ic n="bolt" size={11} style={{ color: 'var(--accent)', verticalAlign: -1 }}/> Fitness <span className="c-ok b">0.88</span></span>
      <span className="c-ink4">·</span>
      <span>used by <span className="c-ink0 b">8 workflows</span></span>
      <span className="c-ink4">·</span>
      <span><span className="c-ink0 b">3,402</span> calls / 30d</span>
    </div>
  </PinnedWidget>
);

/* ═══════════════════════════════════════════════════════════════
   Sessions widget
   ═══════════════════════════════════════════════════════════════ */
const SessionsTable = ({ rows, focused, compact, onRowClick }) => (
  <table className="tbl">
    <thead>
      <tr>
        <th style={{ width: 14 }}/>
        <th>Session</th>
        <th>Phase</th>
        <th>Agent</th>
        <th>Tokens</th>
        <th>Cost</th>
        <th>Elapsed</th>
        {!compact && <th>Tier</th>}
      </tr>
    </thead>
    <tbody>
      {rows.map((s, i) => (
        <tr key={i} className={s.sel ? 'active' : ''} onClick={() => onRowClick?.(s)}>
          <td><StatusDot status={s.dot} pulse={s.pulse}/></td>
          <td>
            <span className="c-ink0 b">{s.name}</span>
            <span className="c-ink3" style={{ marginLeft: 8, fontSize: 11 }}>{s.id}</span>
          </td>
          <td className="c-ink2">{s.phase}</td>
          <td><Badge variant="agent">{s.agent}</Badge></td>
          <td className="t-num c-ink1">{s.tokens}</td>
          <td className="t-num c-ink1">{s.cost}</td>
          <td className="t-num c-ink2">{s.elapsed}</td>
          {!compact && <td><Badge variant="outline" mono>{s.tier}</Badge></td>}
        </tr>
      ))}
    </tbody>
  </table>
);

/* ═══════════════════════════════════════════════════════════════
   Live workflow tree (THE COCKPIT)
   ═══════════════════════════════════════════════════════════════ */
const WorkflowTree = ({ task = 'add localStorage persistence to FileTree', highlight = 'coder' }) => {
  // Procedural ASCII-style block tree showing the workflow with agent position
  const nodes = {
    trigger:  { x: 30,  y: 40,  label: 'workflow.feature-pipeline', sub: 'on /add-feature',  state: 'done',    type: 'wf' },
    planner:  { x: 60,  y: 120, label: 'agent.planner',  sub: 'claude-sonnet-4.5', state: 'done',    type: 'agent', dur: '2m 14s' },
    spec:     { x: 360, y: 120, label: 'block.specify',  sub: 'schema-constrained', state: 'done',    type: 'block', dur: '3m 02s' },
    coder:    { x: 60,  y: 230, label: 'agent.coder',    sub: 'claude-sonnet-4.5', state: highlight === 'coder' ? 'active' : 'pending', type: 'agent', dur: '6m 41s' },
    shell:    { x: 360, y: 200, label: 'tool.shell',     sub: 'restricted',         state: highlight === 'coder' ? 'active' : 'pending', type: 'tool' },
    edit:     { x: 360, y: 260, label: 'tool.edit-file', sub: 'v2',                  state: highlight === 'coder' ? 'active' : 'pending', type: 'tool' },
    tester:   { x: 60,  y: 340, label: 'agent.tester',   sub: 'gpt-4o-mini',         state: 'pending', type: 'agent' },
    reviewer: { x: 60,  y: 420, label: 'agent.reviewer', sub: 'claude-opus-4',       state: 'pending', type: 'agent' },
    commit:   { x: 360, y: 380, label: 'tool.git',       sub: 'commit + push',       state: 'pending', type: 'tool' },
    pr:       { x: 360, y: 440, label: 'block.open-pr',  sub: 'v1',                  state: 'pending', type: 'block' },
  };
  const edges = [
    ['trigger', 'planner'],
    ['planner', 'spec'],
    ['planner', 'coder'],
    ['spec',    'coder'],
    ['coder',   'shell'],
    ['coder',   'edit'],
    ['coder',   'tester'],
    ['tester',  'reviewer'],
    ['reviewer','commit'],
    ['commit',  'pr'],
  ];
  const ext = (k) => nodes[k];
  return (
    <div className="workflow" style={{ position: 'relative' }}>
      {/* Edges */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {edges.map(([a, b], i) => {
          const A = ext(a), B = ext(b);
          const x1 = A.x + 150, y1 = A.y + 14;
          const x2 = B.x,       y2 = B.y + 14;
          const mx = (x1 + x2) / 2;
          const d = `M${x1} ${y1} L${mx} ${y1} L${mx} ${y2} L${x2} ${y2}`;
          const active = A.state === 'active' || B.state === 'active';
          const done = A.state === 'done' && B.state === 'done';
          return (
            <path key={i} d={d} fill="none"
              stroke={active ? 'var(--accent)' : done ? 'var(--ok)' : 'var(--line-strong)'}
              strokeWidth={active ? 1.6 : 1}
              strokeDasharray={A.state === 'done' && B.state === 'pending' ? '3 3' : 'none'}/>
          );
        })}
      </svg>
      {/* Nodes */}
      {Object.entries(nodes).map(([id, n]) => (
        <div key={id}
             className={'wf-node ' + (n.state === 'active' ? 'active' : n.state === 'done' ? 'done' : '')}
             style={{ left: n.x, top: n.y, minWidth: 150 }}>
          <span style={{ color: n.state === 'active' ? 'var(--accent)' : n.state === 'done' ? 'var(--ok)' : 'var(--ink-3)', fontSize: 10, marginRight: 4 }}>
            {n.state === 'active' ? '●' : n.state === 'done' ? '✓' : '○'}
          </span>
          <span className="b">{n.label}</span>
          <span className="pill">{n.sub}{n.dur ? ` · ${n.dur}` : ''}</span>
        </div>
      ))}
      {/* Agent in cockpit position */}
      {highlight === 'coder' && (
        <>
          <div className="wf-pulse" style={{ left: ext('coder').x - 14, top: ext('coder').y + 10 }}/>
          <div className="wf-label" style={{ left: ext('coder').x - 130, top: ext('coder').y - 4 }}>
            <span className="arrow">⤳</span><span className="c-agent b">Maestro</span> active here
          </div>
        </>
      )}

      {/* Legend box bottom-right */}
      <div style={{ position: 'absolute', right: 16, bottom: 16, padding: 10,
                    border: '1px solid var(--line)', background: 'var(--bg-1)', borderRadius: 'var(--radius)',
                    fontSize: 11 }}>
        <div className="t-h3" style={{ marginBottom: 6 }}>Legend</div>
        <div className="row gap-6"><span className="dot" style={{ background: 'var(--ok)' }}/> done</div>
        <div className="row gap-6"><span className="dot pulse" style={{ background: 'var(--accent)' }}/> active</div>
        <div className="row gap-6"><span className="dot" style={{ background: 'var(--ink-4)' }}/> pending</div>
        <div className="divider dashed" style={{ margin: '6px 0' }}/>
        <div className="row gap-6 c-ink3"><span style={{ fontFamily: 'var(--font-mono)' }}>agent.x</span> agent block</div>
        <div className="row gap-6 c-ink3"><span style={{ fontFamily: 'var(--font-mono)' }}>tool.x</span> tool block</div>
        <div className="row gap-6 c-ink3"><span style={{ fontFamily: 'var(--font-mono)' }}>block.x</span> custom block</div>
      </div>

      {/* Task header floating top-right */}
      <div style={{ position: 'absolute', right: 16, top: 16, padding: '8px 12px',
                    border: '1px solid var(--line)', background: 'var(--bg-1)', borderRadius: 'var(--radius)',
                    maxWidth: 320 }}>
        <div className="t-h3" style={{ marginBottom: 4 }}>Current task</div>
        <div className="c-ink0 mono" style={{ fontSize: 12 }}>{task}</div>
        <div className="row gap-8 c-ink3" style={{ marginTop: 6, fontSize: 11 }}>
          <span>session <span className="c-ink1 b">ses_8af4</span></span>
          <span>·</span>
          <span>step <span className="c-accent b">3</span>/7</span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Files tree (live) — shows files the agent has touched
   ═══════════════════════════════════════════════════════════════ */
const FilesTree = () => (
  <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
    {[
      { d: 0, glyph: '/', name: 'cantante',   state: 'root' },
      { d: 1, glyph: '└─', name: 'packages',  state: 'open' },
      { d: 2, glyph: '└─', name: 'maestro-code', state: 'open' },
      { d: 3, glyph: '├─', name: 'components/FileTree.tsx', state: 'modified' },
      { d: 3, glyph: '├─', name: 'hooks/useFileTreeExpansion.ts', state: 'created' },
      { d: 3, glyph: '├─', name: 'components/FileTree.test.tsx',  state: 'modified' },
      { d: 3, glyph: '└─', name: 'test/setup.ts', state: 'modified' },
    ].map((f, i) => (
      <div key={i} style={{ paddingLeft: f.d * 14, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="c-ink4">{f.glyph}</span>
        <span style={{ color: f.state === 'created' ? 'var(--ok)' : f.state === 'modified' ? 'var(--accent)' : 'var(--ink-1)' }}>
          {f.name}
        </span>
        {f.state === 'created' && <Badge variant="ok" style={{ padding: '0 5px' }}>NEW</Badge>}
        {f.state === 'modified' && <Badge variant="accent" style={{ padding: '0 5px' }}>MOD</Badge>}
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Models picker widget
   ═══════════════════════════════════════════════════════════════ */
const ModelsTable = ({ selected = 'claude-sonnet-4.5', onSelect }) => {
  const rows = [
    { id: 'claude-opus-4',     prov: 'anthropic', ctx: '200K', cost: '$15 / $75', q: 9.5, tps: 42,  st: 'available', tier: 'Tier 1' },
    { id: 'claude-sonnet-4.5', prov: 'anthropic', ctx: '200K', cost: '$3 / $15',  q: 9.1, tps: 84,  st: 'active',    tier: 'Tier 1' },
    { id: 'claude-haiku-4',    prov: 'anthropic', ctx: '200K', cost: '$0.8 / $4', q: 8.2, tps: 144, st: 'available', tier: 'Tier 2' },
    { id: 'gpt-4o',            prov: 'openai',    ctx: '128K', cost: '$5 / $15',  q: 8.7, tps: 78,  st: 'available', tier: 'Tier 1' },
    { id: 'gpt-4o-mini',       prov: 'openai',    ctx: '128K', cost: '$0.15 / $0.6', q: 7.4, tps: 162, st: 'available', tier: 'Tier 2' },
    { id: 'qwen-2.5-coder',    prov: 'ollama',    ctx: '128K', cost: 'free',       q: 8.4, tps: 38,  st: 'local',     tier: 'Tier 3' },
    { id: 'llama-3.1-70b',     prov: 'ollama',    ctx: '128K', cost: 'free',       q: 7.9, tps: 22,  st: 'local',     tier: 'Tier 3' },
    { id: 'gpt-4-turbo',       prov: 'azure',     ctx: '128K', cost: '$10 / $30',  q: 8.5, tps: null, st: 'unavailable', tier: '—' },
  ];
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ width: 14 }}/><th>Model</th><th>Provider</th><th>Ctx</th>
          <th>In / Out / 1M</th><th>Quality</th><th>tok/s</th><th>Tier</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} className={r.id === selected ? 'active' : ''} onClick={() => onSelect?.(r.id)}>
            <td><StatusDot status={r.st === 'active' ? 'ok' : r.st === 'unavailable' ? 'err' : r.st === 'local' ? 'warn' : 'idle'} pulse={r.st === 'active'}/></td>
            <td><span className="b c-ink0">{r.id}</span></td>
            <td className="c-ink2">{r.prov}</td>
            <td className="t-num c-ink1">{r.ctx}</td>
            <td className="t-num" style={{ color: r.cost === 'free' ? 'var(--ok)' : 'var(--ink-1)' }}>{r.cost}</td>
            <td className="t-num b" style={{ color: r.q >= 9 ? 'var(--ok)' : r.q >= 8 ? 'var(--ink-0)' : 'var(--ink-2)' }}>{r.q.toFixed(1)}</td>
            <td className="t-num c-ink2">{r.tps != null ? r.tps : '—'}</td>
            <td><Badge variant={r.tier.includes('1') ? 'accent' : r.tier.includes('2') ? 'outline' : 'warn'} mono>{r.tier}</Badge></td>
            <td>
              <Badge variant={r.st === 'active' ? 'ok' : r.st === 'unavailable' ? 'err' : 'outline'}>
                {r.st}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Catalog card (marketplace)
   ═══════════════════════════════════════════════════════════════ */
const BlockCard = ({ b, onClick }) => {
  const typeColor = { agent: 'var(--agent)', tool: 'var(--accent)', workflow: 'var(--info)', inference: 'var(--warn)' };
  return (
    <div className="card" onClick={onClick}>
      <div className="stripe" style={{ background: typeColor[b.type] || 'var(--ink-3)' }}/>
      <div className="row gap-6">
        <Badge variant={b.type === 'agent' ? 'agent' : b.type === 'tool' ? 'accent' : b.type === 'workflow' ? 'outline' : 'warn'}>{b.type}</Badge>
        <Badge variant="outline" mono>{b.v}</Badge>
        <span className="flex-1"/>
        <span className="c-ink3 mono" style={{ fontSize: 10 }}>{b.scope}</span>
      </div>
      <div>
        <div className="mono c-ink0 b" style={{ fontSize: 13 }}>{b.id}</div>
        <div className="t-small" style={{ marginTop: 4, lineHeight: 1.5 }}>{b.desc}</div>
      </div>
      {b.tools && (
        <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
          {b.tools.map(t => <Badge key={t} variant="outline" mono>{t}</Badge>)}
        </div>
      )}
      <div className="divider" style={{ margin: 'auto 0 0' }}/>
      <div className="row gap-12" style={{ fontSize: 11 }}>
        <span><span className="c-ink3 b" style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Uses</span><br/><span className="mono c-ink0 b">{b.uses.toLocaleString()}</span></span>
        {b.fit != null && <span><span className="c-ink3 b" style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Fitness</span><br/><span className="mono c-ink0 b">{b.fit.toFixed(2)}</span></span>}
        <span><span className="c-ink3 b" style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cost/run</span><br/><span className="mono c-ink0 b">{b.cost}</span></span>
        {b.publisher && <span className="flex-1" style={{ textAlign: 'right' }}><span className="c-ink3 b" style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>by</span><br/><span className="mono c-ink2">{b.publisher}</span></span>}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Token / cost meter (right-rail style)
   ═══════════════════════════════════════════════════════════════ */
const TokenMeter = () => (
  <div>
    <div className="t-h3" style={{ marginBottom: 8 }}>Token economy · 24h</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span className="mono c-ink0" style={{ fontSize: 18, fontWeight: 600 }}>2.41M</span>
      <span className="t-num c-ok" style={{ fontSize: 11 }}>−18% vs avg</span>
    </div>
    {/* Stacked bar */}
    <div style={{ display: 'flex', height: 8, marginTop: 8, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ flex: 0.42, background: 'var(--accent)' }} title="coder 42%"/>
      <div style={{ flex: 0.21, background: 'var(--ok)' }} title="planner 21%"/>
      <div style={{ flex: 0.16, background: 'var(--agent)' }} title="reviewer 16%"/>
      <div style={{ flex: 0.11, background: 'var(--warn)' }} title="tester 11%"/>
      <div style={{ flex: 0.10, background: 'var(--ink-3)' }} title="other 10%"/>
    </div>
    <div className="row gap-10" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 6, flexWrap: 'wrap' }}>
      <span><span className="dot" style={{ background: 'var(--accent)' }}/> coder 42%</span>
      <span><span className="dot" style={{ background: 'var(--ok)' }}/> planner 21%</span>
      <span><span className="dot" style={{ background: 'var(--agent)' }}/> reviewer 16%</span>
      <span><span className="dot" style={{ background: 'var(--warn)' }}/> tester 11%</span>
    </div>
    <div className="divider dashed"/>
    <div className="row" style={{ justifyContent: 'space-between', fontSize: 11 }}>
      <span className="c-ink2">Spend today</span>
      <span className="mono c-ink0 b">$8.42</span>
    </div>
    <div className="row" style={{ justifyContent: 'space-between', fontSize: 11 }}>
      <span className="c-ink2">Budget</span>
      <span className="mono c-ink2">$25.00 / day</span>
    </div>
    <div style={{ marginTop: 6 }}><Bar value={33.7}/></div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   AGENT-IN-CONTROL banner — used on any page the agent is acting on
   ═══════════════════════════════════════════════════════════════ */
const AgentBanner = ({ title = 'Maestro is driving this',
                       activity = 'iterating commit-message.generator',
                       cta, onCta, kbd = 'p' }) => (
  <div style={{
    margin: '14px 18px 0',
    padding: '8px 14px',
    border: '1px dashed var(--agent)',
    background: 'var(--agent-soft)',
    borderRadius: 'var(--radius)',
    display: 'flex', alignItems: 'center', gap: 12,
    fontFamily: 'var(--font-mono)',
  }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--agent)' }} className="pulse"/>
    <span className="c-agent b" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <Ic n="user" size={11} style={{ verticalAlign: -2 }}/> {title}
    </span>
    <span className="c-ink2" style={{ fontSize: 12 }}>· {activity}</span>
    <span className="flex-1"/>
    <span className="kbd-hint c-ink3"><span className="kbd">{kbd}</span> {cta || 'see in console'}</span>
    {onCta && <Btn variant="ghost" size="sm" iconRight="arrowRight" onClick={onCta}>Pin to console</Btn>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   FoundryProgressWidget — pinnable widget showing agent's training
   ═══════════════════════════════════════════════════════════════ */
const FoundryProgressWidget = ({ block = 'commit-message.generator', focused = true }) => (
  <PinnedWidget title={`FOUNDRY · ${block}`} meta="iter 5/8 · 3m 12s"
                pinnedBy="agent.maestro" focused={focused}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, alignItems: 'start' }}>
      <div>
        <div className="t-h3" style={{ marginBottom: 6 }}>Iterations · live</div>
        <table className="tbl" style={{ fontSize: 11 }}>
          <thead>
            <tr><th style={{ width: 14 }}/><th>Ver</th><th>Hypothesis</th><th>Model</th><th>Fitness</th><th>Cost</th></tr>
          </thead>
          <tbody>
            {[
              { st: 'ok', v: 'v3.0', h: 'baseline',                  m: 'sonnet-4.5', f: '0.71', c: '$0.020' },
              { st: 'ok', v: 'v3.1', h: 'add few-shot examples',     m: 'sonnet-4.5', f: '0.78', c: '$0.022' },
              { st: 'err',v: 'v3.2', h: 'cheaper backbone',          m: 'gpt-4o-mini',f: '0.74', c: '$0.008' },
              { st: 'ok', v: 'v3.3', h: 'add diff summarization',    m: 'haiku-4',    f: '0.82', c: '$0.010' },
              { st: 'live',v: 'v3.4',h: 'schema-constrained output', m: 'haiku-4',    f: '0.87', c: '$0.011' },
              { st: 'queued',v:'v3.5',h: 'tighten temp 0.3 → 0.1',  m: 'haiku-4',    f: '— ',   c: '— ' },
            ].map((r, i) => (
              <tr key={i} className={r.st === 'live' ? 'active' : ''}>
                <td>
                  {r.st === 'ok'  && <Ic n="check" size={11} style={{ color: 'var(--ok)' }}/>}
                  {r.st === 'err' && <Ic n="x" size={11} style={{ color: 'var(--err)' }}/>}
                  {r.st === 'live' && <StatusDot status="ok" pulse/>}
                  {r.st === 'queued' && <span className="c-ink4">○</span>}
                </td>
                <td className="mono c-ink2">{r.v}</td>
                <td className="c-ink1">{r.h}</td>
                <td className="mono c-ink2">{r.m}</td>
                <td className={'mono b ' + (r.st === 'live' ? 'c-accent' : r.st === 'ok' && parseFloat(r.f) > 0.85 ? 'c-ok' : 'c-ink0')}>{r.f}</td>
                <td className="mono c-ink2">{r.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="t-h3" style={{ marginBottom: 6 }}>Direction</div>
        <div className="row gap-6" style={{ marginBottom: 8 }}>
          <span className="c-ink2 t-small">baseline</span>
          <span className="mono c-ink0">0.71</span>
          <Ic n="arrowRight" size={11} style={{ color: 'var(--ink-3)' }}/>
          <span className="c-ink2 t-small">best</span>
          <span className="mono c-ok b">0.87</span>
        </div>
        <div style={{ height: 60, position: 'relative', background: 'var(--bg-0)', border: '1px solid var(--line-soft)', borderRadius: 4 }}>
          {/* tiny fitness curve */}
          <svg viewBox="0 0 100 50" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
            <polyline points="0,30 20,25 40,32 60,18 80,12 100,12"
              fill="none" stroke="var(--accent)" strokeWidth="1.2"/>
            <polyline points="0,30 20,25 40,32 60,18 80,12"
              fill="var(--accent-soft)" stroke="none"/>
          </svg>
        </div>
        <div className="divider dashed"/>
        <div className="t-h3" style={{ marginBottom: 6 }}>Next move</div>
        <div className="c-ink2 t-small" style={{ lineHeight: 1.5 }}>
          temp 0.3 → 0.1 should reduce variance further. Will publish if v3.5 ≥ <span className="mono c-ink0 b">0.88</span>.
        </div>
        <div style={{ marginTop: 8 }}>
          <span className="kbd-hint c-ink3"><span className="kbd">f</span> open foundry</span>
        </div>
      </div>
    </div>
  </PinnedWidget>
);

/* ═══════════════════════════════════════════════════════════════
   LiveWorkflowWidget — pinnable mini session monitor
   ═══════════════════════════════════════════════════════════════ */
const LiveWorkflowWidget = ({ focused = true, onOpen }) => {
  const nodes = [
    { d: 0, k: 'wf',    n: 'workflow.feature-pipeline', s: 'active', dur: '14m 22s' },
    { d: 1, k: 'agent', n: 'agent.planner',             s: 'done',   dur: '2m 14s' },
    { d: 1, k: 'block', n: 'block.specify',             s: 'done',   dur: '3m 02s' },
    { d: 1, k: 'agent', n: 'agent.coder',               s: 'active', dur: '6m 41s' },
    { d: 2, k: 'tool',  n: 'tool.edit-file',            s: 'done',   dur: '1.1s' },
    { d: 2, k: 'tool',  n: 'tool.shell',                s: 'active', dur: '3.4s' },
    { d: 1, k: 'agent', n: 'agent.tester',              s: 'pending' },
    { d: 1, k: 'agent', n: 'agent.reviewer',            s: 'pending' },
  ];
  const guide = (d) => d === 0 ? '' : d === 1 ? '├─ ' : '│  ├─ ';
  return (
    <PinnedWidget title="LIVE WORKFLOW · ses_8af4" meta="step 3/7"
                  pinnedBy="agent.maestro" focused={focused}>
      <div className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>
        {nodes.map((n, i) => {
          const isActive = n.s === 'active';
          const kindColor = n.k === 'agent' ? 'var(--agent)' : n.k === 'tool' ? 'var(--info)' : n.k === 'wf' ? 'var(--accent)' : 'var(--ok)';
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 80px 14px', gap: 8, alignItems: 'center',
                                 background: isActive ? 'var(--accent-soft)' : 'transparent',
                                 padding: '0 4px', borderRadius: 2 }}>
              <span style={{ color: n.s === 'done' ? 'var(--ok)' : isActive ? 'var(--accent)' : 'var(--ink-4)' }}
                    className={isActive ? 'pulse' : ''}>
                {n.s === 'done' ? '✓' : isActive ? '●' : '○'}
              </span>
              <span>
                <span className="c-ink4">{guide(n.d)}</span>
                <span style={{ color: kindColor, fontWeight: isActive ? 700 : 500 }}>{n.n}</span>
              </span>
              <span className="c-ink3" style={{ textAlign: 'right' }}>{n.dur || ''}</span>
              <span className="c-accent">{isActive ? '⤳' : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="divider dashed"/>
      <div className="row gap-12">
        <span className="t-small c-ink3">tokens <span className="c-ink0 b">14,209</span></span>
        <span className="t-small c-ink3">cost <span className="c-ink0 b">$0.21</span></span>
        <span className="t-small c-ink3">tool calls <span className="c-ink0 b">23</span></span>
        <span className="flex-1"/>
        <span className="kbd-hint"><span className="kbd">g</span> open monitor</span>
      </div>
    </PinnedWidget>
  );
};

/* ═══════════════════════════════════════════════════════════════
   ModelComparisonWidget — agent compares models inline
   ═══════════════════════════════════════════════════════════════ */
const ModelComparisonWidget = ({ focused = false }) => (
  <PinnedWidget title="MODEL COMPARISON · for commit-message" meta="6 candidates"
                pinnedBy="agent.maestro" focused={focused}>
    <table className="tbl" style={{ fontSize: 11 }}>
      <thead>
        <tr><th style={{ width: 14 }}/><th>Model</th><th>Fit</th><th>Cost</th><th>Latency</th><th>Pick</th></tr>
      </thead>
      <tbody>
        {[
          { sel: false, m: 'claude-sonnet-4.5', f: '0.85', c: '$0.020', l: '1.8s', p: 'overspec' },
          { sel: true,  m: 'claude-haiku-4',    f: '0.87', c: '$0.011', l: '1.4s', p: 'WINNER' },
          { sel: false, m: 'gpt-4o',            f: '0.82', c: '$0.018', l: '1.6s', p: 'ok' },
          { sel: false, m: 'gpt-4o-mini',       f: '0.74', c: '$0.008', l: '0.9s', p: 'too lossy' },
          { sel: false, m: 'qwen-2.5-coder',    f: '0.79', c: 'free',   l: '2.1s', p: 'try local?' },
        ].map((r, i) => (
          <tr key={i} className={r.sel ? 'active' : ''}>
            <td>{r.sel && <Ic n="check" size={11} style={{ color: 'var(--ok)' }}/>}</td>
            <td className="mono c-ink0 b">{r.m}</td>
            <td className={'mono b ' + (parseFloat(r.f) > 0.85 ? 'c-ok' : 'c-ink2')}>{r.f}</td>
            <td className="mono c-ink1">{r.c}</td>
            <td className="mono c-ink2">{r.l}</td>
            <td>{r.p === 'WINNER' ? <Badge variant="ok">winner</Badge> : <span className="c-ink2">{r.p}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </PinnedWidget>
);

Object.assign(window, {
  PinnedWidget, ContractWidget, SessionsTable, WorkflowTree, FilesTree,
  ModelsTable, BlockCard, TokenMeter,
  AgentBanner, FoundryProgressWidget, LiveWorkflowWidget, ModelComparisonWidget,
});
