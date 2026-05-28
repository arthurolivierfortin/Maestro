/* global React, Icon, StatusDot, Badge, Button, Panel, Sparkline, Progress, Tabs */
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

const SessionScreen = ({ onNavigate }) => {
  const [tab, setTab] = useStateS('logs');
  const [selectedNode, setSelectedNode] = useStateS('n3');
  const [tick, setTick] = useStateS(0);
  useEffectS(() => { const t = setInterval(() => setTick(x => x + 1), 1100); return () => clearInterval(t); }, []);

  const phases = [
    { id: 'plan',   name: 'Plan',     status: 'completed', duration: '2m 14s' },
    { id: 'spec',   name: 'Specify',  status: 'completed', duration: '3m 02s' },
    { id: 'impl',   name: 'Implement',status: 'active',    duration: '6m 41s' },
    { id: 'test',   name: 'Test',     status: 'pending' },
    { id: 'review', name: 'Review',   status: 'pending' },
    { id: 'commit', name: 'Commit',   status: 'pending' },
  ];

  const tree = [
    { id: 'n1', depth: 0, name: 'workflow.feature-pipeline', type: 'workflow', status: 'running', duration: '14m 22s' },
    { id: 'n2', depth: 1, name: 'agent.planner',  type: 'agent', status: 'completed', duration: '2m 14s' },
    { id: 'n3', depth: 1, name: 'agent.coder',    type: 'agent', status: 'running',   duration: '6m 41s', selected: true },
    { id: 'n4', depth: 2, name: 'tool.read-file',   type: 'tool', status: 'completed', duration: '0.4s' },
    { id: 'n5', depth: 2, name: 'inference.claude-4.5', type: 'inference', status: 'completed', duration: '8.2s', tokens: '4.1k' },
    { id: 'n6', depth: 2, name: 'tool.edit-file',  type: 'tool', status: 'completed', duration: '1.1s' },
    { id: 'n7', depth: 2, name: 'tool.shell',     type: 'tool', status: 'running',   duration: '3.4s' },
    { id: 'n8', depth: 2, name: 'inference.claude-4.5', type: 'inference', status: 'pending' },
    { id: 'n9', depth: 1, name: 'agent.tester',   type: 'agent', status: 'pending' },
    { id: 'n10', depth: 1, name: 'agent.reviewer', type: 'agent', status: 'pending' },
  ];

  return (
    <div data-screen-label="02 Session Monitor" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Session header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'var(--bg-1)',
      }}>
        <button onClick={() => onNavigate('dashboard')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fg-2)', fontSize: 12 }}>
          <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }}/>
          Sessions
        </button>
        <div style={{ height: 18, width: 1, background: 'var(--line)' }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot status="running" pulse/>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Cantante — File Tree Module</h1>
            <Badge variant="agent" mono>ses_8af4b21c</Badge>
            <Badge variant="outline">type: project</Badge>
            <Badge variant="outline" mono>main · ahead 4</Badge>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-2)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Started <span className="mono">14:22:08</span></span>
            <span>·</span>
            <span>Elapsed <span className="mono" style={{ color: 'var(--fg-1)' }}>14m 22s</span></span>
            <span>·</span>
            <span>Workspace <span className="mono" style={{ color: 'var(--fg-1)' }}>cantante</span></span>
            <span>·</span>
            <span>Template <span className="mono" style={{ color: 'var(--fg-1)' }}>feature-pipeline.v3</span></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="ghost" icon="pause" size="md">Pause</Button>
          <Button variant="ghost" icon="stop" size="md">Stop</Button>
          <Button variant="outline" icon="eye" size="md">Watch</Button>
          <Button variant="primary" icon="branch" size="md">Open PR</Button>
        </div>
      </div>

      {/* Phases stepper */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-0)',
      }}>
        {phases.map((p, i) => {
          const isActive = p.status === 'active';
          const isDone = p.status === 'completed';
          const color = isDone ? 'var(--ok)' : isActive ? 'var(--accent)' : 'var(--fg-3)';
          return (
            <React.Fragment key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: isDone ? 'var(--ok-soft)' : isActive ? 'var(--accent-soft)' : 'var(--bg-2)',
                  border: `1px solid ${isDone ? 'var(--ok)' : isActive ? 'var(--accent)' : 'var(--line)'}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  boxShadow: isActive ? `0 0 0 4px var(--accent-soft)` : 'none',
                }}>
                  {isDone ? <Icon name="check" size={12}/> : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--fg-0)' : 'var(--fg-1)' }}>{p.name}</div>
                  {p.duration && <div className="mono" style={{ fontSize: 10, color: 'var(--fg-2)' }}>{p.duration}</div>}
                </div>
              </div>
              {i < phases.length - 1 && (
                <div style={{ flex: 1, height: 1, background: isDone ? 'var(--ok)' : 'var(--line)', margin: '0 14px', opacity: isDone ? 0.5 : 1 }}/>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* main 3-col layout */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '280px 1fr 340px' }}>
        {/* Execution tree */}
        <div style={{ borderRight: '1px solid var(--line)', background: 'var(--bg-0)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--line)',
            position: 'sticky', top: 0, background: 'var(--bg-0)', zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="layers" size={13} style={{ color: 'var(--fg-2)' }}/>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase', color: 'var(--fg-1)' }}>Execution</span>
            </div>
            <Badge variant="outline" mono>10 nodes</Badge>
          </div>
          <div style={{ padding: '4px 0' }}>
            {tree.map(n => <TreeNode key={n.id} node={n} selected={selectedNode === n.id} onClick={() => setSelectedNode(n.id)}/>)}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', padding: '10px 14px', background: 'var(--bg-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-2)' }}>
              <span>Tokens</span><span className="mono" style={{ color: 'var(--fg-0)' }}>14,209</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>
              <span>Cost</span><span className="mono" style={{ color: 'var(--fg-0)' }}>$0.21</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>
              <span>Tool calls</span><span className="mono" style={{ color: 'var(--fg-0)' }}>23</span>
            </div>
          </div>
        </div>

        {/* center: tabs + content */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <div style={{ padding: '0 16px', background: 'var(--bg-0)' }}>
            <Tabs
              value={tab} onChange={setTab}
              tabs={[
                { id: 'logs',      label: 'Terminal',      icon: 'terminal' },
                { id: 'conv',      label: 'Conversation',  icon: 'chat',    count: 18 },
                { id: 'diff',      label: 'Diff',          icon: 'diff',    count: '+184/-47' },
                { id: 'artifacts', label: 'Artifacts',     icon: 'file',    count: 6 },
                { id: 'graph',     label: 'Graph',         icon: 'graph' },
              ]}
            />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {tab === 'logs' && <TerminalView tick={tick}/>}
            {tab === 'conv' && <ConversationView/>}
            {tab === 'diff' && <DiffView/>}
            {tab === 'artifacts' && <ArtifactsView/>}
            {tab === 'graph' && <MiniGraphView/>}
          </div>
        </div>

        {/* right: inspector */}
        <div style={{ borderLeft: '1px solid var(--line)', background: 'var(--bg-1)', overflow: 'auto' }}>
          <InspectorPanel/>
        </div>
      </div>
    </div>
  );
};

const TreeNode = ({ node, selected, onClick }) => {
  const typeColor = { workflow: 'var(--accent)', agent: 'var(--agent)', tool: 'var(--fg-1)', inference: 'oklch(0.82 0.14 80)' };
  const statusIcon = {
    running:   <StatusDot status="running" pulse/>,
    completed: <Icon name="check" size={11} style={{ color: 'var(--ok)' }}/>,
    pending:   <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--fg-3)' }}/>,
    failed:    <Icon name="x" size={11} style={{ color: 'var(--err)' }}/>,
  };
  return (
    <div
      onClick={onClick}
      style={{
        padding: `5px ${12 + node.depth * 14}px 5px 12px`,
        display: 'grid', gridTemplateColumns: '14px 1fr auto', alignItems: 'center', gap: 8,
        background: selected ? 'var(--bg-2)' : 'transparent',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer', fontSize: 12,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-1)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14 }}>{statusIcon[node.status]}</span>
      <div style={{ minWidth: 0 }}>
        <div className="mono" style={{
          color: typeColor[node.type] || 'var(--fg-1)',
          fontWeight: selected ? 600 : 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{node.name}</div>
      </div>
      {node.duration && <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{node.duration}</span>}
    </div>
  );
};

const TerminalLines = [
  { t: 'log',   c: '$ dotnet build apps/backend/src/Maestro.Api',          color: 'var(--fg-1)' },
  { t: 'log',   c: 'Restored 17 projects in 4.2s',                          color: 'var(--fg-2)' },
  { t: 'log',   c: 'Build succeeded in 12.4s · 0 warnings · 0 errors',     color: 'var(--ok)' },
  { t: 'sys',   c: '[14:28:11] agent.coder · invoking tool.edit-file',     color: 'var(--agent)' },
  { t: 'log',   c: '  → packages/maestro-code/components/FileTree.tsx',    color: 'var(--fg-2)' },
  { t: 'log',   c: '  ✓ 142 lines written · 4 hunks · sha 0e8a72',         color: 'var(--ok)' },
  { t: 'sys',   c: '[14:28:14] agent.coder · invoking tool.shell',         color: 'var(--agent)' },
  { t: 'log',   c: '$ npm run test -- FileTree',                            color: 'var(--fg-1)' },
  { t: 'log',   c: '  PASS  FileTree.test.tsx (4.1s)',                      color: 'var(--ok)' },
  { t: 'log',   c: '    ✓ renders root nodes (32ms)',                       color: 'var(--fg-2)' },
  { t: 'log',   c: '    ✓ expands on click (18ms)',                         color: 'var(--fg-2)' },
  { t: 'log',   c: '    ✗ persists open state across reload (timeout)',     color: 'var(--err)' },
  { t: 'sys',   c: '[14:28:21] inference.claude-4.5 · 4,124 input, 612 out · $0.018', color: 'var(--accent)' },
  { t: 'log',   c: 'thinking… diagnosing test failure: localStorage mock missing in setup', color: 'var(--fg-2)' },
  { t: 'sys',   c: '[14:28:24] agent.coder · invoking tool.shell',         color: 'var(--agent)' },
  { t: 'log',   c: '$ npm run test -- FileTree --watch',                    color: 'var(--fg-1)' },
];

const TerminalView = ({ tick }) => {
  const ref = useRefS(null);
  useEffectS(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [tick]);
  return (
    <div ref={ref} style={{
      flex: 1, overflow: 'auto', padding: 16,
      fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7,
      background: 'var(--bg-0)',
    }}>
      {TerminalLines.map((l, i) => (
        <div key={i} style={{ color: l.color, whiteSpace: 'pre-wrap' }}>{l.c}</div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--fg-1)' }}>
        <span style={{ color: 'var(--accent)' }}>›</span> running...
        <span style={{ display: 'inline-block', width: 7, height: 14, background: 'var(--accent)', marginLeft: 4, animation: 'blink-caret 1s steps(1) infinite' }}/>
      </div>
      <div style={{ height: 40 }}/>
    </div>
  );
};

const ConversationView = () => {
  const msgs = [
    { role: 'system', content: 'You are the Coder agent. The Planner produced step 3: "Add localStorage persistence to FileTree expansion state."', meta: 'system' },
    { role: 'agent',  content: "I'll need to look at FileTree.tsx and its test file first.", meta: 'agent.coder · 14:27:51' },
    { role: 'tool',   content: 'tool.read-file(path="packages/maestro-code/components/FileTree.tsx")', meta: 'tool · 0.4s' },
    { role: 'agent',  content: "Current implementation holds expansion in local React state. I'll lift it into a useFileTreeExpansion hook backed by localStorage, then update the test to mock storage.", meta: 'agent.coder · 14:28:02' },
    { role: 'tool',   content: 'tool.edit-file · 4 hunks · +142 −47', meta: 'tool · 1.1s · sha 0e8a72' },
    { role: 'tool',   content: 'tool.shell(cmd="npm run test -- FileTree") · 1 failing', meta: 'tool · 4.1s' },
    { role: 'agent',  content: 'The test setup is missing the localStorage mock. Adding `vi.stubGlobal("localStorage", …)` in setup.ts before re-running.', meta: 'agent.coder · 14:28:24 · streaming…', streaming: true },
  ];
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {msgs.map((m, i) => <ChatMessage key={i} m={m}/>)}
    </div>
  );
};

const ChatMessage = ({ m }) => {
  const palette = {
    system: { fg: 'var(--fg-2)', bg: 'transparent', label: 'var(--fg-3)' },
    agent:  { fg: 'var(--fg-0)', bg: 'var(--bg-1)', label: 'var(--agent)' },
    tool:   { fg: 'var(--fg-1)', bg: 'var(--bg-1)', label: 'var(--accent)' },
  };
  const p = palette[m.role];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: p.label, fontFamily: 'var(--font-mono)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.06 }}>
        {m.meta}
      </div>
      <div style={{
        padding: m.role === 'system' ? '0 0 0 0' : '10px 12px',
        background: p.bg, color: p.fg,
        border: m.role === 'system' ? 0 : '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        fontSize: 12.5, lineHeight: 1.6,
        fontFamily: m.role === 'tool' ? 'var(--font-mono)' : 'inherit',
        position: 'relative',
      }}>
        {m.content}
        {m.streaming && <span style={{ display: 'inline-block', width: 7, height: 12, background: 'var(--accent)', marginLeft: 4, verticalAlign: 'middle', animation: 'blink-caret 1s steps(1) infinite' }}/>}
      </div>
    </div>
  );
};

const DiffView = () => {
  const hunks = [
    { file: 'packages/maestro-code/components/FileTree.tsx', plus: 64, minus: 18 },
    { file: 'packages/maestro-code/hooks/useFileTreeExpansion.ts', plus: 38, minus: 0 },
    { file: 'packages/maestro-code/components/FileTree.test.tsx', plus: 42, minus: 12 },
    { file: 'packages/maestro-code/test/setup.ts', plus: 12, minus: 4 },
    { file: 'packages/maestro-code/components/index.ts', plus: 1, minus: 0 },
  ];
  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
      <div style={{ width: 280, borderRight: '1px solid var(--line)', background: 'var(--bg-0)' }}>
        {hunks.map((h, i) => (
          <div key={i} style={{
            padding: '8px 12px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: i === 0 ? 'var(--bg-2)' : 'transparent',
            cursor: 'pointer',
          }}>
            <Icon name="file" size={13} style={{ color: 'var(--fg-2)' }}/>
            <div className="mono" style={{ flex: 1, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.file.split('/').slice(-1)[0]}</div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ok)' }}>+{h.plus}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--err)' }}>−{h.minus}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 0, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <div style={{ padding: '8px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', color: 'var(--fg-1)' }}>FileTree.tsx · @@ −18,7 +18,52 @@</div>
        {[
          { k: ' ', c: 'import React, { useState } from \'react\';' },
          { k: '-', c: 'import React, { useState } from \'react\';' },
          { k: '+', c: 'import React from \'react\';' },
          { k: '+', c: 'import { useFileTreeExpansion } from \'../hooks/useFileTreeExpansion\';' },
          { k: ' ', c: '' },
          { k: ' ', c: 'export function FileTree({ root }: { root: TreeNode }) {' },
          { k: '-', c: '  const [expanded, setExpanded] = useState<Set<string>>(new Set());' },
          { k: '+', c: '  const { expanded, toggle } = useFileTreeExpansion(\'cantante.filetree\');' },
          { k: ' ', c: '' },
          { k: ' ', c: '  return (' },
          { k: ' ', c: '    <div role="tree" className="ft">' },
          { k: ' ', c: '      {root.children.map(child => (' },
          { k: '+', c: '        <TreeNode key={child.id} node={child} expanded={expanded} onToggle={toggle}/>' },
          { k: '-', c: '        <TreeNode key={child.id} node={child} expanded={expanded} onToggle={id => setExpanded(s => toggleSet(s, id))}/>' },
        ].map((l, i) => {
          const bg = l.k === '+' ? 'oklch(0.78 0.16 150 / 0.06)' : l.k === '-' ? 'oklch(0.72 0.18 25 / 0.06)' : 'transparent';
          const fg = l.k === '+' ? 'var(--ok)' : l.k === '-' ? 'var(--err)' : 'var(--fg-1)';
          return (
            <div key={i} style={{ padding: '0 14px', background: bg, color: fg, display: 'grid', gridTemplateColumns: '16px 1fr', gap: 6 }}>
              <span style={{ color: 'var(--fg-3)' }}>{l.k}</span>
              <span style={{ whiteSpace: 'pre' }}>{l.c}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ArtifactsView = () => {
  const files = [
    { name: 'FileTree.tsx', type: 'modified', size: '4.2 KB', age: '2m ago' },
    { name: 'useFileTreeExpansion.ts', type: 'created', size: '1.1 KB', age: '2m ago' },
    { name: 'FileTree.test.tsx', type: 'modified', size: '3.8 KB', age: '1m ago' },
    { name: 'test/setup.ts', type: 'modified', size: '0.6 KB', age: '38s ago' },
    { name: 'plan.md', type: 'artifact', size: '2.4 KB', age: '12m ago' },
    { name: 'execution.json', type: 'artifact', size: '18 KB', age: 'live' },
  ];
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {files.map(f => (
          <div key={f.name} style={{
            padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius)',
            background: 'var(--bg-1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="file" size={14} style={{ color: 'var(--fg-2)' }}/>
              <span className="mono" style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Badge variant={f.type === 'created' ? 'ok' : f.type === 'modified' ? 'accent' : 'outline'}>{f.type}</Badge>
              <span className="mono" style={{ fontSize: 10, color: 'var(--fg-2)' }}>{f.size} · {f.age}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MiniGraphView = () => (
  <div style={{
    flex: 1, overflow: 'auto', padding: 24,
    backgroundImage: 'radial-gradient(circle at center, var(--line) 1px, transparent 1px)',
    backgroundSize: '20px 20px', backgroundPosition: 'center',
  }}>
    <svg width="100%" height="100%" viewBox="0 0 600 400" style={{ display: 'block' }}>
      {/* edges */}
      <g stroke="var(--line-strong)" strokeWidth="1.25" fill="none">
        <path d="M150,80 C180,80 200,120 230,160" markerEnd="url(#arrow)"/>
        <path d="M150,80 C180,80 200,80 230,80"  markerEnd="url(#arrow)"/>
        <path d="M340,80 C380,80 400,120 430,160"/>
        <path d="M340,160 C380,160 400,160 430,160"/>
        <path d="M340,160 C380,160 400,200 430,240"/>
      </g>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--line-strong)"/>
        </marker>
      </defs>
      <Node x={70} y={60}  label="Planner" type="agent" status="completed"/>
      <Node x={250} y={60} label="Coder" type="agent" status="running"/>
      <Node x={250} y={140} label="Tester" type="agent" status="pending"/>
      <Node x={450} y={60} label="Reviewer" type="agent" status="pending"/>
      <Node x={450} y={140} label="Validator" type="tool" status="pending"/>
      <Node x={450} y={220} label="Commit" type="tool" status="pending"/>
    </svg>
  </div>
);

const Node = ({ x, y, label, type, status }) => {
  const color = type === 'agent' ? 'var(--agent)' : 'var(--accent)';
  const ring = status === 'running' ? 'var(--accent)' : status === 'completed' ? 'var(--ok)' : 'var(--line)';
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width="90" height="40" rx="6" fill="var(--bg-1)" stroke={ring} strokeWidth="1.5"/>
      <circle cx="12" cy="20" r="3" fill={color}/>
      <text x="22" y="24" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-0)">{label}</text>
    </g>
  );
};

const InspectorPanel = () => (
  <div>
    <div style={{
      padding: '12px 16px', borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusDot status="running" pulse/>
        <div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--agent)' }}>agent.coder</div>
          <div style={{ fontSize: 10, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>step 3 of 7 · 6m 41s</div>
        </div>
      </div>
      <Button size="sm" variant="ghost" icon="chevron"/>
    </div>

    <div style={{ padding: 14 }}>
      <SectionLabel>I/O Contract</SectionLabel>
      <KVList rows={[
        ['inputs', '{ task, codebase }'],
        ['outputs', '{ patch, summary }'],
        ['tools',  ['read-file', 'edit-file', 'shell']],
      ]}/>

      <Divider/>

      <SectionLabel>Current step</SectionLabel>
      <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-0)' }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6 }}>tool.shell</div>
        <div style={{ fontSize: 12, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>npm run test -- FileTree --watch</div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-2)' }}>
          <StatusDot status="running" pulse/>
          Streaming · 3.4s
        </div>
      </div>

      <Divider/>

      <SectionLabel>Fitness signals</SectionLabel>
      <FitnessRow label="Test pass rate"   value="86%" delta="−14%" trend={[100,100,100,100,100,86]} negative/>
      <FitnessRow label="Tool success"     value="100%" delta="0" trend={[100,100,100,100,100,100]}/>
      <FitnessRow label="Token efficiency" value="0.78" delta="+0.04" trend={[0.71,0.72,0.74,0.74,0.76,0.78]}/>
      <FitnessRow label="Time to PR"       value="14:22" trend={null}/>

      <Divider/>

      <SectionLabel>Permissions</SectionLabel>
      <PermRow icon="folder" name="Filesystem · ./packages/maestro-code" mode="read+write"/>
      <PermRow icon="terminal" name="Shell · npm, dotnet, git" mode="restricted"/>
      <PermRow icon="branch" name="Git · branches, commits" mode="read+write"/>
      <PermRow icon="db" name="Network · MCP servers" mode="read-only"/>
    </div>
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>{children}</div>
);
const Divider = () => <div style={{ height: 1, background: 'var(--line)', margin: '16px 0' }}/>;
const KVList = ({ rows }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
    {rows.map(([k, v]) => (
      <div key={k} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8, fontSize: 11.5 }}>
        <span className="mono" style={{ color: 'var(--fg-2)' }}>{k}</span>
        <span className="mono" style={{ color: 'var(--fg-0)' }}>{Array.isArray(v) ? v.join(', ') : v}</span>
      </div>
    ))}
  </div>
);
const FitnessRow = ({ label, value, delta, trend, negative }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{label}</div>
      {delta && <div style={{ fontSize: 10, color: negative ? 'var(--err)' : 'var(--ok)', fontFamily: 'var(--font-mono)' }}>{delta}</div>}
    </div>
    {trend && <Sparkline values={trend} width={50} height={16} color={negative ? 'var(--err)' : 'var(--accent)'}/>}
    <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-0)', width: 50, textAlign: 'right' }}>{value}</span>
  </div>
);
const PermRow = ({ icon, name, mode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 11.5 }}>
    <Icon name={icon} size={12} style={{ color: 'var(--fg-2)' }}/>
    <span style={{ flex: 1, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    <Badge variant={mode === 'read+write' ? 'ok' : mode === 'restricted' ? 'warn' : 'outline'}>{mode}</Badge>
  </div>
);

Object.assign(window, { SessionScreen });
