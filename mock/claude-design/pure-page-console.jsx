/* global React, Box, Bar, Spark, Mk, Pip, B, L */
/* Pure TUI · Console page */

const { useState: useStateC } = React;

/* Mascot in ASCII — a simple wireframe head */
const ASCII_HEAD = String.raw`
       .--""""--.
     .'  ░░░░░░  '.
    /  ░░░░░░░░░░  \
   |  ░░ ╔═══╗ ░░  |
   |  ░░ ║   ║ ░░  |
   |   ░░╚═══╝░░   |
    \   ░░░░░░░░  /
     '.   ░░░░  .'
       '------'`;

const ASCII_LOGO = String.raw`
 ███╗   ███╗ █████╗ ███████╗███████╗████████╗██████╗  ██████╗
 ████╗ ████║██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗
 ██╔████╔██║███████║█████╗  ███████╗   ██║   ██████╔╝██║   ██║
 ██║╚██╔╝██║██╔══██║██╔══╝  ╚════██║   ██║   ██╔══██╗██║   ██║
 ██║ ╚═╝ ██║██║  ██║███████╗███████║   ██║   ██║  ██║╚██████╔╝`;

/* ─── Cockpit panel (right side of console) ─── */
const Cockpit = () => (
  <div className="col gap-12" style={{ padding: 14, borderLeft: '1px solid var(--line)' }}>
    <Box title="COCKPIT" focused meta="agent.maestro">
      <pre className="ascii c3" style={{ margin: 0, fontSize: 10, lineHeight: 1.05 }}>{ASCII_HEAD}</pre>
      <div className="row gap-6 between" style={{ marginTop: 4 }}>
        <span className="c1">in control</span>
        <Pip s="act" pulse/>
      </div>
      <div className="hr dashed"/>
      <div className="c2" style={{ fontSize: 11, lineHeight: 1.6 }}>
        driving:<br/>
        <span className="ca">▸ ses_8af4</span> <span className="c3">file-tree</span><br/>
        <span className="ca">▸ forge</span>   <span className="c3">commit-message v3.5</span>
      </div>
    </Box>

    <Box title="FITNESS · live">
      <div className="row gap-6" style={{ marginBottom: 6 }}>
        <span className="c2">commit-msg</span>
        <span className="flex-1"/>
        <span className="ca bd">0.89</span>
      </div>
      <Spark values={[0.71, 0.78, 0.74, 0.82, 0.87, 0.89]}/>
      <div className="c3" style={{ fontSize: 10, marginTop: 4 }}>
        baseline 0.71 → best 0.89 · +0.18
      </div>
    </Box>

    <Box title="TOKENS · 24h">
      <div className="row between">
        <span className="c0 bd" style={{ fontSize: 18 }}>2.41M</span>
        <span className="cok" style={{ fontSize: 11 }}>−18%</span>
      </div>
      <div style={{ marginTop: 4 }}><Bar value={68} width={20}/></div>
      <div className="c3" style={{ fontSize: 10, marginTop: 4 }}>
        coder 42% · planner 21% · reviewer 16%
      </div>
    </Box>

    <Box title="BUDGET">
      <div className="row between">
        <span className="c0 bd">$8.42</span>
        <span className="c2">/ $25.00 day</span>
      </div>
      <div style={{ marginTop: 4 }}><Bar value={33.7} width={20} variant="ok"/></div>
    </Box>

    <Box title="CLUSTER">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '2px 6px', fontSize: 11 }}>
        <span className="c2">backend</span><Bar value={26} width={10}/><span className="c3">:5000</span>
        <span className="c2">llm    </span><Bar value={14} width={10}/><span className="c3">:5010</span>
        <span className="c2">signal </span><Bar value={62} width={10} variant="warn"/><span className="c3">:5000</span>
        <span className="c2">gpu    </span><Bar value={76} width={10}/><span className="c3">76%</span>
        <span className="c2">vram   </span><Bar value={76} width={10}/><span className="c3">18/24</span>
      </div>
    </Box>

    <Box title="ACTIVITY">
      <div style={{ fontSize: 10, lineHeight: 1.7, color: 'var(--fg-2)' }}>
        <div><span className="c3">14:28:22</span> <span className="cagent">maestro</span> queue v3.5</div>
        <div><span className="c3">14:28:12</span> <span className="cagent">maestro</span> pin comparison</div>
        <div><span className="c3">14:27:40</span> haiku-4 wins 0.87</div>
        <div><span className="c3">14:24:25</span> phase plan ✓</div>
        <div><span className="c3">14:23:01</span> <span className="cagent">maestro</span> open foundry</div>
        <div><span className="c3">14:22:24</span> <span className="cagent">maestro</span> pin workflow</div>
        <div><span className="c3">14:22:08</span> <span className="ca">user → task</span></div>
      </div>
    </Box>
  </div>
);

/* ─── Pinned widget: live workflow tree ─── */
const WorkflowWidget = () => (
  <div style={{
    border: '1px solid var(--line)',
    margin: '12px 0', padding: '8px 12px 10px',
    position: 'relative', background: 'var(--bg-1)',
  }}>
    <div style={{ position: 'absolute', top: -8, left: 12, background: 'var(--bg-0)',
                  padding: '0 8px', fontSize: 11, color: 'var(--ac)', letterSpacing: '0.10em' }}>
      ─ WIDGET · live workflow · ses_8af4 ─
    </div>
    <div style={{ position: 'absolute', top: -8, right: 12, background: 'var(--bg-0)',
                  padding: '0 8px', fontSize: 10, color: 'var(--agent)' }}>
      ⎙ pinned by agent.maestro
    </div>
    <pre className="ascii" style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--fg-1)' }}>
{`workflow.feature-pipeline
├─ `}<span className="cok">✓</span>{` agent.planner    `}<span className="c3">2m 14s</span>{`
├─ `}<span className="cok">✓</span>{` block.specify    `}<span className="c3">3m 02s</span>{`
├─ `}<span className="ca">●</span>{` `}<span className="ca bd">agent.coder</span>{`      `}<span className="c3">6m 41s  ★ here</span>{`
│  ├─ `}<span className="cok">✓</span>{` tool.edit-file  `}<span className="c3">1.1s</span>{`
│  ├─ `}<span className="cok">✓</span>{` tool.shell      `}<span className="c3">4.1s</span>{`
│  └─ `}<span className="ca">●</span>{` tool.shell      `}<span className="c3">3.4s · watch</span>{`
├─ `}<span className="c3">○</span>{` agent.tester
├─ `}<span className="c3">○</span>{` agent.reviewer
└─ `}<span className="c3">○</span>{` tool.git`}
    </pre>
    <div className="row gap-14" style={{ marginTop: 6, fontSize: 10, color: 'var(--fg-3)' }}>
      <span>tokens <span className="c1 bd">14,209</span></span>
      <span>cost <span className="c1 bd">$0.21</span></span>
      <span>tools <span className="c1 bd">23</span></span>
      <span className="flex-1"/>
      <span><span className="ca">g</span> open monitor</span>
    </div>
  </div>
);

/* ─── Pinned widget: foundry iterations ─── */
const FoundryWidget = () => (
  <div style={{
    border: '1px solid var(--line)',
    margin: '12px 0', padding: '8px 12px 10px',
    position: 'relative', background: 'var(--bg-1)',
  }}>
    <div style={{ position: 'absolute', top: -8, left: 12, background: 'var(--bg-0)',
                  padding: '0 8px', fontSize: 11, color: 'var(--ac)', letterSpacing: '0.10em' }}>
      ─ WIDGET · foundry · commit-message.generator ─
    </div>
    <div style={{ position: 'absolute', top: -8, right: 12, background: 'var(--bg-0)',
                  padding: '0 8px', fontSize: 10, color: 'var(--agent)' }}>
      ⎙ pinned by agent.maestro
    </div>
    <pre className="ascii" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.7, color: 'var(--fg-1)' }}>
{`# │ ver  │ hypothesis              │ model       │ fit  │ cost
──┼──────┼─────────────────────────┼─────────────┼──────┼────────
1 │ v3.0 │ baseline                │ sonnet-4.5  │ `}<span className="c2">0.71</span>{` │ $0.020
2 │ v3.1 │ add few-shot            │ sonnet-4.5  │ `}<span className="c2">0.78</span>{` │ $0.022
3 │ v3.2 │ cheaper backbone        │ gpt-4o-mini │ `}<span className="cerr">0.74</span>{` │ $0.008
4 │ v3.3 │ diff summarization      │ haiku-4     │ `}<span className="c1">0.82</span>{` │ $0.010
5 │ `}<span className="ca">v3.4</span>{` │ schema-constrained out  │ haiku-4     │ `}<span className="cok bd">0.87</span>{` │ $0.011
6 │ `}<span className="ca">v3.5</span>{` │ `}<span className="ca">tighten temp 0.3→0.1</span>{`    │ haiku-4     │ `}<span className="ca">·····</span>{` │ live`}
    </pre>
    <div className="hr dashed" style={{ margin: '6px 0' }}/>
    <div className="row gap-10" style={{ fontSize: 11 }}>
      <span className="c2">winner</span>
      <span className="ca bd">haiku-4 · 4× cheaper</span>
      <span className="c3">·</span>
      <span className="c2">target</span>
      <span className="cok bd">0.88</span>
      <span className="c3">→ publish to user scope</span>
      <span className="flex-1"/>
      <span className="c3"><span className="ca">f</span> open foundry</span>
    </div>
  </div>
);

/* ─── Console page ─── */
const PageConsole = () => (
  <div className="body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px' }}>
    {/* Conversation */}
    <div className="col" style={{ minHeight: 0 }}>
      <div className="conv">
        <L ts="" kind="agent">
          <pre className="ascii ca" style={{ margin: '4px 0 12px', fontSize: 9, lineHeight: 1.05 }}>{ASCII_LOGO}</pre>
        </L>

        <L ts="14:22:08" k="user">
          add localStorage persistence to FileTree, and build me an agent that writes conventional-commit messages from diffs
        </L>

        <L ts="14:22:10" k="agent">
          Two tracks. Spinning up <span className="ca bd">feature-pipeline</span> session for the FileTree work, and a <span className="ca bd">block-forge</span> session in the Foundry for the commit-message agent. Pinning both.
        </L>

        <WorkflowWidget/>

        <L ts="14:22:24" k="agent">
          Workflow pinned above. Coder is in step <span className="c0 bd">3/7</span> — already wrote the hook, currently re-running tests with a fixed localStorage mock.
        </L>

        <L ts="14:23:01" k="agent">
          For the commit-message agent — checked the Catalog, no existing block fits cleanly. Forging a new one. Iterating in the Foundry now.
        </L>

        <FoundryWidget/>

        <L ts="14:27:40" k="agent">
          5 iterations in. Schema-constrained output at v3.4 hit <span className="cok bd">0.87 fitness</span>. <span className="ca bd">claude-haiku-4</span> wins on cost — 4× cheaper than the default.
        </L>

        <L ts="14:28:12" k="agent">
          Routing the new agent to <span className="cagent">haiku-4</span> as bound model with <span className="cagent">sonnet-4.5</span> as fallback.
        </L>

        <L ts="14:28:22" k="agent" streaming>
          Running one more iteration with temperature 0.1 — if it hits <span className="cok bd">0.88</span>, I'll publish to user scope and you can use it across all projects
        </L>
      </div>

      {/* Input box */}
      <div style={{ padding: '0 14px 12px' }}>
        <Box title="INPUT" focused>
          <div className="row gap-8">
            <span className="cok bd">❯</span>
            <span className="c3 flex-1">Ask a follow-up · or describe a new task</span>
            <span className="c3" style={{ fontSize: 11 }}>
              <span className="ca">⌘K</span> commands · <span className="ca">↑</span> history · <span className="ca">⇧↵</span> newline
            </span>
            <span style={{
              display: 'inline-block', width: 8, height: 14,
              background: 'var(--ac)',
              animation: 'blink 1s steps(1) infinite',
            }}/>
          </div>
        </Box>
      </div>
    </div>

    {/* Right cockpit */}
    <Cockpit/>
  </div>
);

Object.assign(window, { PageConsole, WorkflowWidget, FoundryWidget, Cockpit });
