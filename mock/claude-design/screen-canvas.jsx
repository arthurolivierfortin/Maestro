/* global React, Icon, StatusDot, Badge, Button, Panel, Input */
const { useState: useStateC } = React;

const CanvasScreen = ({ onNavigate }) => {
  const [selected, setSelected] = useStateC('coder');

  // node positions on a 1200x800 logical canvas
  const nodes = {
    trigger:  { x: 60,  y: 320, w: 170, h: 80,  type: 'trigger', label: 'On PR opened', subtitle: 'Webhook', io: { in: 0, out: 1 } },
    planner:  { x: 280, y: 320, w: 200, h: 100, type: 'agent',   label: 'Planner', subtitle: 'claude-sonnet-4.5', io: { in: 1, out: 1 } },
    coder:    { x: 530, y: 220, w: 200, h: 120, type: 'agent',   label: 'Coder', subtitle: 'claude-sonnet-4.5', io: { in: 1, out: 2 } },
    tester:   { x: 530, y: 420, w: 200, h: 100, type: 'agent',   label: 'Tester', subtitle: 'gpt-4o-mini', io: { in: 1, out: 1 } },
    branch:   { x: 790, y: 320, w: 170, h: 80,  type: 'decision', label: 'Tests pass?', subtitle: 'condition', io: { in: 1, out: 2 } },
    reviewer: { x: 1010, y: 220, w: 200, h: 100, type: 'agent',   label: 'Reviewer', subtitle: 'claude-opus-4', io: { in: 1, out: 1 } },
    fix:      { x: 1010, y: 420, w: 200, h: 100, type: 'agent',   label: 'Fix loop', subtitle: 'claude-sonnet-4.5', io: { in: 1, out: 1 } },
    commit:   { x: 1260, y: 320, w: 180, h: 80,  type: 'tool',    label: 'Open PR', subtitle: 'git.create-pr', io: { in: 2, out: 0 } },
  };

  const edges = [
    { from: 'trigger', to: 'planner' },
    { from: 'planner', to: 'coder' },
    { from: 'planner', to: 'tester' },
    { from: 'coder',   to: 'branch' },
    { from: 'tester',  to: 'branch' },
    { from: 'branch',  to: 'reviewer', label: 'yes' },
    { from: 'branch',  to: 'fix', label: 'no' },
    { from: 'reviewer', to: 'commit' },
    { from: 'fix',     to: 'coder', dashed: true, label: 'retry' },
  ];

  return (
    <div data-screen-label="03 Workflow Canvas" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* topbar */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
      }}>
        <button onClick={() => onNavigate('dashboard')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fg-2)', fontSize: 12 }}>
          <Icon name="folder" size={14}/> Workflows /
        </button>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>feature-pipeline.v3</h1>
        <Badge variant="outline" mono>workflow · 8 nodes</Badge>
        <Badge variant="ok" mono>saved · 2m ago</Badge>
        <div style={{ flex: 1 }}/>
        <Input size="sm" icon="search" placeholder="Find node…" kbd="/" style={{ width: 220 }}/>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 2 }}>
          <Button size="sm" variant="ghost">Edit</Button>
          <Button size="sm" variant="soft" active>Layout</Button>
          <Button size="sm" variant="ghost">JSON</Button>
        </div>
        <Button variant="outline" icon="play" size="md">Dry run</Button>
        <Button variant="primary" icon="bolt" size="md">Execute</Button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr 320px', minHeight: 0 }}>
        {/* palette */}
        <div style={{
          borderRight: '1px solid var(--line)', background: 'var(--bg-1)',
          overflow: 'auto', padding: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>Blocks</div>
          <Input size="sm" icon="search" placeholder="Filter blocks…" style={{ marginBottom: 10 }}/>
          <PaletteGroup title="Triggers" items={[
            { icon: 'bolt', name: 'Webhook' }, { icon: 'history', name: 'Schedule' }, { icon: 'git', name: 'Git event' }, { icon: 'chat', name: 'Manual' },
          ]}/>
          <PaletteGroup title="Agents" items={[
            { icon: 'user', name: 'Planner', color: 'var(--agent)' },
            { icon: 'code', name: 'Coder',   color: 'var(--agent)' },
            { icon: 'check', name: 'Tester', color: 'var(--agent)' },
            { icon: 'eye',  name: 'Reviewer', color: 'var(--agent)' },
            { icon: 'sparkle', name: 'Debugger', color: 'var(--agent)' },
          ]}/>
          <PaletteGroup title="Tools" items={[
            { icon: 'terminal', name: 'Shell' }, { icon: 'file', name: 'Read file' }, { icon: 'diff', name: 'Edit file' }, { icon: 'branch', name: 'Git' }, { icon: 'db', name: 'HTTP' },
          ]}/>
          <PaletteGroup title="Control flow" items={[
            { icon: 'graph', name: 'Decision' }, { icon: 'refresh', name: 'Loop' }, { icon: 'layers', name: 'Parallel' }, { icon: 'check', name: 'Validator' },
          ]}/>
        </div>

        {/* canvas */}
        <div style={{
          position: 'relative', overflow: 'hidden', background: 'var(--bg-0)',
          backgroundImage:
            'radial-gradient(circle at center, oklch(0.3 0.01 240) 1px, transparent 1.4px)',
          backgroundSize: '22px 22px',
        }}>
          {/* zoom + minimap controls bottom-right */}
          <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 4, zIndex: 2 }}>
            <Button size="sm" variant="ghost" icon="plus" style={{ width: 28, height: 28, justifyContent: 'center' }}/>
            <Button size="sm" variant="ghost" style={{ width: 28, height: 28, justifyContent: 'center' }}>–</Button>
            <div style={{ height: 1, background: 'var(--line)' }}/>
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-2)', textAlign: 'center', padding: '2px 0' }}>76%</span>
          </div>

          <div style={{ position: 'absolute', right: 12, bottom: 12, padding: 8, width: 180, height: 110, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', zIndex: 2 }}>
            <div style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 4 }}>Minimap</div>
            <svg width="160" height="80" viewBox="0 0 1500 800" style={{ display: 'block' }}>
              {edges.map((e, i) => {
                const a = nodes[e.from], b = nodes[e.to];
                return <line key={i} x1={a.x + a.w} y1={a.y + a.h/2} x2={b.x} y2={b.y + b.h/2} stroke="var(--line-strong)" strokeWidth="2"/>;
              })}
              {Object.entries(nodes).map(([id, n]) => (
                <rect key={id} x={n.x} y={n.y} width={n.w} height={n.h}
                      fill={selected === id ? 'var(--accent)' : n.type === 'agent' ? 'var(--agent)' : 'var(--fg-2)'} rx="6"/>
              ))}
              <rect x="0" y="100" width="1500" height="700" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray="14 8"/>
            </svg>
          </div>

          <svg viewBox="0 0 1500 800" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
            <defs>
              <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 Z" fill="var(--line-strong)"/>
              </marker>
              <marker id="cv-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 Z" fill="var(--accent)"/>
              </marker>
            </defs>

            {/* edges */}
            {edges.map((e, i) => {
              const a = nodes[e.from], b = nodes[e.to];
              const isSelected = e.from === selected || e.to === selected;
              const x1 = a.x + a.w, y1 = a.y + a.h/2;
              const x2 = b.x,       y2 = b.y + b.h/2;
              const mx = (x1 + x2) / 2;
              const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
              return (
                <g key={i}>
                  <path d={d}
                    stroke={isSelected ? 'var(--accent)' : 'var(--line-strong)'}
                    strokeWidth={isSelected ? 2 : 1.4}
                    fill="none"
                    strokeDasharray={e.dashed ? '6 6' : 'none'}
                    markerEnd={`url(#${isSelected ? 'cv-arrow-accent' : 'cv-arrow'})`}
                  />
                  {e.label && (
                    <g transform={`translate(${mx},${(y1+y2)/2 - 8})`}>
                      <rect x="-20" y="-9" width="40" height="18" rx="9" fill="var(--bg-0)" stroke="var(--line)"/>
                      <text textAnchor="middle" y="4" fontSize="11" fontFamily="var(--font-mono)" fill={e.label === 'yes' ? 'var(--ok)' : e.label === 'no' ? 'var(--err)' : 'var(--fg-2)'}>{e.label}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* nodes */}
            {Object.entries(nodes).map(([id, n]) => (
              <CanvasNode key={id} id={id} n={n} selected={selected === id} onClick={() => setSelected(id)}/>
            ))}
          </svg>
        </div>

        {/* inspector */}
        <div style={{ borderLeft: '1px solid var(--line)', background: 'var(--bg-1)', overflow: 'auto' }}>
          {selected && <NodeInspector node={nodes[selected]} id={selected}/>}
        </div>
      </div>
    </div>
  );
};

const PaletteGroup = ({ title, items }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{title}</span>
      <Icon name="chevronDown" size={12}/>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(it => (
        <div key={it.name} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px', borderRadius: 'var(--radius-sm)',
          fontSize: 12, color: 'var(--fg-1)',
          background: 'var(--bg-0)',
          border: '1px dashed var(--line)',
          cursor: 'grab',
        }}>
          <Icon name={it.icon} size={13} style={{ color: it.color || 'var(--fg-2)' }}/>
          <span>{it.name}</span>
        </div>
      ))}
    </div>
  </div>
);

const CanvasNode = ({ id, n, selected, onClick }) => {
  const colors = {
    trigger:  { accent: 'oklch(0.82 0.14 80)' },
    agent:    { accent: 'var(--agent)' },
    tool:     { accent: 'var(--accent)' },
    decision: { accent: 'var(--fg-1)' },
  };
  const c = colors[n.type] || colors.tool;
  const fill = selected ? 'var(--bg-2)' : 'var(--bg-1)';
  const stroke = selected ? 'var(--accent)' : 'var(--line-strong)';
  const sw = selected ? 2 : 1.25;

  // running indicator on coder for demo
  const running = id === 'coder';

  return (
    <g transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      {selected && <rect x="-3" y="-3" width={n.w + 6} height={n.h + 6} rx="9" fill="none" stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="6"/>}
      <rect width={n.w} height={n.h} rx="6" fill={fill} stroke={stroke} strokeWidth={sw}/>
      {/* left accent stripe */}
      <rect width="3" height={n.h} fill={c.accent}/>
      {/* type label */}
      <text x="14" y="20" fontFamily="var(--font-mono)" fontSize="9" fill={c.accent} style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>{n.type}</text>
      <text x="14" y="42" fontFamily="var(--font-ui)" fontSize="14" fontWeight="600" fill="var(--fg-0)">{n.label}</text>
      <text x="14" y="60" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-2)">{n.subtitle}</text>

      {/* running pulse */}
      {running && (
        <g transform={`translate(${n.w - 24}, 14)`}>
          <circle r="4" fill="var(--accent)">
            <animate attributeName="r" values="3;6;3" dur="1.6s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite"/>
          </circle>
        </g>
      )}

      {/* duration / status badge */}
      {n.type !== 'trigger' && n.type !== 'decision' && (
        <g transform={`translate(${n.w - 70}, ${n.h - 22})`}>
          <rect width="60" height="16" rx="3" fill="var(--bg-0)" stroke="var(--line)"/>
          <text x="30" y="11" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-2)">
            {running ? '6m 41s' : id === 'planner' ? '2m 14s' : 'idle'}
          </text>
        </g>
      )}

      {/* IO handles */}
      {Array.from({ length: n.io.in }).map((_, i) => (
        <circle key={'i'+i} cx="0" cy={n.h * (i + 1) / (n.io.in + 1)} r="5"
          fill="var(--bg-0)" stroke={c.accent} strokeWidth="1.5"/>
      ))}
      {Array.from({ length: n.io.out }).map((_, i) => (
        <circle key={'o'+i} cx={n.w} cy={n.h * (i + 1) / (n.io.out + 1)} r="5"
          fill="var(--bg-0)" stroke={c.accent} strokeWidth="1.5"/>
      ))}
    </g>
  );
};

const NodeInspector = ({ node, id }) => {
  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>{children}</div>
  );

  return (
    <div>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <Badge variant={node.type === 'agent' ? 'agent' : 'accent'}>{node.type}</Badge>
        <h2 style={{ margin: '8px 0 4px', fontSize: 18, fontWeight: 600 }}>{node.label}</h2>
        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>node.{id} · {node.subtitle}</div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <SectionLabel>Model</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-0)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--agent))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-0)', fontWeight: 600, fontSize: 11 }}>C</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 12 }}>claude-sonnet-4.5</div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>200K · $3/$15 per 1M · ★ 9.1</div>
            </div>
            <Icon name="chevronDown" size={14} style={{ color: 'var(--fg-2)' }}/>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-2)' }}>
            Fallback: <span className="mono" style={{ color: 'var(--fg-1)' }}>gpt-4o-mini</span>
          </div>
        </div>

        <div>
          <SectionLabel>System prompt</SectionLabel>
          <div style={{
            padding: 10, background: 'var(--bg-0)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-1)',
            lineHeight: 1.55, maxHeight: 140, overflow: 'hidden', position: 'relative',
          }}>
            You are the <span style={{ color: 'var(--agent)' }}>Coder</span> agent in a Maestro feature pipeline. Read the plan emitted by the Planner. For each step, propose minimal, idempotent changes. Use the available tools and follow the project's testing protocol. Confirm before destructive operations.
            <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 40, background: 'linear-gradient(transparent, var(--bg-0))' }}/>
          </div>
          <div style={{ marginTop: 6 }}><Button variant="ghost" size="sm" icon="code">Edit prompt</Button></div>
        </div>

        <div>
          <SectionLabel>Tools</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Badge variant="outline" mono>read-file</Badge>
            <Badge variant="outline" mono>edit-file</Badge>
            <Badge variant="outline" mono>shell</Badge>
            <Badge variant="outline" mono>git</Badge>
            <Badge variant="muted" mono>+ add</Badge>
          </div>
        </div>

        <div>
          <SectionLabel>Outputs</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['patch: string', 'summary: string', 'tokens_used: number'].map(o => (
              <div key={o} className="mono" style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 4 }}>{o}</div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Stats (last 30 runs)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <Stat label="Success" value="93%"/>
            <Stat label="Avg time" value="6m 12s"/>
            <Stat label="Avg cost" value="$0.18"/>
            <Stat label="Tool calls" value="11.4"/>
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div style={{ padding: 8, background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 4 }}>
    <div style={{ fontSize: 10, color: 'var(--fg-2)' }}>{label}</div>
    <div className="mono" style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{value}</div>
  </div>
);

Object.assign(window, { CanvasScreen });
