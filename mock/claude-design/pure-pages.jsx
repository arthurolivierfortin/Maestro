/* global React, Box, Bar, Spark, Mk, Pip, B, L */
/* Pure TUI · other pages */

const { useState: useStateP, useEffect: useEffectP } = React;

/* ═══════════════════════════════════════════════════════════════
   SPACES — workspace tree + sessions list
   ═══════════════════════════════════════════════════════════════ */
const PageSpaces = ({ onRoute }) => {
  const [focus, setFocus] = useStateP(0);
  const [pane, setPane] = useStateP('left'); // left | right
  const wsList = [
    { id: 'cantante',     path: 'C:\\Cantante',     br: 'main · +4',     ses: 3, fit: 0.87 },
    { id: 'maestro',      path: 'C:\\Meastro',      br: 'phase-46',       ses: 1, fit: 0.91 },
    { id: 'auth-service', path: 'C:\\Work\\auth',   br: 'fix/sso',        ses: 1, fit: 0.74 },
    { id: 'web',          path: 'C:\\Work\\web',    br: 'feat/sso',       ses: 0, fit: 0.66 },
  ];
  const sessions = [
    { st: 'act',  pulse: true,  name: 'file-tree module',       id: 'ses_8af4', ph: 'implement 3/7', ag: 'coder',    tok: '14.2k', cost: '$0.21', el: '14m 22s', ws: 'cantante' },
    { st: 'act',  pulse: true,  name: 'telemetry backfill',     id: 'ses_71bc', ph: 'gen tests',     ag: 'tester',   tok: '38.4k', cost: '$0.62', el: '32m 04s', ws: 'maestro' },
    { st: 'act',  pulse: true,  name: 'commit-agent training',  id: 'ses_29de', ph: 'benchmark',     ag: 'foundry',  tok: '124k',  cost: '$1.84', el: '1h 12m',  ws: 'cantante' },
    { st: 'warn',               name: 'review pass',            id: 'ses_4a09', ph: 'awaiting',      ag: 'reviewer', tok: '5.8k',  cost: '$0.09', el: '8m 41s',  ws: 'auth-service' },
    { st: 'ok',                 name: 'dependency upgrade',     id: 'ses_e2c1', ph: 'PR #284',       ag: 'coder',    tok: '22.1k', cost: '$0.34', el: '23m 11s', ws: 'cantante' },
    { st: 'err',                name: 'sso integration',        id: 'ses_bc89', ph: 'tool denied',   ag: 'coder',    tok: '1.2k',  cost: '$0.02', el: '4m 02s',  ws: 'web' },
  ];

  return (
    <div className="body" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 0 }}>
      <div className="col" style={{ borderRight: '1px solid var(--line)' }}>
        <div style={{ padding: 14 }}>
          <Box title="WORKSPACES" focused={pane === 'left'} meta={wsList.length + ''}>
            <div className="tree">
              {wsList.map((w, i) => (
                <div key={i} className={'tree-row' + (i === focus && pane === 'left' ? ' focus' : '')}
                     style={{ gridTemplateColumns: '14px 16px 1fr auto' }}
                     onClick={() => { setPane('left'); setFocus(i); }}>
                  <span className="gutter">{i === focus && pane === 'left' ? '❯' : ' '}</span>
                  <span style={{ color: 'var(--ac)' }}>▣</span>
                  <span>
                    <div className="bd">{w.id}</div>
                    <div className="c3" style={{ fontSize: 10 }}>{w.path} · {w.br}</div>
                  </span>
                  <span className="meta">
                    <div className="ca">{w.ses}</div>
                    <div className="c3" style={{ fontSize: 10 }}>{w.fit.toFixed(2)}</div>
                  </span>
                </div>
              ))}
            </div>
          </Box>
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          <Box title="WORKSPACE · cantante">
            <pre className="ascii" style={{ margin: 0, fontSize: 11, color: 'var(--fg-1)' }}>
{`path    C:\\Cantante
branch  main · +4 ahead
remote  github.com/you/cantante

active   3 sessions
blocks   8 project-scoped
spent    $8.42 / 24h
fitness  0.87 avg`}
            </pre>
            <div className="hr dashed"/>
            <div className="c2" style={{ fontSize: 11 }}>actions:</div>
            <div className="c3" style={{ fontSize: 11, marginTop: 4 }}>
              <span className="ca">o</span> open console · <span className="ca">b</span> blocks · <span className="ca">x</span> close
            </div>
          </Box>
        </div>
      </div>

      <div className="col" style={{ minHeight: 0 }}>
        <div style={{ padding: 14, flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Box title="SESSIONS" focused={pane === 'right'} meta={`${sessions.length} · ${sessions.filter(s=>s.st==='act').length} running`}>
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>session</th>
                  <th>workspace</th>
                  <th>phase</th>
                  <th>agent</th>
                  <th>tok</th>
                  <th>cost</th>
                  <th>elapsed</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={i} className={i === 0 ? 'focus' : ''}>
                    <td><Pip s={s.st} pulse={s.pulse}/></td>
                    <td>
                      <span className="bd c0">{s.name}</span>{' '}
                      <span className="c3">{s.id}</span>
                    </td>
                    <td className="c2">{s.ws}</td>
                    <td className="c2">{s.ph}</td>
                    <td><B kind="agent">{s.ag}</B></td>
                    <td className="c1">{s.tok}</td>
                    <td className="c1">{s.cost}</td>
                    <td className="c2">{s.el}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   FOUNDRY — block library w/ category tree + list + preview
   ═══════════════════════════════════════════════════════════════ */
const FOUNDRY_TYPES = [
  { cat: 'COMPOSE',  types: [
    { id: 'agent',     n: 24, ic: '◆' },
    { id: 'workflow',  n: 12, ic: '⊟' },
  ]},
  { cat: 'EXECUTE',  types: [
    { id: 'tool',        n: 38, ic: '▸' },
    { id: 'inference',   n: 14, ic: '∿' },
    { id: 'transformer', n:  6, ic: 'ƒ' },
  ]},
  { cat: 'DEFINE',   types: [
    { id: 'contract',  n:  7, ic: '⎙', focus: true },
    { id: 'prompt',    n: 18, ic: '¶' },
    { id: 'schema',    n:  9, ic: '⌗' },
    { id: 'dataset',   n:  4, ic: '⊕' },
  ]},
  { cat: 'QUALITY',  types: [
    { id: 'validator', n:  6, ic: '✓' },
    { id: 'evaluator', n:  3, ic: '◎' },
  ]},
  { cat: 'CONTROL',  types: [
    { id: 'router',  n: 4, ic: '◇' },
    { id: 'trigger', n: 6, ic: '⚡' },
    { id: 'hook',    n: 8, ic: '⌬' },
    { id: 'policy',  n: 5, ic: '⊙' },
  ]},
  { cat: 'STATE',    types: [
    { id: 'memory',  n: 4, ic: '⊟' },
  ]},
];

const CONTRACTS = [
  { sel: true, id: 'contract.diff-to-commit-message', cx: 'simple',  cand: 5,  pass: 3, role: 'Conventional-commit writer', desc: 'Given a diff, produce a single-line conventional-commit message.' },
  { id: 'contract.implement-from-plan',                cx: 'complex', cand: 12, pass: 4, role: 'Feature implementer',        desc: 'Plan + Workspace → Patch with passing tests, minimal hunks, idempotent.' },
  { id: 'contract.review-patch',                       cx: 'mod',     cand: 6,  pass: 4, role: 'Patch reviewer',             desc: 'Critique Patch for quality/security/conventions. Emit verdict.' },
  { id: 'contract.test-from-patch',                    cx: 'mod',     cand: 4,  pass: 2, role: 'Test generator',             desc: 'Generate minimal test suite + regression tests for a Patch.' },
  { id: 'contract.summarize-diff',                     cx: 'simple',  cand: 7,  pass: 5, role: 'Diff summarizer',            desc: '1-2 sentence plain-English summary of a diff.' },
  { id: 'contract.plan-from-task',                     cx: 'complex', cand: 8,  pass: 3, role: 'Task planner',               desc: 'Task + Workspace → ordered atomic steps with dependencies.' },
  { id: 'contract.debug-failure',                      cx: 'complex', cand: 3,  pass: 1, role: 'Failure debugger',           desc: 'Failure report + Patch → hypothesis + fix patch. Loops 3×.' },
];

const PageFoundry = () => {
  const [tab, setTab] = useStateP('library');
  const [type, setType] = useStateP('contract');
  return (
    <div className="body" style={{ display: 'grid', gridTemplateColumns: '240px 1fr 360px', minHeight: 0 }}>
      {/* Left: type tree */}
      <div style={{ padding: 14, borderRight: '1px solid var(--line)', overflow: 'auto' }}>
        <Box title="BLOCKS · 142">
          <div className="row gap-8 c2" style={{ fontSize: 11, marginBottom: 8 }}>
            <span className="ca bd">[L]</span>library<span className="c3">·</span>
            <span className="c3">[F]</span>forge<span className="c3">·</span>
            <span className="c3">[B]</span>bench
          </div>
          <div className="tree">
            {FOUNDRY_TYPES.map((grp, gi) => (
              <React.Fragment key={gi}>
                <div className="c3" style={{ fontSize: 10, letterSpacing: '0.12em', padding: '8px 8px 2px' }}>{grp.cat}</div>
                {grp.types.map((t, i) => (
                  <div key={t.id}
                       className={'tree-row' + (type === t.id ? ' focus' : '')}
                       style={{ gridTemplateColumns: '14px 14px 1fr auto' }}
                       onClick={() => setType(t.id)}>
                    <span className="gutter">{type === t.id ? '❯' : ' '}</span>
                    <span className="c2">{t.ic}</span>
                    <span>{t.id}</span>
                    <span className="meta">{t.n}</span>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </Box>
      </div>

      {/* Center: contracts list (or whichever type is selected) */}
      <div style={{ padding: 14, overflow: 'auto', minHeight: 0 }}>
        <Box title={`CONTRACTS · ${CONTRACTS.length}`} focused meta="j/k nav · ↵ open · ⌘N new">
          <div className="c2" style={{ fontSize: 11, marginBottom: 6 }}>
            <span className="c1">Contracts</span> define a role. Multiple blocks can be candidates to fulfill the same contract — each scored against a dataset.
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>id</th>
                <th>role</th>
                <th>complexity</th>
                <th>candidates</th>
                <th>passing</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map((c, i) => (
                <tr key={i} className={c.sel ? 'focus' : ''}>
                  <td>{c.sel ? '❯' : ' '}</td>
                  <td>
                    <div className="c0 bd">{c.id}</div>
                    <div className="c3" style={{ fontSize: 10 }}>{c.desc}</div>
                  </td>
                  <td className="c1">{c.role}</td>
                  <td>
                    <B kind={c.cx === 'simple' ? 'ok' : c.cx === 'mod' ? 'warn' : 'err'}>{c.cx === 'mod' ? 'moderate' : c.cx}</B>
                  </td>
                  <td className="c0 bd">{c.cand}</td>
                  <td><span className="cok bd">{c.pass}</span><span className="c3">/{c.cand}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </div>

      {/* Right: contract preview + leaderboard */}
      <div style={{ padding: 14, borderLeft: '1px solid var(--line)', overflow: 'auto' }}>
        <Box title="CONTRACT · selected">
          <div className="c2" style={{ fontSize: 10, letterSpacing: '0.10em' }}>ROLE</div>
          <div className="c0 bd" style={{ marginTop: 2 }}>Conventional-commit writer</div>
          <div className="c2" style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5 }}>
            Given a unified diff, produce a single-line conventional-commit message matching project style.
          </div>

          <div className="hr"/>
          <div className="c2" style={{ fontSize: 10, letterSpacing: '0.10em' }}>INTERFACE</div>
          <pre className="ascii" style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-1)' }}>
{`in:  diff           `}<span className="ca">GitDiff</span>{`
     style?         `}<span className="ca">CommitStyle</span>{`
     scope_hints?   `}<span className="ca">string[]</span>{`

out: message        `}<span className="ca">ConvCommit</span>{`
     confidence     `}<span className="ca">number</span>{`
     rationale?     `}<span className="ca">string</span>
          </pre>

          <div className="hr"/>
          <div className="c2" style={{ fontSize: 10, letterSpacing: '0.10em' }}>EVAL</div>
          <pre className="ascii" style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-1)' }}>
{`dataset    `}<span className="cok">ds.commit-eval v2</span>{`
evaluator  `}<span className="cok">eval.semantic-diff v2</span>{`
threshold  `}<span className="c0 bd">≥ 0.85</span>{`
weights    semantic 0.70
           format   0.20
           brevity  0.10`}
          </pre>
        </Box>

        <div style={{ height: 12 }}/>

        <Box title="LEADERBOARD" focused meta="5 candidates">
          <pre className="ascii" style={{ margin: 0, fontSize: 11, color: 'var(--fg-1)' }}>
<span className="ca bd">{`★ 1`}</span>{`  commit-message.gen v3.5    `}<span className="cok bd">{`0.89`}</span>{`  ✓
  `}<span className="c3">{`2`}</span>{`  inf.commit-type v1         `}<span className="c1">{`0.83`}</span>{`  `}<span className="cerr">{`✗`}</span>{`
  `}<span className="c3">{`3`}</span>{`  agent.coder v6 [adapter]   `}<span className="c1">{`0.78`}</span>{`  `}<span className="cerr">{`✗`}</span>{`
  `}<span className="c3">{`4`}</span>{`  gpt-4o-naive-prompt        `}<span className="cwarn">{`0.62`}</span>{`  `}<span className="cerr">{`✗`}</span>{`
  `}<span className="c3">{`5`}</span>{`  baseline v0                `}<span className="cerr">{`0.21`}</span>{`  `}<span className="cerr">{`✗`}</span>{`

threshold ── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ 0.85`}
          </pre>
          <div className="hr dashed"/>
          <div className="c2" style={{ fontSize: 11 }}>
            best by cost: <span className="ca bd">commit-message.gen</span> @ <span className="cok">$0.011</span><br/>
            best by lat:  <span className="ca bd">inf.commit-type</span> @ <span className="cok">0.6s</span><br/>
            sweet spot:   <span className="ca bd">commit-message.gen</span> <span className="c3">(passes + cheapest passing)</span>
          </div>
        </Box>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MODELS — registry + hardware
   ═══════════════════════════════════════════════════════════════ */
const PageModels = () => (
  <div className="body" style={{ padding: 14, overflow: 'auto' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
      {[
        { k: 'GPU',  v: 'RTX 4090',   bar: 76, sub: '76% · 76°C' },
        { k: 'VRAM', v: '18.4/24 GB', bar: 76, sub: 'qwen-2.5-coder' },
        { k: 'CPU',  v: 'i9-13900K',  bar: 12, sub: '12% load' },
        { k: 'RAM',  v: '32/64 GB',   bar: 50, sub: '50%' },
      ].map(c => (
        <Box key={c.k} title={c.k}>
          <div className="row between">
            <span className="c0 bd" style={{ fontSize: 16 }}>{c.v}</span>
            <span className="c3" style={{ fontSize: 11 }}>{c.sub}</span>
          </div>
          <div style={{ marginTop: 6 }}><Bar value={c.bar} width={22}/></div>
        </Box>
      ))}
    </div>

    <Box title="MODELS · 8" focused>
      <table className="tbl">
        <thead>
          <tr>
            <th></th>
            <th>model</th>
            <th>provider</th>
            <th>ctx</th>
            <th>$/1M in / out</th>
            <th>quality</th>
            <th>tok/s</th>
            <th>tier</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>
          {[
            { sel: true,  st: 'act',  prov: 'anthropic', id: 'claude-sonnet-4.5', ctx: '200K', cost: '$3 / $15',  q: 9.1, tps: 84,  tier: 'T1' },
            {              st: 'ok',   prov: 'anthropic', id: 'claude-opus-4',     ctx: '200K', cost: '$15 / $75', q: 9.5, tps: 42,  tier: 'T1' },
            {              st: 'ok',   prov: 'anthropic', id: 'claude-haiku-4',    ctx: '200K', cost: '$0.8 / $4', q: 8.2, tps: 144, tier: 'T2' },
            {              st: 'ok',   prov: 'openai',    id: 'gpt-4o',            ctx: '128K', cost: '$5 / $15',  q: 8.7, tps: 78,  tier: 'T1' },
            {              st: 'ok',   prov: 'openai',    id: 'gpt-4o-mini',       ctx: '128K', cost: '$0.15 / $0.6', q: 7.4, tps: 162, tier: 'T2' },
            {              st: 'warn', prov: 'ollama',    id: 'qwen-2.5-coder',    ctx: '128K', cost: 'free',      q: 8.4, tps: 38,  tier: 'T3' },
            {              st: 'warn', prov: 'ollama',    id: 'llama-3.1-70b',     ctx: '128K', cost: 'free',      q: 7.9, tps: 22,  tier: 'T3' },
            {              st: 'err',  prov: 'azure',     id: 'gpt-4-turbo',       ctx: '128K', cost: '$10 / $30', q: 8.5, tps: null,tier: '—' },
          ].map((m, i) => (
            <tr key={i} className={m.sel ? 'focus' : ''}>
              <td><Pip s={m.st} pulse={m.sel}/></td>
              <td className="c0 bd">{m.id}</td>
              <td className="c2">{m.prov}</td>
              <td className="c1">{m.ctx}</td>
              <td className={m.cost === 'free' ? 'cok' : 'c1'}>{m.cost}</td>
              <td>
                <span className={'bd ' + (m.q >= 9 ? 'cok' : m.q >= 8 ? 'c0' : 'c2')}>{m.q.toFixed(1)}</span>
                <span className="c3" style={{ marginLeft: 6 }}>
                  {'█'.repeat(Math.round(m.q))}{'░'.repeat(10 - Math.round(m.q))}
                </span>
              </td>
              <td className="c2">{m.tps != null ? m.tps : '—'}</td>
              <td><B kind={m.tier === 'T1' ? 'ac' : m.tier === 'T2' ? '' : 'warn'}>{m.tier}</B></td>
              <td><B kind={m.st === 'act' ? 'ok' : m.st === 'err' ? 'err' : ''}>{m.st === 'act' ? 'active' : m.st === 'err' ? 'down' : m.st === 'warn' ? 'local' : 'ready'}</B></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MONITOR — token economy / savings / fitness
   ═══════════════════════════════════════════════════════════════ */
const PageMonitor = () => (
  <div className="body" style={{ padding: 14, overflow: 'auto' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
      {[
        { k: 'tokens',   v: '2.41M', d: '−18%', good: true },
        { k: 'spend',    v: '$8.42', d: '−12%', good: true },
        { k: 'sessions', v: '12',    d: '3 running' },
        { k: 'fitness',  v: '0.87',  d: '+0.03', good: true },
        { k: 'calls',    v: '184',   d: '94% ok', good: true },
      ].map(c => (
        <Box key={c.k} title={c.k.toUpperCase()}>
          <div className="c0 bd" style={{ fontSize: 22 }}>{c.v}</div>
          <div className={'c2 ' + (c.good ? 'cok' : '')} style={{ fontSize: 11 }}>{c.d}</div>
        </Box>
      ))}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      <Box title="TOKENS BY BLOCK · 24h" focused>
        <pre className="ascii" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.8, color: 'var(--fg-1)' }}>
{`agent.coder         `}<Bar value={84} width={18}/>{`  1,010k  42%
agent.planner       `}<Bar value={42} width={18}/>{`    506k  21%
agent.reviewer      `}<Bar value={32} width={18}/>{`    386k  16%
agent.tester        `}<Bar value={22} width={18}/>{`    264k  11%
commit-message.gen  `}<Bar value={10} width={18}/>{`    120k   5%
block.specify       `}<Bar value={5}  width={18}/>{`     60k   3%
tool.git            `}<Bar value={2}  width={18}/>{`     25k   1%`}
        </pre>
      </Box>

      <Box title="SAVINGS · vs Tier 1 only" focused>
        <div className="c2" style={{ fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
          By routing 68% of inference to lower tiers (haiku, mini, local), Maestro saved <span className="cok bd">$18.20</span> today without dropping fitness below <span className="c0 bd">0.85</span>.
        </div>
        <pre className="ascii" style={{ margin: 0, fontSize: 11.5, color: 'var(--fg-1)' }}>
{`baseline (all T1)   $26.62
actual spend        $ 8.42
                    ──────
saved              `}<span className="cok bd">{`-$18.20`}</span>{`  (-68%)`}
        </pre>
        <div className="hr dashed"/>
        <div className="c2" style={{ fontSize: 10, letterSpacing: '0.10em' }}>TIER MIX</div>
        <pre className="ascii" style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--fg-1)' }}>
{`T1 frontier  `}<span className="ca">{`██████░░░░░░░░░░░░░░`}</span>{` 32%
T2 balanced  `}<span className="cok">{`█████████░░░░░░░░░░░`}</span>{` 48%
T3 local     `}<span className="cwarn">{`████░░░░░░░░░░░░░░░░`}</span>{` 20%`}
        </pre>
      </Box>
    </div>

    <div style={{ height: 14 }}/>

    <Box title="FITNESS · all blocks · last 30 runs">
      <pre className="ascii" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.8, color: 'var(--fg-1)' }}>
{`commit-message.gen  `}<Spark values={[0.71,0.78,0.74,0.82,0.87,0.89]}/>{`  `}<span className="cok bd">0.89</span>{`  ↑ +0.18
agent.coder         `}<Spark values={[0.82,0.84,0.85,0.86,0.87,0.88]}/>{`  `}<span className="c0">0.88</span>{`  ↑ +0.06
agent.planner       `}<Spark values={[0.88,0.89,0.90,0.91,0.91,0.91]}/>{`  `}<span className="c0">0.91</span>{`  → stable
agent.reviewer      `}<Spark values={[0.85,0.84,0.83,0.82,0.83,0.84]}/>{`  `}<span className="c1">0.84</span>{`  → stable
agent.tester        `}<Spark values={[0.78,0.77,0.79,0.78,0.79,0.79]}/>{`  `}<span className="c1">0.79</span>{`  → flat
agent.debugger      `}<Spark values={[0.68,0.70,0.72,0.71,0.73,0.74]}/>{`  `}<span className="cwarn">0.74</span>{`  ↑ slow climb`}
      </pre>
    </Box>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   HELP OVERLAY
   ═══════════════════════════════════════════════════════════════ */
const HelpOverlay = ({ open, onClose }) => {
  useEffectP(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === 'Escape' || e.key === '?') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open]);
  if (!open) return null;
  return (
    <div className="help" onClick={onClose}>
      <h2>─ KEYBOARD ─────────────────────────────────────</h2>
      <div className="grid">
        <div>
          <div className="c2" style={{ marginBottom: 4 }}>NAVIGATE</div>
          <div className="hk"><b>1-6</b><span>switch tab</span></div>
          <div className="hk"><b>Tab</b><span>cycle pane</span></div>
          <div className="hk"><b>j / k</b><span>down / up</span></div>
          <div className="hk"><b>h / l</b><span>collapse / expand</span></div>
          <div className="hk"><b>g / G</b><span>top / bottom</span></div>
          <div className="hk"><b>↵</b><span>open</span></div>
          <div className="hk"><b>Esc</b><span>back · close</span></div>
        </div>
        <div>
          <div className="c2" style={{ marginBottom: 4 }}>COMMANDS</div>
          <div className="hk"><b>:</b><span>command mode</span></div>
          <div className="hk"><b>⌘K</b><span>palette</span></div>
          <div className="hk"><b>/</b><span>filter / focus input</span></div>
          <div className="hk"><b>?</b><span>this help</span></div>
          <div className="hk"><b>p</b><span>pin to console</span></div>
          <div className="hk"><b>n</b><span>new (session / block)</span></div>
          <div className="hk"><b>r</b><span>retry · refresh</span></div>
        </div>
        <div>
          <div className="c2" style={{ marginBottom: 4 }}>BLOCKS / WORKFLOWS</div>
          <div className="hk"><b>e</b><span>edit composition</span></div>
          <div className="hk"><b>c</b><span>connect nodes</span></div>
          <div className="hk"><b>d</b><span>delete node</span></div>
          <div className="hk"><b>v</b><span>view (list / graph)</span></div>
          <div className="hk"><b>m</b><span>move</span></div>
          <div className="hk"><b>⌘S</b><span>save</span></div>
          <div className="hk"><b>⌘↵</b><span>dry-run</span></div>
        </div>
      </div>
      <div className="hr" style={{ margin: '18px 0 8px' }}/>
      <div className="c3" style={{ fontSize: 11 }}>press <span className="ca bd">?</span> or <span className="ca bd">Esc</span> to close</div>
    </div>
  );
};

Object.assign(window, { PageSpaces, PageFoundry, PageModels, PageMonitor, HelpOverlay });
