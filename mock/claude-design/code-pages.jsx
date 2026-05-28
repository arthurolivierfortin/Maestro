/* global React, Ic, StatusDot, Badge, Btn, Bar, Panel, Line,
   MaestroHead, MaestroBust,
   PinnedWidget, ContractWidget, SessionsTable, WorkflowTree,
   FilesTree, ModelsTable, BlockCard, TokenMeter */

const { useState: useStateP } = React;

/* ═══════════════════════════════════════════════════════════════
   PAGE · First Run — model detection, tier selection
   ═══════════════════════════════════════════════════════════════ */
const PageFirstRun = ({ onContinue }) => (
  <div className="main" style={{ overflow: 'auto' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100%' }}>
      {/* Left — hero */}
      <div style={{ padding: 40, position: 'relative', borderRight: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <MaestroHead size={120} opacity={0.5}/>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, letterSpacing: '0.18em', color: 'var(--ink-0)' }}>MAESTRO</div>
            <div className="c-ink2" style={{ marginTop: 6 }}>AI Engineering Console · v0.4.1</div>
          </div>
        </div>

        <div className="t-body" style={{ maxWidth: 480, lineHeight: 1.65 }}>
          <div className="c-ink0 b" style={{ marginBottom: 10 }}>Welcome.</div>
          <p style={{ margin: 0, marginBottom: 12 }}>
            Maestro is built on one idea: <span className="c-accent b">every action is a block</span>. Agents are blocks that compose tools, tools are blocks that hit your filesystem, workflows are blocks of blocks. Each block fulfills a <span className="c-ink0 b">contract</span> you define — inputs in, outputs out, fitness measured.
          </p>
          <p style={{ margin: 0, marginBottom: 12 }}>
            I am the assistant — I plan, route, monitor and optimize the agents that do the work. I never write your code directly. I orchestrate.
          </p>
          <p style={{ margin: 0, color: 'var(--ink-2)' }}>
            Three steps to start: pick a tier, pick a workspace, give me a task.
          </p>
        </div>

        <div className="divider" style={{ margin: '24px 0' }}/>

        <div className="t-h3" style={{ marginBottom: 12 }}>Detected on your machine</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'GPU',     v: 'RTX 4090',     d: '24 GB VRAM', ok: true },
            { label: 'RAM',     v: '64 GB',        d: '32 GB free',  ok: true },
            { label: 'Disk',    v: '470 GB',       d: 'on .git/',    ok: true },
            { label: 'Ollama',  v: 'v0.4.7',       d: '2 models',    ok: true },
            { label: 'API key', v: 'Anthropic',    d: 'sk-ant-…',    ok: true },
            { label: 'API key', v: 'OpenAI',       d: 'not set',     ok: false },
          ].map((c, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '8px 10px', background: 'var(--bg-1)' }}>
              <div className="row gap-6">
                <StatusDot status={c.ok ? 'ok' : 'err'}/>
                <span className="t-h3" style={{ margin: 0 }}>{c.label}</span>
              </div>
              <div className="mono c-ink0 b" style={{ fontSize: 13, marginTop: 4 }}>{c.v}</div>
              <div className="t-small">{c.d}</div>
            </div>
          ))}
        </div>

        <div className="divider"/>

        <div className="t-h3" style={{ marginBottom: 6 }}>Workspace</div>
        <div style={{ border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '10px 12px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic n="folder" size={16} style={{ color: 'var(--accent)' }}/>
          <div>
            <div className="mono c-ink0 b">cantante</div>
            <div className="t-small c-ink2">C:\Cantante · main · 4 ahead</div>
          </div>
          <span className="flex-1"/>
          <Btn variant="ghost" size="sm" icon="folder">Change…</Btn>
        </div>
      </div>

      {/* Right — tier selection */}
      <div style={{ padding: 40, background: 'var(--bg-1)' }}>
        <div className="t-h3" style={{ marginBottom: 14 }}>Choose a tier for this session</div>
        <div className="t-small c-ink2" style={{ marginBottom: 18 }}>
          Maestro picks the cheapest model that hits your fitness target. You can override per-block in the Catalog.
        </div>

        {[
          { tier: 'Tier 1', tag: 'frontier', sel: true,  model: 'claude-sonnet-4.5', ctx: '200K', price: '$3/$15',  ttp: '~$0.18 / task',  fit: '0.91',
            desc: 'Best quality. Use when the task is novel or the cost of being wrong is high.' },
          { tier: 'Tier 2', tag: 'balanced', sel: false, model: 'claude-haiku-4',    ctx: '200K', price: '$0.8/$4', ttp: '~$0.04 / task',  fit: '0.86',
            desc: 'Default for well-trained blocks. 4× cheaper, 1.7× faster, 5% fitness drop.' },
          { tier: 'Tier 3', tag: 'local',    sel: false, model: 'qwen-2.5-coder',    ctx: '128K', price: 'free',    ttp: 'free · 38 t/s',  fit: '0.78',
            desc: 'Runs on your RTX 4090. No network. Great for codegen with strict review.' },
        ].map((t, i) => (
          <div key={i} style={{
            border: t.sel ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: t.sel ? 'var(--accent-soft)' : 'var(--bg-0)',
            borderRadius: 'var(--radius)',
            padding: 14, marginBottom: 12, cursor: 'pointer',
            position: 'relative',
          }}>
            {t.sel && <div style={{ position: 'absolute', right: 12, top: 12 }}>
              <Badge variant="accent">selected</Badge>
            </div>}
            <div className="row gap-8" style={{ marginBottom: 6 }}>
              <span className="c-ink0 b" style={{ fontSize: 16 }}>{t.tier}</span>
              <Badge variant="outline">{t.tag}</Badge>
            </div>
            <div className="mono c-accent b" style={{ marginBottom: 2 }}>{t.model}</div>
            <div className="t-small c-ink2" style={{ marginBottom: 10 }}>{t.desc}</div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-small"><span className="c-ink3">ctx</span> <span className="mono c-ink0">{t.ctx}</span></span>
              <span className="t-small"><span className="c-ink3">$/1M</span> <span className="mono c-ink0">{t.price}</span></span>
              <span className="t-small"><span className="c-ink3">est. cost</span> <span className="mono c-ink0">{t.ttp}</span></span>
              <span className="t-small"><span className="c-ink3">fitness</span> <span className="mono c-ok b">{t.fit}</span></span>
            </div>
          </div>
        ))}

        <div className="divider"/>
        <div className="t-h3" style={{ marginBottom: 8 }}>Spending guardrail</div>
        <div className="row gap-10" style={{ alignItems: 'baseline' }}>
          <span className="t-small c-ink2">per session</span>
          <span className="mono c-ink0 b">$2.00</span>
          <span className="c-ink4">·</span>
          <span className="t-small c-ink2">per day</span>
          <span className="mono c-ink0 b">$25.00</span>
          <span className="flex-1"/>
          <Btn variant="ghost" size="sm">edit</Btn>
        </div>

        <div className="divider"/>
        <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
          <Btn variant="ghost">Customize models…</Btn>
          <Btn variant="primary" iconRight="arrowRight" onClick={onContinue}>Start session</Btn>
        </div>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   PAGE · Console — the chat (THE HERO)
   The agent here pins foundry + workflow + comparison widgets as it works
   ═══════════════════════════════════════════════════════════════ */
const PageConsole = ({ onRoute }) => (
  <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr var(--right-w)', minHeight: 0, flex: 1 }}>
      {/* Conversation main */}
      <div className="main" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Sub-header showing current session */}
        <div style={{
          padding: '12px 18px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
        }}>
          <StatusDot status="ok" pulse/>
          <span className="c-ink0 b">cantante — file-tree + commit-message agent</span>
          <Badge variant="outline" mono>ses_8af4b21c</Badge>
          <Badge variant="agent">2 workflows · 1 training</Badge>
          <span className="flex-1"/>
          <span className="kbd-hint"><span className="kbd">/</span> focus</span>
          <span className="kbd-hint"><span className="kbd">p</span> pin widget</span>
          <span className="kbd-hint"><span className="kbd">Ctrl+L</span> clear</span>
        </div>

        <div className="conv" style={{ flex: 1 }}>
          {/* === Story: User asks for two things at once. Agent uses the app === */}
          <Line ts="14:22:08" kind="user">
            add localStorage persistence to FileTree, and while you're at it, build me an agent that writes conventional-commit messages from diffs
          </Line>

          <Line ts="14:22:10" kind="agent">
            Two parallel tracks then. I'm spinning up a <span className="c-accent mono b">feature-pipeline</span> session for the FileTree work and a <span className="c-accent mono b">block-forge</span> session in the Foundry for the commit-message agent. Pinning both so you can watch in place.
          </Line>

          {/* PINNED WIDGET 1 · Live workflow (agent's primary task) */}
          <LiveWorkflowWidget focused={false}/>

          <Line ts="14:22:24" kind="agent">
            Pinned the live workflow. Coder is in step 3/7 — already wrote the hook and is currently re-running the test suite with a fixed localStorage mock.
          </Line>

          <Line ts="14:23:01" kind="agent">
            For the commit-message agent — I checked the Catalog first, no existing block fits cleanly. Forging a new one. Iterating in the Foundry now.
          </Line>

          {/* PINNED WIDGET 2 · Foundry progress (agent IS in the foundry, this widget shows it) */}
          <FoundryProgressWidget block="commit-message.generator" focused/>

          <Line ts="14:27:40" kind="agent">
            5 iterations in. Schema-constrained output at v3.4 hit <span className="c-ok b mono">0.87 fitness</span>. Comparing models against the same eval set:
          </Line>

          {/* PINNED WIDGET 3 · Model comparison */}
          <ModelComparisonWidget/>

          <Line ts="14:28:12" kind="agent">
            <span className="c-accent mono b">claude-haiku-4</span> wins on cost and fitness. 4× cheaper than the default. Routing the new agent to use it as bound model with sonnet-4.5 as fallback.
          </Line>

          <Line ts="14:28:22" kind="agent" streaming>
            Running one more iteration with temperature 0.1 — if it hits <span className="c-ok mono b">0.88</span>, I'll publish to user scope and you can use it across all your projects
          </Line>
        </div>

        {/* Input */}
        <div style={{ padding: '4px 0 12px' }}>
          <div className="input-bar">
            <span className="ip">❯</span>
            <span className="c-ink3">Ask a follow-up · or describe a new task</span>
            <span className="flex-1"/>
            <span className="t-small c-ink3"><span className="kbd">⌘K</span> commands · <span className="kbd">↑</span> history · <span className="kbd">⇧↵</span> newline</span>
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div className="right-panel">
        {/* Maestro persona block */}
        <div className="panel on-bg-1" style={{ background: 'var(--bg-2)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ marginLeft: -4 }}>
            <MaestroBust size={64} opacity={0.85}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="t-h3" style={{ margin: 0 }}>MAESTRO · in the cockpit</div>
            <div className="t-small" style={{ marginTop: 4 }}>
              Driving 2 things: <span className="c-accent b mono">file-tree</span> (coder is in implement) and forging <span className="c-accent b mono">commit-message.gen</span> in the foundry.
            </div>
            <div className="row gap-6" style={{ marginTop: 8 }}>
              <Badge variant="agent" mono>active · 2</Badge>
              <Badge variant="outline" mono>$0.42 spent</Badge>
            </div>
          </div>
        </div>

        <Panel title="WHAT I'M USING">
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.7 }}>
            <div className="c-ink3 b" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>open pages</div>
            <div><span className="c-accent">▣</span> console <span className="c-ink3">(here, talking to you)</span></div>
            <div><span className="c-accent">▣</span> foundry <span className="c-ink3">(training commit-message)</span></div>
            <div><span className="c-ink3">▢</span> spaces · session ses_8af4 <span className="c-ink3">(watching coder)</span></div>
            <div className="c-ink3 b" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 }}>using blocks</div>
            <div className="c-magenta">agent.planner v4</div>
            <div className="c-magenta">agent.coder v6</div>
            <div className="c-info">tool.edit-file v2</div>
            <div className="c-info">tool.shell v2</div>
            <div className="c-ok">block.specify v1</div>
            <div className="c-ok">block.forge v3 <span className="c-ink3">(forging new agent)</span></div>
          </div>
        </Panel>

        <Panel title="CLUSTER">
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px 10px', fontSize: 12, alignItems: 'center' }}>
            <span className="c-ink3">Backend</span>    <Bar value={26}/><span className="t-num">:5000</span>
            <span className="c-ink3">LLM Provider</span><Bar value={14}/><span className="t-num">:5010</span>
            <span className="c-ink3">SignalR</span>    <Bar value={62} variant="warn"/><span className="t-num">:5000</span>
            <span className="c-ink3">GPU</span>        <Bar value={76}/><span className="t-num">76%</span>
            <span className="c-ink3">VRAM</span>       <Bar value={76}/><span className="t-num">18/24</span>
          </div>
        </Panel>

        <Panel title="TOKEN ECONOMY">
          <TokenMeter/>
        </Panel>

        <Panel title="ACTIVITY · live">
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.7, color: 'var(--ink-2)' }}>
            <div><span className="c-ink4">14:28:22</span> <span className="c-agent">maestro</span> · queue v3.5 in foundry</div>
            <div><span className="c-ink4">14:28:12</span> <span className="c-agent">maestro</span> · pin model-comparison widget</div>
            <div><span className="c-ink4">14:27:40</span> haiku-4 wins ($0.011 · 0.87 fit)</div>
            <div><span className="c-ink4">14:24:25</span> coder · phase plan complete</div>
            <div><span className="c-ink4">14:23:01</span> <span className="c-agent">maestro</span> · open foundry</div>
            <div><span className="c-ink4">14:22:24</span> <span className="c-agent">maestro</span> · pin live-workflow widget</div>
            <div><span className="c-ink4">14:22:08</span> <span className="c-accent">user → task submitted</span></div>
          </div>
        </Panel>
      </div>
    </div>
  </>
);

/* ═══════════════════════════════════════════════════════════════
   PAGE · Workflow — keyboard-driven tree (no mouse needed)
   j/k navigate · h/l collapse/expand · Enter open · / filter
   ═══════════════════════════════════════════════════════════════ */
const WORKFLOW_TREE = [
  { id: 'wf',      depth: 0, kind: 'wf',    name: 'workflow.feature-pipeline', sub: 'on /add-feature',    dur: '14m 22s', state: 'active' },
  { id: 'planner', depth: 1, kind: 'agent', name: 'agent.planner',             sub: 'claude-sonnet-4.5',  dur: '2m 14s',  state: 'done' },
  { id: 'p-read',  depth: 2, kind: 'tool',  name: 'tool.read-file',            sub: 'FileTree.tsx',       dur: '0.4s',    state: 'done' },
  { id: 'p-read2', depth: 2, kind: 'tool',  name: 'tool.read-file',            sub: 'FileTree.test.tsx',  dur: '0.4s',    state: 'done' },
  { id: 'p-inf',   depth: 2, kind: 'inf',   name: 'inference',                 sub: '1840 tok · $0.022',  dur: '8.2s',    state: 'done' },
  { id: 'specify', depth: 1, kind: 'block', name: 'block.specify',             sub: 'schema-constrained', dur: '3m 02s',  state: 'done' },
  { id: 'coder',   depth: 1, kind: 'agent', name: 'agent.coder',               sub: 'claude-sonnet-4.5',  dur: '6m 41s',  state: 'active', focus: true },
  { id: 'c-edit',  depth: 2, kind: 'tool',  name: 'tool.edit-file',            sub: 'FileTree.tsx · 4 hunks · sha 0e8a72', dur: '1.1s', state: 'done' },
  { id: 'c-sh',    depth: 2, kind: 'tool',  name: 'tool.shell',                sub: 'npm run test -- FileTree',           dur: '4.1s', state: 'done' },
  { id: 'c-inf',   depth: 2, kind: 'inf',   name: 'inference',                 sub: '4124 in · 612 out · $0.018',         dur: '6.0s', state: 'done' },
  { id: 'c-sh2',   depth: 2, kind: 'tool',  name: 'tool.shell',                sub: 'npm run test -- FileTree --watch',   dur: '3.4s', state: 'active' },
  { id: 'c-inf2',  depth: 2, kind: 'inf',   name: 'inference',                 sub: 'queued',                              dur: null,    state: 'pending' },
  { id: 'tester',  depth: 1, kind: 'agent', name: 'agent.tester',              sub: 'gpt-4o-mini',                         dur: null,    state: 'pending' },
  { id: 'reviewer',depth: 1, kind: 'agent', name: 'agent.reviewer',            sub: 'claude-opus-4',                       dur: null,    state: 'pending' },
  { id: 'commit',  depth: 1, kind: 'tool',  name: 'tool.git',                  sub: 'commit + push',                       dur: null,    state: 'pending' },
  { id: 'pr',      depth: 1, kind: 'block', name: 'block.open-pr',             sub: 'v1',                                  dur: null,    state: 'pending' },
];

const stateMark = (s) => s === 'done' ? '✓' : s === 'active' ? '●' : s === 'failed' ? '✗' : '○';

const PageWorkflow = () => {
  const [focusIdx, setFocusIdx] = useStateP(WORKFLOW_TREE.findIndex(n => n.focus));
  const [pane, setPane] = useStateP('tree'); // tree | inspector | log

  React.useEffect(() => {
    const fn = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      // Only when this page is active — guard via routes? assume yes here.
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx(i => Math.min(WORKFLOW_TREE.length - 1, i + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'g') {
        setFocusIdx(0);
      } else if (e.key === 'G') {
        setFocusIdx(WORKFLOW_TREE.length - 1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setPane(p => p === 'tree' ? 'inspector' : p === 'inspector' ? 'log' : 'tree');
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const node = WORKFLOW_TREE[focusIdx];
  const guides = (depth) => {
    // ascii tree guides
    if (depth === 0) return '';
    if (depth === 1) return '├─ ';
    if (depth === 2) return '│  ├─ ';
    return '│  │  ├─ ';
  };

  return (
    <div className="main" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
      }}>
        <span className="c-ink2"><Ic n="graph" size={14} style={{ verticalAlign: -2 }}/> Workflow ·</span>
        <span className="mono c-ink0 b">feature-pipeline.v3</span>
        <Badge variant="ok"><span className="dot ok pulse"/> running</Badge>
        <Badge variant="outline" mono>16 nodes</Badge>
        <Badge variant="agent" mono>step 3/7</Badge>
        <span className="flex-1"/>
        <span className="kbd-hint"><span className="kbd">j/k</span> nav</span>
        <span className="kbd-hint"><span className="kbd">Tab</span> pane</span>
        <span className="kbd-hint"><span className="kbd">Enter</span> open</span>
        <span className="kbd-hint"><span className="kbd">/</span> filter</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', flex: 1, minHeight: 0 }}>
        {/* Tree pane */}
        <div className={'pane' + (pane === 'tree' ? ' focused' : '')}
             style={{ borderRight: '1px solid var(--line)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)',
                        display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-1)' }}>
            <span className="t-h3" style={{ margin: 0 }}>EXECUTION TREE</span>
            <span className="flex-1"/>
            <span className="t-small c-ink3">{focusIdx + 1} / {WORKFLOW_TREE.length}</span>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            {WORKFLOW_TREE.map((n, i) => {
              const isFocus = i === focusIdx;
              const kindClass = n.kind;
              return (
                <div key={n.id} className={'tree-row' + (isFocus ? ' focus' : '')}
                     onClick={() => setFocusIdx(i)}>
                  <span className="guides">{guides(n.depth)}</span>
                  <span className={'tree-marker ' + n.state}>{stateMark(n.state)}</span>
                  <span className="name">
                    <span className={kindClass}>{n.name}</span>
                    <span className="c-ink3"> · {n.sub}</span>
                  </span>
                  <span className="c-ink3 t-num">{n.dur || ''}</span>
                  <span className="c-ink3 t-num" style={{ textAlign: 'right' }}>
                    {n.state === 'done' ? 'ok' : n.state === 'active' ? 'live' : n.state === 'failed' ? 'err' : ''}
                  </span>
                  <span/>
                  <span className="c-ink4">{isFocus ? '❯' : ''}</span>
                </div>
              );
            })}
          </div>
          {/* Bottom legend / status */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)',
                        background: 'var(--bg-1)', display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-3)' }}>
            <span><span className="c-ok">✓</span> done</span>
            <span><span className="c-accent">●</span> active</span>
            <span><span className="c-ink4">○</span> pending</span>
            <span><span className="c-err">✗</span> failed</span>
            <span className="flex-1"/>
            <span>tokens <span className="c-ink0 b">14,209</span></span>
            <span>cost <span className="c-ink0 b">$0.21</span></span>
          </div>
        </div>

        {/* Inspector + Log stacked right */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className={'pane' + (pane === 'inspector' ? ' focused' : '')}
               style={{ borderBottom: '1px solid var(--line)', padding: 14, flex: 1, overflow: 'auto' }}>
            <div className="t-h3" style={{ marginBottom: 6 }}>SELECTED NODE</div>
            <div className="row gap-8" style={{ marginBottom: 8 }}>
              <Badge variant={node.kind === 'agent' ? 'agent' : node.kind === 'tool' ? 'accent' : node.kind === 'wf' ? 'outline' : 'ok'}>{node.kind}</Badge>
              <span className="mono c-ink0 b" style={{ fontSize: 14 }}>{node.name}</span>
            </div>
            <div className="t-small c-ink2" style={{ marginBottom: 12, lineHeight: 1.5 }}>{node.sub}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: 11.5 }}>
              <span className="c-ink3">state</span>   <span className={node.state === 'active' ? 'c-accent b' : node.state === 'done' ? 'c-ok b' : 'c-ink2'}>{node.state}</span>
              <span className="c-ink3">duration</span><span className="mono c-ink0">{node.dur || '—'}</span>
              <span className="c-ink3">depth</span>   <span className="mono c-ink0">{node.depth}</span>
              <span className="c-ink3">parent</span>  <span className="mono c-ink1">{node.depth > 0 ? WORKFLOW_TREE.slice(0, focusIdx).reverse().find(p => p.depth === node.depth - 1)?.name : '—'}</span>
            </div>

            <div className="divider dashed"/>
            <div className="t-h3" style={{ marginBottom: 6 }}>FITNESS · last 30 runs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 40px', gap: '4px 10px', fontSize: 11 }}>
              {[
                { k: 'success', v: '93%', bar: 93, good: true },
                { k: 'avg time', v: '6m 12s', bar: 70 },
                { k: 'avg cost', v: '$0.18', bar: 35 },
                { k: 'tool calls', v: '11.4', bar: 55 },
              ].map(m => (
                <React.Fragment key={m.k}>
                  <span className="c-ink2">{m.k}</span>
                  <Bar value={m.bar} variant={m.good ? 'ok' : ''}/>
                  <span className="mono c-ink0 b" style={{ textAlign: 'right' }}>{m.v}</span>
                </React.Fragment>
              ))}
            </div>

            <div className="divider dashed"/>
            <div className="t-h3" style={{ marginBottom: 4 }}>ACTIONS</div>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              <span className="kbd-hint"><span className="kbd">o</span>  open contract</span>
              <span className="kbd-hint"><span className="kbd">e</span>  edit bindings</span>
              <span className="kbd-hint"><span className="kbd">r</span>  retry from here</span>
              <span className="kbd-hint"><span className="kbd">p</span>  pin to console</span>
            </div>
          </div>

          <div className={'pane' + (pane === 'log' ? ' focused' : '')}
               style={{ padding: 14, height: 220, overflow: 'auto' }}>
            <div className="t-h3" style={{ marginBottom: 6 }}>EXECUTION LOG · tail -f</div>
            <div className="mono" style={{ fontSize: 11, lineHeight: 1.7 }}>
              {[
                { t: '14:28:24', m: <><span className="c-agent">coder</span> → tool.shell <span className="c-ink2">npm run test --watch</span></> },
                { t: '14:28:22', m: <><span className="c-agent">coder</span> thinking… missing localStorage stub</> },
                { t: '14:28:21', m: <>inference <span className="c-accent">sonnet-4.5</span> · 4124/612 · $0.018</> },
                { t: '14:28:18', m: <><span className="c-err">FAIL</span> persists open state across reload</> },
                { t: '14:28:14', m: <><span className="c-agent">coder</span> → tool.shell</> },
                { t: '14:28:11', m: <><span className="c-agent">coder</span> → tool.edit-file <span className="c-ink2">FileTree.tsx</span> (142 lines, 4 hunks)</> },
                { t: '14:24:25', m: <>phase <span className="c-ok b">plan</span> complete</> },
              ].map((l, i) => (
                <div key={i}><span className="c-ink4">{l.t}</span> {l.m}</div>
              ))}
              <div><span className="caret"/></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAGE · Spaces — Workspaces + Sessions + History (keyboard tabs)
   ═══════════════════════════════════════════════════════════════ */
const WORKSPACES = [
  { sel: true, name: 'cantante', path: 'C:\\Cantante', branch: 'main · +4',
    sessions: 3, blocks: 8, cost: '$8.42',  lastUsed: 'now' },
  { sel: false, name: 'maestro',  path: 'C:\\Meastro',  branch: 'phase-46',
    sessions: 1, blocks: 14, cost: '$1.21',  lastUsed: '32m ago' },
  { sel: false, name: 'auth-service', path: 'C:\\Work\\auth', branch: 'fix/sso',
    sessions: 1, blocks: 2,  cost: '$0.09',  lastUsed: '8m ago' },
  { sel: false, name: 'web',      path: 'C:\\Work\\web', branch: 'feat/sso',
    sessions: 0, blocks: 4,  cost: '$0.02',  lastUsed: '1d ago' },
];

const SESSIONS_DATA = [
  { sel: true,  dot: 'ok',   pulse: true, name: 'cantante — file-tree module',         id: 'ses_8af4', phase: 'implement 3/7', agent: 'coder',    tokens: '14.2k', cost: '$0.21', elapsed: '14m 22s', tier: 'Tier 1', ws: 'cantante' },
  { sel: false, dot: 'ok',   pulse: true, name: 'maestro — telemetry backfill',        id: 'ses_71bc', phase: 'gen tests',     agent: 'tester',   tokens: '38.4k', cost: '$0.62', elapsed: '32m 04s', tier: 'Tier 1', ws: 'maestro' },
  { sel: false, dot: 'ok',   pulse: true, name: 'cantante — commit-agent training',    id: 'ses_29de', phase: 'benchmark',     agent: 'foundry',  tokens: '124k',  cost: '$1.84', elapsed: '1h 12m',  tier: 'Tier 2', ws: 'cantante' },
  { sel: false, dot: 'warn',              name: 'auth-service — review pass',          id: 'ses_4a09', phase: 'awaiting',      agent: 'reviewer', tokens: '5.8k',  cost: '$0.09', elapsed: '8m 41s',  tier: 'Tier 1', ws: 'auth-service' },
  { sel: false, dot: 'ok',                name: 'cantante — dependency upgrade',       id: 'ses_e2c1', phase: 'PR #284',       agent: 'coder',    tokens: '22.1k', cost: '$0.34', elapsed: '23m 11s', tier: 'Tier 2', ws: 'cantante' },
  { sel: false, dot: 'err',               name: 'web — sso integration',               id: 'ses_bc89', phase: 'tool denied',   agent: 'coder',    tokens: '1.2k',  cost: '$0.02', elapsed: '4m 02s',  tier: 'Tier 1', ws: 'web' },
  { sel: false, dot: 'idle',              name: 'cantante — refactor stores',          id: 'ses_82a1', phase: 'completed',     agent: 'coder',    tokens: '18.4k', cost: '$0.28', elapsed: '17m 49s', tier: 'Tier 2', ws: 'cantante' },
  { sel: false, dot: 'idle',              name: 'maestro — docs pass',                 id: 'ses_3f4c', phase: 'completed',     agent: 'reviewer', tokens: '8.9k',  cost: '$0.14', elapsed: '11m 22s', tier: 'Tier 3', ws: 'maestro' },
];

const PageSpaces = ({ onRoute }) => {
  const [tab, setTab] = useStateP('workspaces');
  const [wsFocus, setWsFocus] = useStateP(0);
  const [seFocus, setSeFocus] = useStateP(0);

  React.useEffect(() => {
    const fn = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'w') setTab('workspaces');
      else if (e.key === 's' && !e.ctrlKey && !e.metaKey) setTab('sessions');
      else if (e.key === 'H') setTab('history');
      else if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (tab === 'workspaces') setWsFocus(i => Math.min(WORKSPACES.length - 1, i + 1));
        else setSeFocus(i => Math.min(SESSIONS_DATA.length - 1, i + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (tab === 'workspaces') setWsFocus(i => Math.max(0, i - 1));
        else setSeFocus(i => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [tab]);

  return (
    <div className="main" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
      }}>
        <span className="c-ink2"><Ic n="folder" size={14} style={{ verticalAlign: -2 }}/> Spaces</span>
        <Badge variant="outline">4 workspaces</Badge>
        <Badge variant="ok"><span className="dot ok pulse"/> 3 sessions running</Badge>
        <span className="flex-1"/>
        <span className="kbd-hint"><span className="kbd">w</span>/<span className="kbd">s</span>/<span className="kbd">H</span> tab</span>
        <span className="kbd-hint"><span className="kbd">j/k</span> nav</span>
        <span className="kbd-hint"><span className="kbd">Enter</span> open</span>
        <span className="kbd-hint"><span className="kbd">n</span> new</span>
      </div>

      <div className="subtabs">
        <div className={'subtab' + (tab === 'workspaces' ? ' active' : '')} onClick={() => setTab('workspaces')}>
          <Ic n="folder" size={12}/> Workspaces <span className="count">{WORKSPACES.length}</span>
          <span className="kbd" style={{ marginLeft: 6, fontSize: 9 }}>w</span>
        </div>
        <div className={'subtab' + (tab === 'sessions' ? ' active' : '')} onClick={() => setTab('sessions')}>
          <Ic n="activity" size={12}/> Sessions <span className="count">{SESSIONS_DATA.length}</span>
          <span className="kbd" style={{ marginLeft: 6, fontSize: 9 }}>s</span>
        </div>
        <div className={'subtab' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>
          <Ic n="history" size={12}/> History <span className="count">128</span>
          <span className="kbd" style={{ marginLeft: 6, fontSize: 9 }}>H</span>
        </div>
        <span style={{ flex: 1 }}/>
      </div>

      {tab === 'workspaces' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, minHeight: 0 }}>
          <div>
            {WORKSPACES.map((w, i) => (
              <div key={w.name}
                   className={'kb-row' + (i === wsFocus ? ' focus' : '')}
                   onClick={() => setWsFocus(i)}
                   style={{
                     gridTemplateColumns: '14px 20px 1fr 100px 80px 90px 90px 14px',
                     gap: 12,
                     border: '1px solid ' + (i === wsFocus ? 'var(--accent)' : 'var(--line)'),
                     borderRadius: 'var(--radius)',
                     marginBottom: 8,
                     padding: '10px 12px',
                     background: i === wsFocus ? 'var(--accent-soft)' : 'var(--bg-1)',
                   }}>
                <span className="gutter">{i === wsFocus ? '❯' : ' '}</span>
                <span><Ic n="folder" size={14} style={{ color: w.sel ? 'var(--accent)' : 'var(--ink-3)' }}/></span>
                <div>
                  <div className="row gap-8">
                    <span className="mono c-ink0 b" style={{ fontSize: 13 }}>{w.name}</span>
                    {w.sel && <Badge variant="accent">active</Badge>}
                  </div>
                  <div className="t-small c-ink3 mono" style={{ marginTop: 2 }}>{w.path} · {w.branch}</div>
                </div>
                <div><div className="t-small c-ink3 uc">Sessions</div><div className="mono c-ink0 b">{w.sessions}</div></div>
                <div><div className="t-small c-ink3 uc">Blocks</div><div className="mono c-ink0 b">{w.blocks}</div></div>
                <div><div className="t-small c-ink3 uc">Cost 24h</div><div className="mono c-ink0 b">{w.cost}</div></div>
                <div><div className="t-small c-ink3 uc">Last</div><div className="mono c-ink1">{w.lastUsed}</div></div>
                <span className="c-ink4">{i === wsFocus ? <Ic n="arrowRight" size={12}/> : ''}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <span className="kbd-hint"><span className="kbd">o</span> open</span>
              <span style={{ marginLeft: 16 }}/>
              <span className="kbd-hint"><span className="kbd">n</span> add workspace</span>
              <span style={{ marginLeft: 16 }}/>
              <span className="kbd-hint"><span className="kbd">x</span> remove</span>
            </div>
          </div>

          {/* Right detail */}
          <Panel title="WORKSPACE · cantante" focused>
            <div className="mono c-ink2" style={{ fontSize: 11, marginBottom: 8 }}>{WORKSPACES[wsFocus].path}</div>
            <div className="row gap-8" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              <Badge variant="ok"><span className="dot ok pulse"/> live</Badge>
              <Badge variant="outline" mono>{WORKSPACES[wsFocus].branch}</Badge>
              <Badge variant="agent" mono>cantante/core</Badge>
            </div>
            <div className="divider dashed"/>
            <div className="t-h3" style={{ marginBottom: 4 }}>Active sessions</div>
            {SESSIONS_DATA.filter(s => s.ws === WORKSPACES[wsFocus].name && (s.dot === 'ok' || s.dot === 'warn')).map((s, i) => (
              <div key={i} className="row gap-8" style={{ padding: '4px 0', fontSize: 12 }}>
                <StatusDot status={s.dot} pulse={s.pulse}/>
                <span className="mono c-ink0 b">{s.name}</span>
                <span className="flex-1"/>
                <span className="c-ink3">{s.elapsed}</span>
              </div>
            ))}
            <div className="divider dashed"/>
            <div className="t-h3" style={{ marginBottom: 4 }}>Workspace blocks</div>
            <div className="t-small c-ink2">8 blocks scoped to this workspace · 6 published as user, 2 still in foundry.</div>
            <div className="divider dashed"/>
            <div className="row gap-6">
              <Btn variant="primary" size="sm" icon="chat">Open console</Btn>
              <Btn variant="outline" size="sm" icon="graph">Workflow</Btn>
              <Btn variant="ghost" size="sm" icon="catalog">Blocks…</Btn>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'sessions' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ padding: '10px 18px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--line-soft)' }}>
            <span className="t-small c-ink2">Filter:</span>
            <Btn variant="ghost" size="sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>All <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>1</span></Btn>
            <Btn variant="ghost" size="sm">Running <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>2</span></Btn>
            <Btn variant="ghost" size="sm">Paused <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>3</span></Btn>
            <Btn variant="ghost" size="sm">Completed <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>4</span></Btn>
            <Btn variant="ghost" size="sm">Failed <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>5</span></Btn>
            <span className="flex-1"/>
            <Btn variant="primary" size="sm" icon="plus">New session  <span className="kbd" style={{ background: 'transparent', borderColor: 'rgba(0,0,0,0.2)' }}>n</span></Btn>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 14 }}/><th>Session</th><th>Workspace</th><th>Phase</th><th>Agent</th>
                <th>Tokens</th><th>Cost</th><th>Elapsed</th><th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {SESSIONS_DATA.map((s, i) => (
                <tr key={i} className={i === seFocus ? 'active' : ''} onClick={() => setSeFocus(i)}>
                  <td><StatusDot status={s.dot} pulse={s.pulse}/></td>
                  <td>
                    <div className="row gap-6">
                      <span className="c-ink4 mono" style={{ width: 14 }}>{i === seFocus ? '❯' : ''}</span>
                      <span className="c-ink0 b">{s.name}</span>
                      <span className="c-ink3" style={{ fontSize: 11 }}>{s.id}</span>
                    </div>
                  </td>
                  <td><Badge variant="outline" mono>{s.ws}</Badge></td>
                  <td className="c-ink2">{s.phase}</td>
                  <td><Badge variant="agent">{s.agent}</Badge></td>
                  <td className="t-num c-ink1">{s.tokens}</td>
                  <td className="t-num c-ink1">{s.cost}</td>
                  <td className="t-num c-ink2">{s.elapsed}</td>
                  <td><Badge variant={s.tier.includes('1') ? 'accent' : s.tier.includes('2') ? 'outline' : 'warn'} mono>{s.tier}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div className="t-h3" style={{ marginBottom: 10 }}>Session history · last 30 days</div>
          {/* Calendar heat-strip */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 18 }}>
            {Array.from({ length: 30 }).map((_, i) => {
              const v = (Math.sin(i * 1.31) + 1) / 2;
              const opacity = v < 0.2 ? 0.1 : v < 0.5 ? 0.4 : v < 0.8 ? 0.7 : 1.0;
              return <div key={i} title={`day ${i+1}: ${Math.round(v*8)} sessions`}
                style={{ width: 30, height: 24, background: 'var(--accent)', opacity }}/>;
            })}
          </div>
          <div className="t-small c-ink3" style={{ marginBottom: 18 }}>128 sessions · avg 4.3 / day · best day Tue 18 (12 sessions)</div>

          <div className="t-h3" style={{ marginBottom: 10 }}>Recent</div>
          <table className="tbl">
            <thead><tr><th>When</th><th>Session</th><th>Outcome</th><th>Cost</th><th>Tokens</th></tr></thead>
            <tbody>
              {[
                { w: 'just now', n: 'cantante — file-tree module',     o: 'running',   c: '$0.21', t: '14.2k' },
                { w: '32m ago',  n: 'maestro — telemetry backfill',    o: 'running',   c: '$0.62', t: '38.4k' },
                { w: '2h ago',   n: 'cantante — refactor stores',      o: 'shipped',   c: '$0.28', t: '18.4k' },
                { w: '4h ago',   n: 'web — sso integration',           o: 'failed',    c: '$0.02', t: '1.2k' },
                { w: 'yesterday',n: 'maestro — docs pass',             o: 'shipped',   c: '$0.14', t: '8.9k' },
                { w: 'yesterday',n: 'cantante — dependency upgrade',   o: 'shipped',   c: '$0.34', t: '22.1k' },
              ].map((r, i) => (
                <tr key={i}>
                  <td className="c-ink2">{r.w}</td>
                  <td className="c-ink0 b">{r.n}</td>
                  <td><Badge variant={r.o === 'shipped' ? 'ok' : r.o === 'failed' ? 'err' : 'accent'}>{r.o}</Badge></td>
                  <td className="mono">{r.c}</td>
                  <td className="mono c-ink2">{r.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* Keep PageSessions as a thin wrapper for backwards compat */
const PageSessions = PageSpaces;

/* ═══════════════════════════════════════════════════════════════
   PAGE · Catalog (Blocks) — agents + workflows + tools + inference
   Top-level tabs because Agents and Workflows are the two main artifacts
   ═══════════════════════════════════════════════════════════════ */
const PageCatalog = ({ onOpen, onRoute }) => {
  const [tab, setTab] = useStateP('agents');
  const [scope, setScope] = useStateP('all');
  const blocks = [
    { type: 'agent', id: 'agent.planner',     v: 'v4',   scope: 'global', desc: 'Decomposes a task into ordered, atomic steps. Outputs a Plan.', fit: 0.91, uses: 1240,  cost: '$0.08',  tools: ['read-file','shell'], publisher: 'maestro/core' },
    { type: 'agent', id: 'agent.coder',       v: 'v6',   scope: 'global', desc: 'Implements code changes from a plan. Composes edit-file + shell + git.', fit: 0.88, uses: 3402,  cost: '$0.18',  tools: ['edit-file','shell','git'], publisher: 'maestro/core', agentInControl: true },
    { type: 'agent', id: 'agent.reviewer',    v: 'v3',   scope: 'global', desc: 'Critiques a patch for quality, security, and project conventions.', fit: 0.84, uses: 1810,  cost: '$0.11',  tools: ['read-file'], publisher: 'maestro/core' },
    { type: 'agent', id: 'agent.tester',      v: 'v3',   scope: 'global', desc: 'Generates and runs tests against a patch. Reports failing cases.', fit: 0.79, uses: 940,   cost: '$0.09',  tools: ['edit-file','shell'], publisher: 'maestro/core' },
    { type: 'agent', id: 'agent.debugger',    v: 'v2',   scope: 'user',   desc: 'Investigates failing tests, produces hypotheses, proposes fixes.', fit: 0.74, uses: 188,   cost: '$0.22',  tools: ['read-file','shell','edit-file'], publisher: 'you' },
    { type: 'agent', id: 'commit-message.generator', v: 'v3.5', scope: 'user', desc: 'Conventional-commit message from a diff. Schema-constrained.', fit: 0.89, uses: 612, cost: '$0.012', publisher: 'you', agentInControl: true },
    { type: 'tool',  id: 'tool.shell',        v: 'v2',   scope: 'global', desc: 'Sandboxed shell with allowlisted commands. Bash + PowerShell.', fit: null, uses: 18420, cost: '$0',     publisher: 'maestro/core' },
    { type: 'tool',  id: 'tool.edit-file',    v: 'v2',   scope: 'global', desc: 'Patch-based file editor with built-in diff preview.', fit: null, uses: 9210,  cost: '$0',     publisher: 'maestro/core' },
    { type: 'tool',  id: 'tool.git',          v: 'v1',   scope: 'global', desc: 'Branches, commits, opens PRs. Respects sign-off rules.', fit: null, uses: 5210,  cost: '$0',     publisher: 'maestro/core' },
    { type: 'tool',  id: 'tool.validator',    v: 'v1',   scope: 'global', desc: 'Validates JSON / YAML against a schema. Used by every contract.', fit: null, uses: 1140,  cost: '$0',     publisher: 'maestro/core' },
    { type: 'workflow', id: 'workflow.feature-pipeline', v: 'v3', scope: 'project', desc: 'Plan → Code → Test → Review → Commit. The default coding workflow.', fit: 0.86, uses: 218,  cost: '$0.42', publisher: 'cantante' },
    { type: 'workflow', id: 'workflow.bugfix-loop',      v: 'v2', scope: 'project', desc: 'Repro → fix → regression test. Loops up to 3× on failure.', fit: 0.81, uses: 84,   cost: '$0.28', publisher: 'cantante' },
    { type: 'workflow', id: 'workflow.block-forge',      v: 'v3', scope: 'global',  desc: 'Spec → forge → benchmark → publish a new block. Maestro uses this to create agents.', fit: 0.88, uses: 162, cost: '$1.20', publisher: 'maestro/core', agentInControl: true },
    { type: 'inference', id: 'inf.diff-summary',    v: 'v2',   scope: 'global', desc: 'Single-shot diff summarizer. JSON output, no tools.', fit: 0.82, uses: 4210, cost: '$0.004', publisher: 'maestro/core' },
    { type: 'inference', id: 'inf.commit-type',     v: 'v1',   scope: 'user',   desc: 'Classifies a diff into conventional-commit type (feat/fix/chore/…).', fit: 0.93, uses: 612, cost: '$0.002', publisher: 'you' },
  ];

  const tabFilter = (b) => {
    if (tab === 'all') return true;
    if (tab === 'mine') return b.scope === 'user';
    return b.type === tab.slice(0, -1); // 'agents' -> 'agent'
  };
  const visible = blocks.filter(b =>
    tabFilter(b) &&
    (scope === 'all' || b.scope === scope)
  );
  const counts = {
    agents:   blocks.filter(b => b.type === 'agent').length,
    workflows:blocks.filter(b => b.type === 'workflow').length,
    tools:    blocks.filter(b => b.type === 'tool').length,
    inferences:blocks.filter(b => b.type === 'inference').length,
    mine:     blocks.filter(b => b.scope === 'user').length,
    all:      blocks.length,
  };

  return (
    <div className="main" style={{ overflow: 'auto' }}>
      <AgentBanner
        title="Maestro just published a block here"
        activity="commit-message.generator v3.5 · published to user scope"
        cta="see in console"
        kbd="1"/>

      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
      }}>
        <span className="c-ink2"><Ic n="blocks" size={14} style={{ verticalAlign: -2 }}/> Blocks</span>
        <Badge variant="outline">{blocks.length} total</Badge>
        <Badge variant="ok">12 yours</Badge>
        <span className="flex-1"/>
        <div className="input-bar" style={{ margin: 0, padding: '4px 10px', minWidth: 280 }}>
          <Ic n="search" size={13} style={{ color: 'var(--ink-3)' }}/>
          <span className="c-ink3" style={{ fontSize: 12 }}>Search blocks · publisher · tag…</span>
          <span className="kbd">/</span>
        </div>
        <Btn variant="outline" size="sm" icon="download">Import</Btn>
        <Btn variant="primary" size="sm" icon="upload">Publish</Btn>
      </div>

      {/* Type sub-tabs — Agents + Workflows are the two primaries */}
      <div className="subtabs">
        {[
          { id: 'agents',     label: 'Agents',     count: counts.agents,     ic: 'user',     kbd: 'a', primary: true },
          { id: 'workflows',  label: 'Workflows',  count: counts.workflows,  ic: 'graph',    kbd: 'w', primary: true },
          { id: 'tools',      label: 'Tools',      count: counts.tools,      ic: 'terminal', kbd: 't' },
          { id: 'inferences', label: 'Inference',  count: counts.inferences, ic: 'sparkle',  kbd: 'i' },
          { id: 'mine',       label: 'Mine',       count: counts.mine,       ic: 'user',     kbd: 'm' },
          { id: 'all',        label: 'All',        count: counts.all,        ic: 'catalog',  kbd: '0' },
        ].map(o => (
          <div key={o.id} className={'subtab' + (tab === o.id ? ' active' : '')} onClick={() => setTab(o.id)}>
            <Ic n={o.ic} size={12}/>
            <span style={{ fontWeight: o.primary ? 700 : 500 }}>{o.label}</span>
            <span className="count">{o.count}</span>
            <span className="kbd" style={{ marginLeft: 4, fontSize: 9 }}>{o.kbd}</span>
          </div>
        ))}
        <span style={{ flex: 1 }}/>
        <span className="c-ink3 t-small" style={{ alignSelf: 'center', paddingRight: 16 }}>
          {tab === 'agents' && 'Agents compose blocks to do work. The main thing you build.'}
          {tab === 'workflows' && 'Workflows orchestrate agents in DAGs. Non-atomic blocks.'}
          {tab === 'tools' && 'Atomic blocks. The primitives agents use.'}
          {tab === 'inferences' && 'Single-shot LLM calls. No tools. Cheapest type.'}
          {tab === 'mine' && 'Blocks you authored. Promote to project or global from Foundry.'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: 0 }}>
        <div style={{ padding: 18, borderRight: '1px solid var(--line)' }}>
          <div className="t-h3" style={{ marginBottom: 6 }}>Scope</div>
          {[
            { id: 'all', label: 'All scopes', count: blocks.length, ic: 'catalog' },
            { id: 'project', label: 'Project', count: blocks.filter(b=>b.scope==='project').length, ic: 'folder' },
            { id: 'user', label: 'User',    count: blocks.filter(b=>b.scope==='user').length, ic: 'user' },
            { id: 'global', label: 'Global', count: blocks.filter(b=>b.scope==='global').length, ic: 'plug' },
          ].map(o => (
            <div key={o.id}
              onClick={() => setScope(o.id)}
              style={{
                padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                background: scope === o.id ? 'var(--accent-soft)' : 'transparent',
                color: scope === o.id ? 'var(--accent)' : 'var(--ink-1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2,
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Ic n={o.ic} size={11}/> {o.label}
              </span>
              <span className="c-ink3 t-num">{o.count}</span>
            </div>
          ))}
          <div className="divider"/>
          <div className="t-h3" style={{ marginBottom: 6 }}>Sort</div>
          {['usage', 'fitness', 'recent', 'cost'].map(o => (
            <div key={o} style={{ padding: '4px 8px', fontSize: 12, color: o === 'usage' ? 'var(--accent)' : 'var(--ink-1)' }}>
              {o === 'usage' && '❯ '}{o}
            </div>
          ))}
          <div className="divider"/>
          <div className="t-h3" style={{ marginBottom: 6 }}>Tags</div>
          <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
            {['codegen','review','test','planning','refactor','docs','security','schema'].map(t => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
          <div className="divider"/>
          <div className="t-h3" style={{ marginBottom: 8 }}>Forge new</div>
          <div className="t-small c-ink2" style={{ lineHeight: 1.5, marginBottom: 8 }}>
            Tell Maestro what you want. It'll forge it in the foundry, benchmark it, then publish.
          </div>
          <Btn variant="outline" size="sm" icon="sparkle" style={{ width: '100%' }} onClick={() => onRoute?.('console')}>
            Open console
          </Btn>
        </div>

        <div style={{ padding: 18 }}>
          <div className="row gap-12" style={{ marginBottom: 12 }}>
            <span className="t-small c-ink2">{visible.length} blocks</span>
            <span className="flex-1"/>
            <span className="kbd-hint"><span className="kbd">j/k</span> nav</span>
            <span className="kbd-hint"><span className="kbd">Enter</span> open</span>
            <span className="kbd-hint"><span className="kbd">p</span> publish</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
            {visible.map(b => (
              <div key={b.id} style={{ position: 'relative' }}>
                {b.agentInControl && (
                  <span style={{
                    position: 'absolute', top: -7, right: 10, zIndex: 2,
                    background: 'var(--bg-0)', padding: '0 6px',
                    fontSize: 9, color: 'var(--agent)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    border: '1px dashed var(--agent)',
                    borderRadius: 3,
                  }}>
                    <Ic n="user" size={9} style={{ verticalAlign: -1 }}/> agent active
                  </span>
                )}
                <BlockCard b={b} onClick={() => onRoute?.('block')}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAGE · Block / Contract detail
   ═══════════════════════════════════════════════════════════════ */
const PageBlock = ({ id = 'agent.coder', onRoute }) => (
  <div className="main" style={{ overflow: 'auto', padding: 24 }}>
    <div className="row gap-12" style={{ marginBottom: 18 }}>
      <Btn variant="ghost" size="sm" icon="chevronDown" onClick={() => onRoute?.('catalog')} style={{ transform: 'rotate(90deg)' }}/>
      <span className="t-small c-ink3 uc">Catalog · agent ·</span>
      <span className="mono c-ink0 b" style={{ fontSize: 18 }}>{id}</span>
      <Badge variant="outline" mono>v6</Badge>
      <Badge variant="agent">global</Badge>
      <span className="flex-1"/>
      <Btn variant="ghost" icon="git">Source</Btn>
      <Btn variant="outline" icon="play">Run in playground</Btn>
      <Btn variant="primary" icon="bolt">Train in Foundry</Btn>
    </div>

    <div className="t-body" style={{ maxWidth: 720, marginBottom: 18 }}>
      Implements code changes given a plan and a workspace. Composes
      <span className="mono c-ink0"> tool.edit-file</span>, <span className="mono c-ink0">tool.shell</span>,
      and <span className="mono c-ink0">tool.git</span>. Asks the bound model for one hunk at a time and validates
      against the contract before emitting the patch.
    </div>

    {/* Contract */}
    <Panel title="CONTRACT" focused>
      <ContractWidget block={id}/>
    </Panel>

    <div style={{ height: 16 }}/>

    {/* Stats + Iterations side-by-side */}
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
      <Panel title="FITNESS · last 30 runs">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px', fontSize: 12 }}>
          {[
            { k: 'Success rate', v: '93%',     bar: 93,  good: true },
            { k: 'Avg time',      v: '6m 12s', bar: 70 },
            { k: 'Avg cost',      v: '$0.18',  bar: 35 },
            { k: 'Tool calls',    v: '11.4',   bar: 55 },
            { k: 'Token / patch', v: '4,218',  bar: 42 },
            { k: 'Patch accept',  v: '88%',    bar: 88, good: true },
          ].map((m, i) => (
            <React.Fragment key={i}>
              <div>
                <div className="c-ink2">{m.k}</div>
                <div className="mono c-ink0 b">{m.v}</div>
              </div>
              <div style={{ width: 80, alignSelf: 'center' }}><Bar value={m.bar} variant={m.good ? 'ok' : ''}/></div>
            </React.Fragment>
          ))}
        </div>
      </Panel>

      <Panel title="ITERATIONS · self-improving" meta="12 since v6">
        <table className="tbl">
          <thead>
            <tr><th style={{ width: 14 }}/><th>Ver</th><th>Change</th><th>Model</th><th>Fitness</th><th>Cost/run</th></tr>
          </thead>
          <tbody>
            {[
              { st: 'idle', v: 'v6.0', change: 'baseline',                     model: 'claude-sonnet-4.5', f: '0.71', c: '$0.020', cls: '' },
              { st: 'ok',   v: 'v6.1', change: 'add few-shot examples',        model: 'claude-sonnet-4.5', f: '0.78', c: '$0.022', cls: 'c-ok' },
              { st: 'err',  v: 'v6.2', change: 'cheaper backbone',             model: 'gpt-4o-mini',        f: '0.74', c: '$0.008', cls: 'c-err' },
              { st: 'ok',   v: 'v6.3', change: 'add diff summarization',       model: 'claude-haiku-4',     f: '0.82', c: '$0.010', cls: 'c-ok' },
              { st: 'ok',   v: 'v6.4', change: 'schema-constrained output',    model: 'claude-haiku-4',     f: '0.87', c: '$0.011', cls: 'c-ok' },
              { st: 'ok',   v: 'v6.5', change: 'temperature 0.3 → 0.1',        model: 'claude-haiku-4',     f: '0.89', c: '$0.012', cls: 'c-ok' },
              { st: 'active', v: 'v6.6', change: 'patch-level reflection',     model: 'claude-haiku-4',     f: '— ',  c: '— ',     cls: 'c-accent' },
            ].map((r, i) => (
              <tr key={i} className={r.st === 'active' ? 'active' : ''}>
                <td><StatusDot status={r.st === 'active' ? 'ok' : r.st === 'err' ? 'err' : 'idle'} pulse={r.st==='active'}/></td>
                <td className="mono c-ink2">{r.v}</td>
                <td className="c-ink1">{r.change}</td>
                <td className="mono c-ink2">{r.model}</td>
                <td className={'mono b ' + (r.cls || 'c-ink0')}>{r.f}</td>
                <td className="mono c-ink2">{r.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   PAGE · Foundry — self-improving training (agent at the wheel)
   ═══════════════════════════════════════════════════════════════ */
const PageFoundry = () => {
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
    <div className="main" style={{ overflow: 'auto' }}>
      <AgentBanner
        title="Maestro is driving this training"
        activity="iterating commit-message.generator · v3.4 → v3.5 in queue"
        cta="see in console"
        kbd="1"/>

      <div style={{ padding: '14px 24px 0' }}>
        <div className="row gap-12" style={{ marginBottom: 18 }}>
          <Ic n="foundry" size={18} style={{ color: 'var(--accent)' }}/>
          <span className="t-h1">Foundry</span>
          <span className="c-ink2">— train, benchmark and publish blocks</span>
          <span className="flex-1"/>
          <span className="kbd-hint"><span className="kbd">j/k</span> rows</span>
          <span className="kbd-hint"><span className="kbd">p</span> publish</span>
          <Btn variant="outline" icon="history">History</Btn>
          <Btn variant="primary" icon="plus">New training</Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 18 }}>
          <Panel title="IN FOUNDRY" flush>
            {[
              { sel: true,  st: 'training',  name: 'commit-message.generator', v: 'v3.5', from: '0.71', to: '0.89', who: 'agent.maestro' },
              { sel: false, st: 'idle',      name: 'pr.reviewer',               v: 'v2',   from: '0.62', to: '0.76', who: 'you' },
              { sel: false, st: 'published', name: 'agent.planner',             v: 'v4',   from: '0.82', to: '0.91', who: 'maestro/core' },
              { sel: false, st: 'idle',      name: 'docs.summarizer',           v: 'v1',   from: '0.58', to: '0.58', who: 'you' },
            ].map((b, i) => (
              <div key={i} style={{
                padding: '12px 14px', borderTop: i ? '1px solid var(--line-soft)' : 'none',
                background: b.sel ? 'var(--accent-soft)' : 'transparent',
                borderLeft: b.sel ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}>
                <div className="row gap-8">
                  <StatusDot status={b.st === 'training' ? 'ok' : b.st === 'published' ? 'idle' : 'idle'} pulse={b.st === 'training'}/>
                  <span className="mono c-ink0 b" style={{ flex: 1 }}>{b.name}</span>
                  <Badge variant="outline" mono>{b.v}</Badge>
                </div>
                <div className="row gap-6" style={{ fontSize: 11, marginTop: 6, color: 'var(--ink-2)' }}>
                  <span className="mono">{b.from}</span>
                  <Ic n="arrowRight" size={10}/>
                  <span className="mono c-ok b">{b.to}</span>
                  <span className="flex-1"/>
                  <span className="c-agent" style={{ fontSize: 10 }}>{b.who}</span>
                </div>
              </div>
            ))}
          </Panel>

          <div className="stack gap-16">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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

            <Panel title="BENCHMARK MATRIX" meta="6 models × 6 examples">
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
              <div className="row gap-12" style={{ marginTop: 8, padding: '0 4px', fontSize: 11, color: 'var(--ink-3)' }}>
                <span><span style={{ background: 'var(--ok-soft)', padding: '0 6px', color: 'var(--ok)' }} className="mono">0.85+</span> winner</span>
                <span><span style={{ background: 'var(--warn-soft)', padding: '0 6px', color: 'var(--warn)' }} className="mono">0.55-0.7</span> needs work</span>
                <span><span style={{ background: 'var(--err-soft)', padding: '0 6px', color: 'var(--err)' }} className="mono">&lt;0.55</span> failing</span>
                <span className="flex-1"/>
                <span>Winner: <span className="c-accent b mono">claude-haiku-4</span> — 4× cheaper than baseline</span>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAGE · Models (full registry)
   ═══════════════════════════════════════════════════════════════ */
const PageModels = () => {
  const [sel, setSel] = useStateP('claude-sonnet-4.5');
  return (
    <div className="main" style={{ overflow: 'auto' }}>
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
      }}>
        <span className="c-ink2"><Ic n="cpu" size={14} style={{ verticalAlign: -2 }}/> Models</span>
        <Badge variant="ok"><span className="dot ok pulse"/> 3 providers online</Badge>
        <span className="flex-1"/>
        <Btn variant="ghost" size="sm" icon="history">Latency log</Btn>
        <Btn variant="outline" size="sm" icon="bolt">Probe all</Btn>
        <Btn variant="primary" size="sm" icon="plus">Add model</Btn>
      </div>

      {/* Hardware bar */}
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, borderBottom: '1px solid var(--line)' }}>
        {[
          { k: 'GPU',  v: 'RTX 4090',     d: '24 GB · 76°C', bar: 76 },
          { k: 'VRAM', v: '18.4 / 24 GB', d: 'qwen-2.5-coder', bar: 76 },
          { k: 'CPU',  v: 'i9-13900K',    d: '12% load', bar: 12 },
          { k: 'RAM',  v: '32 / 64 GB',   d: '50%', bar: 50 },
        ].map(c => (
          <div key={c.k} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-1)' }}>
            <div className="t-h3">{c.k}</div>
            <div className="mono c-ink0 b" style={{ fontSize: 16, marginTop: 2 }}>{c.v}</div>
            <div className="t-small c-ink2">{c.d}</div>
            <div style={{ marginTop: 6 }}><Bar value={c.bar}/></div>
          </div>
        ))}
      </div>

      <div style={{ padding: 18 }}>
        <ModelsTable selected={sel} onSelect={setSel}/>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAGE · Providers
   ═══════════════════════════════════════════════════════════════ */
const PageProviders = () => (
  <div className="main" style={{ padding: 24, overflow: 'auto' }}>
    <div className="row gap-12" style={{ marginBottom: 18 }}>
      <Ic n="plug" size={18} style={{ color: 'var(--accent)' }}/>
      <span className="t-h1">Providers</span>
      <span className="c-ink2">— LLM Provider service (:5010) routes inference</span>
      <span className="flex-1"/>
      <Btn variant="outline" size="sm" icon="bolt">Probe</Btn>
      <Btn variant="primary" size="sm" icon="plus">Add provider</Btn>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      {[
        { name: 'Anthropic', tag: 'API', st: 'online',  models: 3, today: '$6.21', key: 'sk-ant-…fh2k' },
        { name: 'OpenAI',    tag: 'API', st: 'unset',   models: 2, today: '$0.00', key: 'not set' },
        { name: 'Ollama',    tag: 'local', st: 'online',  models: 2, today: 'free',  key: 'localhost:11434' },
        { name: 'Azure',     tag: 'API', st: 'offline', models: 1, today: '—',     key: 'sk-az…3jks' },
      ].map(p => (
        <Panel key={p.name} title={p.name.toUpperCase()} meta={p.tag}>
          <div className="row gap-12" style={{ marginBottom: 10 }}>
            <span>
              {p.st === 'online'  ? <Badge variant="ok"><span className="dot ok pulse"/> online</Badge> :
               p.st === 'offline' ? <Badge variant="err">offline</Badge> :
                                    <Badge variant="warn">not configured</Badge>}
            </span>
            <span className="t-small c-ink2"><span className="mono c-ink0 b">{p.models}</span> models · <span className="mono c-ink0">{p.today}</span> spent today</span>
            <span className="flex-1"/>
            <Btn variant="ghost" size="sm">Edit</Btn>
          </div>
          <div className="t-h3">Key / endpoint</div>
          <div className="mono c-ink2" style={{ fontSize: 12 }}>{p.key}</div>
        </Panel>
      ))}
    </div>

    <div className="divider"/>
    <div className="t-h3" style={{ marginBottom: 8 }}>Routing rules</div>
    <Panel flush>
      <table className="tbl">
        <thead>
          <tr><th>When</th><th>Then route to</th><th>Reason</th><th>Last hit</th></tr>
        </thead>
        <tbody>
          {[
            { w: 'block.fitness < 0.7',            t: 'claude-sonnet-4.5', r: 'fall back to higher tier', l: '14:18 today' },
            { w: 'context > 100k tokens',          t: 'claude-sonnet-4.5', r: 'haiku context too tight', l: 'yesterday' },
            { w: 'budget.remaining < $0.50',       t: 'qwen-2.5-coder',    r: 'force local', l: '6h ago' },
            { w: 'block.tag == "playground"',      t: 'gpt-4o-mini',       r: 'cheap exploration', l: '3d ago' },
            { w: 'inference.contains("dangerous")', t: 'claude-opus-4',    r: 'safety review', l: 'never' },
          ].map((row, i) => (
            <tr key={i}>
              <td className="mono c-ink0">{row.w}</td>
              <td className="mono c-accent b">{row.t}</td>
              <td className="c-ink2">{row.r}</td>
              <td className="c-ink3">{row.l}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   PAGE · Monitor — token economy, costs, performance
   ═══════════════════════════════════════════════════════════════ */
const PageMonitor = () => (
  <div className="main" style={{ overflow: 'auto', padding: 24 }}>
    <div className="row gap-12" style={{ marginBottom: 18 }}>
      <Ic n="pulse" size={18} style={{ color: 'var(--accent)' }}/>
      <span className="t-h1">Monitor</span>
      <span className="c-ink2">— performance + token economy across all sessions</span>
      <span className="flex-1"/>
      <div style={{ display: 'flex', gap: 4, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 2, background: 'var(--bg-2)' }}>
        <Btn variant="ghost" size="sm">1h</Btn>
        <Btn variant="ghost" size="sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>24h</Btn>
        <Btn variant="ghost" size="sm">7d</Btn>
        <Btn variant="ghost" size="sm">30d</Btn>
      </div>
    </div>

    {/* KPI cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
      {[
        { k: 'Tokens', v: '2.41M', d: '−18% vs avg', good: true },
        { k: 'Spend',  v: '$8.42', d: '−12%', good: true },
        { k: 'Sessions', v: '12', d: '3 running', neutral: true },
        { k: 'Avg fitness', v: '0.87', d: '+0.03', good: true },
        { k: 'Tool calls', v: '184', d: '94% success', good: true },
      ].map(c => (
        <div key={c.k} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-1)' }}>
          <div className="t-h3">{c.k}</div>
          <div className="mono c-ink0 b" style={{ fontSize: 24, marginTop: 2 }}>{c.v}</div>
          <div className={'t-small mono ' + (c.good ? 'c-ok' : c.neutral ? 'c-ink2' : 'c-err')}>{c.d}</div>
        </div>
      ))}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Panel title="TOKENS BY BLOCK · 24h">
        {[
          { b: 'agent.coder',          v: 1010000, p: 42 },
          { b: 'agent.planner',        v:  506000, p: 21 },
          { b: 'agent.reviewer',       v:  386000, p: 16 },
          { b: 'agent.tester',         v:  264000, p: 11 },
          { b: 'commit-message.gen',   v:  120000, p:  5 },
          { b: 'block.specify',        v:   60000, p:  3 },
          { b: 'tool.git',             v:   25000, p:  1 },
        ].map(r => (
          <div key={r.b} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px 50px', gap: 12, alignItems: 'center', padding: '5px 0', fontSize: 12 }}>
            <span className="mono c-ink1">{r.b}</span>
            <Bar value={r.p * 2.4}/>
            <span className="mono c-ink0 b" style={{ textAlign: 'right' }}>{(r.v/1000).toFixed(0)}k</span>
            <span className="t-num c-ink3" style={{ textAlign: 'right' }}>{r.p}%</span>
          </div>
        ))}
      </Panel>

      <Panel title="SAVINGS · vs Tier 1 only">
        <div className="t-body" style={{ marginBottom: 14 }}>
          By routing 68% of inference to lower tiers (haiku, gpt-mini, local) Maestro saved
          <span className="c-ok b mono"> $18.20</span> today without dropping fitness below
          <span className="c-ink0 b mono"> 0.85</span>.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 12 }}>
          <span className="c-ink2">All-frontier baseline</span><span className="mono c-ink0 b">$26.62</span>
          <span className="c-ink2">Actual spend</span><span className="mono c-ink0 b">$8.42</span>
          <span className="c-ink2 b">Saved</span><span className="mono c-ok b">−$18.20  (−68%)</span>
        </div>
        <div className="divider dashed"/>
        <div className="t-h3" style={{ marginBottom: 6 }}>Tier mix · today</div>
        <div style={{ display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ flex: 0.32, background: 'var(--accent)' }} title="Tier 1 32%"/>
          <div style={{ flex: 0.48, background: 'var(--ok)' }} title="Tier 2 48%"/>
          <div style={{ flex: 0.20, background: 'var(--warn)' }} title="Tier 3 20%"/>
        </div>
        <div className="row gap-12" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 6 }}>
          <span><span className="dot" style={{ background: 'var(--accent)' }}/> T1 frontier 32%</span>
          <span><span className="dot" style={{ background: 'var(--ok)' }}/> T2 balanced 48%</span>
          <span><span className="dot" style={{ background: 'var(--warn)' }}/> T3 local 20%</span>
        </div>
      </Panel>
    </div>
  </div>
);

Object.assign(window, {
  PageFirstRun, PageConsole, PageWorkflow, PageSessions, PageSpaces,
  PageCatalog, PageBlock, PageFoundry, PageModels, PageProviders, PageMonitor,
});
