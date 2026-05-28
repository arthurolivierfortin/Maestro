/* global React, Icon, StatusDot, Badge, Button, Panel, Sparkline, Progress */
const { useState: useStateF } = React;

const FoundryScreen = ({ onNavigate }) => {
  const blocks = [
    { id: 'commit-msg-gen', name: 'commit-message.generator', version: 'v3', baseline: '0.71', best: '0.89', status: 'training' },
    { id: 'pr-reviewer',    name: 'pr.reviewer',              version: 'v2', baseline: '0.62', best: '0.76', status: 'idle' },
    { id: 'planner',        name: 'agent.planner',            version: 'v4', baseline: '0.82', best: '0.91', status: 'published' },
  ];
  const [selected] = useStateF('commit-msg-gen');

  return (
    <div data-screen-label="04 Foundry" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Icon name="foundry" size={18} style={{ color: 'var(--accent)' }}/>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Foundry</h1>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Train, benchmark and publish blocks</span>
        <div style={{ flex: 1 }}/>
        <Badge variant="agent" mono>1 active session</Badge>
        <Button variant="outline" icon="history" size="md">Runs</Button>
        <Button variant="primary" icon="plus" size="md">New training</Button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '280px 1fr' }}>
        {/* left: blocks in training */}
        <div style={{ borderRight: '1px solid var(--line)', background: 'var(--bg-1)', overflow: 'auto' }}>
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.06, textTransform: 'uppercase' }}>In foundry</span>
            <Badge variant="outline">{blocks.length}</Badge>
          </div>
          {blocks.map(b => <FoundryBlockRow key={b.id} block={b} selected={b.id === selected}/>)}
        </div>

        {/* right: training detail */}
        <div style={{ overflow: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div>
              <Badge variant="accent" mono>foundry · in-progress</Badge>
              <h2 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }} className="mono">commit-message.generator</h2>
              <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                Generates conventional-commit messages from a diff. Goal: minimize human edits, maximize semantic accuracy.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" icon="pause">Pause</Button>
              <Button variant="outline" icon="diff">Compare</Button>
              <Button variant="primary" icon="package">Publish</Button>
            </div>
          </div>

          {/* fitness header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            <FitCard label="Best fitness" value="0.89" delta="+0.18" trend={[0.71,0.74,0.78,0.80,0.84,0.87,0.89]} good/>
            <FitCard label="Cost per run" value="$0.012" delta="−42%" trend={[0.020,0.019,0.018,0.016,0.014,0.013,0.012]} good/>
            <FitCard label="Avg latency" value="1.4s" delta="−0.6s" trend={[2.0,1.9,1.8,1.7,1.6,1.5,1.4]} good/>
            <FitCard label="Tokens/run" value="1.2k" delta="−38%" trend={[1900,1800,1700,1600,1500,1300,1200]} good/>
          </div>

          {/* benchmark matrix */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="layers" size={14} style={{ color: 'var(--fg-2)' }}/>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Benchmark matrix</span>
                <Badge variant="outline" mono>6 models × 24 examples</Badge>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost">Cost</Button>
                <Button size="sm" variant="soft" active>Fitness</Button>
                <Button size="sm" variant="ghost">Latency</Button>
              </div>
            </div>
            <BenchmarkTable/>
          </div>

          {/* iterations + dataset */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            <Panel title="Iterations" icon="history" actions={<Badge variant="outline" mono>12</Badge>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <IterationRow ver="v3.0" model="claude-sonnet-4.5" change="initial prompt"           fitness="0.71" cost="$0.020" status="baseline"/>
                <IterationRow ver="v3.1" model="claude-sonnet-4.5" change="add few-shot examples"     fitness="0.78" cost="$0.022" status="improved"/>
                <IterationRow ver="v3.2" model="gpt-4o-mini"        change="cheaper backbone"          fitness="0.74" cost="$0.008" status="regressed"/>
                <IterationRow ver="v3.3" model="claude-haiku-4"     change="add diff summarization"    fitness="0.82" cost="$0.010" status="improved"/>
                <IterationRow ver="v3.4" model="claude-haiku-4"     change="schema-constrained output" fitness="0.87" cost="$0.011" status="improved"/>
                <IterationRow ver="v3.5" model="claude-haiku-4"     change="tighten temperature 0.3→0.1" fitness="0.89" cost="$0.012" status="current" current/>
              </div>
            </Panel>

            <Panel title="Eval dataset" icon="db" actions={<Button size="sm" variant="ghost" icon="plus">Add</Button>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <EvalRow name="feat-auth.diff"    score={0.94} status="pass"/>
                <EvalRow name="fix-race.diff"     score={0.91} status="pass"/>
                <EvalRow name="refactor-fs.diff"  score={0.88} status="pass"/>
                <EvalRow name="docs-readme.diff"  score={0.96} status="pass"/>
                <EvalRow name="chore-deps.diff"   score={0.62} status="fail"/>
                <EvalRow name="perf-cache.diff"   score={0.82} status="pass"/>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-2)' }}>+ 18 more · run on every iteration</div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};

const FoundryBlockRow = ({ block, selected }) => (
  <div style={{
    padding: '12px 14px',
    borderBottom: '1px solid var(--line)',
    borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
    background: selected ? 'var(--bg-2)' : 'transparent',
    cursor: 'pointer',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      {block.status === 'training' && <StatusDot status="running" pulse/>}
      {block.status === 'idle' && <StatusDot status="pending"/>}
      {block.status === 'published' && <Icon name="check" size={12} style={{ color: 'var(--ok)' }}/>}
      <div className="mono" style={{ fontSize: 12, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</div>
      <Badge variant="outline" mono>{block.version}</Badge>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-2)' }}>
      <span className="mono">{block.baseline}</span>
      <Icon name="arrowRight" size={10}/>
      <span className="mono" style={{ color: 'var(--ok)' }}>{block.best}</span>
      <span style={{ marginLeft: 'auto' }}>fitness</span>
    </div>
  </div>
);

const FitCard = ({ label, value, delta, trend, good }) => (
  <div style={{
    padding: 14, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
    display: 'flex', flexDirection: 'column', gap: 6,
  }}>
    <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span className="mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
      {delta && <span className="mono" style={{ fontSize: 11, color: good ? 'var(--ok)' : 'var(--err)' }}>{delta}</span>}
    </div>
    {trend && <Sparkline values={trend} width={220} height={20} color={good ? 'var(--ok)' : 'var(--accent)'}/>}
  </div>
);

const BenchmarkTable = () => {
  // 6 models × 6 examples (slice of 24 for the demo)
  const models = ['claude-sonnet-4.5', 'claude-haiku-4', 'gpt-4o', 'gpt-4o-mini', 'llama-3.1-70b', 'qwen-2.5-coder'];
  const examples = ['feat-auth', 'fix-race', 'refactor-fs', 'docs-readme', 'chore-deps', 'perf-cache'];
  // deterministic-ish scores
  const seed = (m, e) => {
    const v = ((m*7 + e*3) % 11) / 10 + 0.5 - (e === 4 ? 0.25 : 0);
    return Math.max(0.2, Math.min(0.99, v + (m === 1 ? 0.06 : m === 0 ? 0.04 : 0)));
  };
  const heat = (v) => {
    if (v >= 0.85) return { bg: 'oklch(0.78 0.16 150 / 0.32)', fg: 'var(--ok)' };
    if (v >= 0.7)  return { bg: 'oklch(0.78 0.16 150 / 0.12)', fg: 'var(--fg-0)' };
    if (v >= 0.55) return { bg: 'oklch(0.82 0.14 80 / 0.12)',  fg: 'var(--warn)' };
    return { bg: 'oklch(0.72 0.18 25 / 0.18)', fg: 'var(--err)' };
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, color: 'var(--fg-2)', borderBottom: '1px solid var(--line)', position: 'sticky', left: 0, background: 'var(--bg-1)' }}>Model</th>
            {examples.map(e => (
              <th key={e} style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 500, color: 'var(--fg-2)', borderBottom: '1px solid var(--line)' }} className="mono">{e}</th>
            ))}
            <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 500, color: 'var(--fg-2)', borderBottom: '1px solid var(--line)' }}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m, mi) => {
            const scores = examples.map((_, ei) => seed(mi, ei));
            const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
            const best = mi === 1; // haiku is winner
            return (
              <tr key={m} style={{ background: best ? 'oklch(0.78 0.14 220 / 0.05)' : 'transparent' }}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', position: 'sticky', left: 0, background: best ? 'oklch(0.78 0.14 220 / 0.05)' : 'var(--bg-1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {best && <Icon name="flag" size={12} style={{ color: 'var(--accent)' }}/>}
                    <span className="mono">{m}</span>
                  </div>
                </td>
                {scores.map((s, i) => {
                  const h = heat(s);
                  return (
                    <td key={i} style={{ padding: 6, borderBottom: '1px solid var(--line)', textAlign: 'center' }}>
                      <div className="mono" style={{ background: h.bg, color: h.fg, fontWeight: 500, padding: '6px 8px', borderRadius: 4, minWidth: 48 }}>{s.toFixed(2)}</div>
                    </td>
                  );
                })}
                <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                  <span className="mono" style={{ fontWeight: 600, color: best ? 'var(--accent)' : 'var(--fg-0)' }}>{avg.toFixed(2)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const IterationRow = ({ ver, model, change, fitness, cost, status, current }) => {
  const sm = {
    baseline:  { fg: 'var(--fg-2)', icon: <span className="mono" style={{ fontSize: 9, color: 'var(--fg-2)' }}>base</span> },
    improved:  { fg: 'var(--ok)',   icon: <Icon name="check" size={11} style={{ color: 'var(--ok)' }}/> },
    regressed: { fg: 'var(--err)',  icon: <Icon name="x" size={11} style={{ color: 'var(--err)' }}/> },
    current:   { fg: 'var(--accent)', icon: <StatusDot status="running" pulse/> },
  }[status];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '14px 50px 1fr 140px 60px 60px',
      gap: 10, alignItems: 'center', padding: '6px 4px',
      borderRadius: 4,
      background: current ? 'var(--bg-2)' : 'transparent',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{sm.icon}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{ver}</span>
      <span style={{ fontSize: 12, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{change}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{model}</span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: sm.fg, textAlign: 'right' }}>{fitness}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', textAlign: 'right' }}>{cost}</span>
    </div>
  );
};

const EvalRow = ({ name, score, status }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
    {status === 'pass'
      ? <Icon name="check" size={12} style={{ color: 'var(--ok)' }}/>
      : <Icon name="x" size={12} style={{ color: 'var(--err)' }}/>}
    <span className="mono" style={{ fontSize: 11.5, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    <div style={{ width: 50 }}><Progress value={score * 100} color={status === 'pass' ? 'var(--ok)' : 'var(--err)'}/></div>
    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)', width: 28, textAlign: 'right' }}>{score.toFixed(2)}</span>
  </div>
);

Object.assign(window, { FoundryScreen });
