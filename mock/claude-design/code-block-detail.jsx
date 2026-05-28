/* global React, Ic, StatusDot, Badge, Btn, Bar, Panel, ContractWidget, AgentBanner,
   BLOCK_TYPES, BLOCK_CATEGORIES, BLOCKS */
/* Block detail page — type-specific internals viewer + workflow editor */

const { useState: useStateBd, useEffect: useEffectBd } = React;

/* ═══════════════════════════════════════════════════════════════
   Type-specific internals panels
   ═══════════════════════════════════════════════════════════════ */

const InternalsAgent = ({ block }) => (
  <>
    {/* Black-box external interface (prompt-like) */}
    <Panel title="EXTERNAL INTERFACE · prompt-like" meta="callers see only this">
      <div className="t-small c-ink2" style={{ marginBottom: 10, lineHeight: 1.6 }}>
        From the outside, this agent behaves like a prompt: variables in, text/structured response out. Internal composition is hidden — callers don't know which blocks fire.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', alignItems: 'stretch' }}>
        <div>
          <div className="t-h3" style={{ marginBottom: 6 }}>↳ template variables</div>
          {[
            { name: 'task',      type: 'string',     req: true,  desc: 'High-level description of what to implement.' },
            { name: 'codebase',  type: 'Workspace',  req: true,  desc: 'Read-write handle to the project filesystem.' },
            { name: 'plan',      type: 'PlanStep[]?',req: false, desc: 'Optional pre-computed plan. If absent, the agent will plan internally.' },
            { name: 'budget',    type: 'TokenBudget?', req: false, desc: 'Per-session cap. Defaults to policy.' },
          ].map(f => (
            <div key={f.name} style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: '6px 10px', background: 'var(--bg-0)', marginBottom: 6 }}>
              <div className="row gap-6">
                <span className="mono c-ink0 b">{f.name}</span>
                <span className="c-accent t-small">{f.type}</span>
                <span style={{ fontSize: 9, color: f.req ? 'var(--err)' : 'var(--ink-3)' }}>{f.req ? 'REQ' : 'OPT'}</span>
              </div>
              <div className="t-small c-ink2" style={{ marginTop: 2 }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderLeft: '1px dashed var(--line)', borderRight: '1px dashed var(--line)' }}>
          <div style={{ width: 36, height: 36, border: '1px dashed var(--agent)', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--agent)' }}>
            <Ic n="user" size={14}/>
          </div>
        </div>
        <div>
          <div className="t-h3" style={{ marginBottom: 6 }}>response ↴</div>
          {[
            { name: 'patch',      type: 'GitPatch',  desc: 'Unified diff, one logical change per hunk.' },
            { name: 'summary',    type: 'string',    desc: 'Natural-language description for reviewer.' },
            { name: 'confidence', type: 'number',    desc: '0–1. Caller may reroute below threshold.' },
          ].map(f => (
            <div key={f.name} style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: '6px 10px', background: 'var(--bg-0)', marginBottom: 6 }}>
              <div className="row gap-6">
                <span className="mono c-ink0 b">{f.name}</span>
                <span className="c-accent t-small">{f.type}</span>
              </div>
              <div className="t-small c-ink2" style={{ marginTop: 2 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="divider dashed"/>
      <div className="row gap-12">
        <span className="kbd-hint c-ink2">
          implements <span className="c-accent b mono">contract.implement-from-plan v6</span>
        </span>
        <span className="flex-1"/>
        <Btn variant="ghost" size="sm" icon="arrowRight">Open contract</Btn>
      </div>
    </Panel>

    <div style={{ height: 16 }}/>

    {/* INTERNAL composition — the black box opened */}
    <Panel title="INTERNAL COMPOSITION · inside the black box" focused
           meta={'8 nested blocks · invisible to callers'}>
      <div className="t-small c-ink2" style={{ marginBottom: 12, lineHeight: 1.6 }}>
        An agent can compose any blocks: tools, prompts, workflows, even other agents. Callers can't see this — they only know the external interface above. This is what makes agents <span className="c-ink0 b">interchangeable</span>: another agent fulfilling the same contract could have a completely different inside.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
        <div>
          {[
            { i: 1, k: 'prompt',     ref: 'prompt.coder-system',         note: 'bound to model below' },
            { i: 2, k: 'inference',  ref: 'inference (the bound model)', note: 'first pass: classify task' },
            { i: 3, k: 'workflow',   ref: 'workflow.read-context',       note: 'reads N files via tool.read-file' },
            { i: 4, k: 'tool',       ref: 'tool.read-file',              note: 'parallel · up to 12 files' },
            { i: 5, k: 'inference',  ref: 'inference · schema-constrained', note: 'emit hunks' },
            { i: 6, k: 'validator',  ref: 'val.json-schema',             note: 'gate before tool.edit-file' },
            { i: 7, k: 'tool',       ref: 'tool.edit-file',              note: 'apply each hunk' },
            { i: 8, k: 'tool',       ref: 'tool.shell',                  note: 'run project tests' },
            { i: 9, k: 'memory',     ref: 'mem.coder-context',           note: 'write last 10 reads' },
          ].map(s => {
            const tdef = BLOCK_TYPES[s.k] || BLOCK_TYPES.tool;
            return (
              <div key={s.i} style={{
                display: 'grid', gridTemplateColumns: '24px 16px 110px 1fr',
                gap: 10, padding: '4px 8px', alignItems: 'center', fontSize: 12,
              }}>
                <span className="c-ink4 mono">{String(s.i).padStart(2, '0')}</span>
                <span style={{ color: tdef.color }}>
                  {s.k === 'tool' ? '▸' : s.k === 'inference' ? '∿' : s.k === 'workflow' ? '⊟' : s.k === 'prompt' ? '¶' : '◇'}
                </span>
                <span className="mono" style={{ color: tdef.color }}>{s.k}</span>
                <span>
                  <span className="mono c-ink0 b">{s.ref}</span>
                  <span className="c-ink3"> — {s.note}</span>
                </span>
              </div>
            );
          })}
          <div className="divider dashed"/>
          <div className="row gap-12">
            <span className="kbd-hint"><span className="kbd">e</span> edit composition</span>
            <span className="kbd-hint"><span className="kbd">v</span> view as workflow graph</span>
            <span className="kbd-hint"><span className="kbd">+</span> swap any block</span>
            <span className="flex-1"/>
            <span className="t-small c-ink3">composition can be rewritten without changing the external contract</span>
          </div>
        </div>

        <div className="stack gap-12">
          <Panel title="BOUND MODEL" onBg1>
            <div className="row gap-8">
              <span className="mono c-accent b" style={{ fontSize: 14 }}>claude-sonnet-4.5</span>
              <Badge variant="accent" mono>Tier 1</Badge>
            </div>
            <div className="t-small c-ink2" style={{ marginTop: 6 }}>200K ctx · $3/$15 · q 9.1</div>
            <div className="t-small c-ink3" style={{ marginTop: 4 }}>fallback → haiku-4 on cost cap</div>
          </Panel>

          <Panel title="ALLOWED TOOLS" onBg1>
            <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
              {['read-file', 'edit-file', 'shell', 'git'].map(t => (
                <Badge key={t} variant="outline" mono>{t}</Badge>
              ))}
            </div>
          </Panel>

          <Panel title="MEMORY" onBg1>
            <div className="mono c-ink1" style={{ fontSize: 12 }}>mem.coder-context v1</div>
            <div className="t-small c-ink3">project-scoped</div>
          </Panel>

          <Panel title="POLICIES" onBg1>
            <div className="mono" style={{ fontSize: 11, lineHeight: 1.7 }}>
              <div className="row gap-4"><Ic n="check" size={11} style={{ color: 'var(--ok)' }}/> pol.tier-budget v3</div>
              <div className="row gap-4"><Ic n="check" size={11} style={{ color: 'var(--ok)' }}/> pol.fs-readonly v1</div>
              <div className="row gap-4"><Ic n="check" size={11} style={{ color: 'var(--ok)' }}/> hook.sign-off-destructive</div>
            </div>
          </Panel>
        </div>
      </div>
    </Panel>
  </>
);

/* ═══════════════════════════════════════════════════════════════
   WORKFLOW EDITOR (keyboard) — the headliner
   ═══════════════════════════════════════════════════════════════ */

const InternalsWorkflow = ({ block }) => {
  // The current workflow as an edited list. Each step references a block + bindings.
  const initialNodes = [
    { id: 'start', kind: 'trigger',   ref: 'trg.on-pr-opened',     bind: '{ pr, repo }',                       depth: 0 },
    { id: 'plan',  kind: 'agent',     ref: 'agent.planner',        bind: '{ task: pr.title, codebase: repo }', depth: 0 },
    { id: 'spec',  kind: 'block',     ref: 'block.specify',        bind: '{ plan: plan.out }',                 depth: 0 },
    { id: 'code',  kind: 'agent',     ref: 'agent.coder',          bind: '{ plan, codebase }',                 depth: 0 },
    { id: 'test',  kind: 'agent',     ref: 'agent.tester',         bind: '{ patch: code.out }',                depth: 0 },
    { id: 'route', kind: 'router',    ref: 'router.tests-pass-or-fix', bind: '{ report: test.out }',           depth: 0 },
    { id: 'fix',   kind: 'agent',     ref: 'agent.debugger',       bind: '{ report }',                         depth: 1, branch: 'on fail' },
    { id: 'rev',   kind: 'agent',     ref: 'agent.reviewer',       bind: '{ patch: code.out }',                depth: 1, branch: 'on pass' },
    { id: 'cmt',   kind: 'tool',      ref: 'tool.git',             bind: '{ action: "commit+push" }',          depth: 0 },
    { id: 'pr',    kind: 'block',     ref: 'block.open-pr',        bind: '{ branch: cmt.out }',                depth: 0 },
  ];

  const [nodes] = useStateBd(initialNodes);
  const [focus, setFocus] = useStateBd(3);
  const [edit, setEdit]   = useStateBd(false);
  const [showAdd, setShowAdd] = useStateBd(false);

  useEffectBd(() => {
    const fn = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setFocus(i => Math.min(nodes.length - 1, i + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setFocus(i => Math.max(0, i - 1)); }
      else if (e.key === 'n') { e.preventDefault(); setShowAdd(true); }
      else if (e.key === 'Escape') setShowAdd(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [nodes.length]);

  const kindColor = (k) => {
    const t = BLOCK_TYPES[k];
    return t ? t.color : 'var(--ink-2)';
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, minHeight: 460 }}>
        <Panel title="WORKFLOW · keyboard editor" focused meta={`${nodes.length} nodes`} flush>
          <div style={{ padding: '0 0 4px' }}>
            {nodes.map((n, i) => {
              const isFocus = i === focus;
              return (
                <div key={n.id}
                     className={'tree-row' + (isFocus ? ' focus' : '')}
                     onClick={() => setFocus(i)}
                     style={{ gridTemplateColumns: '22px 16px 130px 200px 1fr 14px', gap: 10 }}>
                  <span className="c-ink4 mono">{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ color: kindColor(n.kind) }}>
                    {n.kind === 'agent' ? '◆' : n.kind === 'tool' ? '▸' : n.kind === 'router' ? '◇' : n.kind === 'trigger' ? '⚡' : '▪'}
                  </span>
                  <span style={{ color: kindColor(n.kind) }} className="mono">{n.kind}</span>
                  <span className="mono c-ink0 b" style={{ paddingLeft: n.depth * 12 }}>
                    {n.branch && <span className="c-ink3" style={{ marginRight: 6 }}>└─ {n.branch}</span>}
                    {n.id}
                  </span>
                  <span className="mono c-ink2" style={{ fontSize: 11 }}>
                    <span style={{ color: kindColor(n.kind) }}>{n.ref}</span>
                    <span className="c-ink3"> {n.bind}</span>
                  </span>
                  <span className="c-accent">{isFocus ? '❯' : ''}</span>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', background: 'var(--bg-1)',
                        display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="kbd-hint"><span className="kbd">j/k</span> nav</span>
            <span className="kbd-hint"><span className="kbd">n</span> add node</span>
            <span className="kbd-hint"><span className="kbd">d</span> delete</span>
            <span className="kbd-hint"><span className="kbd">e</span> edit binding</span>
            <span className="kbd-hint"><span className="kbd">c</span> connect</span>
            <span className="kbd-hint"><span className="kbd">r</span> rename</span>
            <span className="kbd-hint"><span className="kbd">m</span> move</span>
            <span className="flex-1"/>
            <span className="kbd-hint"><span className="kbd">⌘S</span> save</span>
            <span className="kbd-hint"><span className="kbd">⌘↵</span> dry-run</span>
          </div>
        </Panel>

        {/* Inspector for selected node */}
        <Panel title={`NODE · ${nodes[focus].id}`} focused>
          <div className="row gap-8" style={{ marginBottom: 8 }}>
            <Badge variant={nodes[focus].kind === 'agent' ? 'agent' : nodes[focus].kind === 'router' ? 'warn' : 'accent'}>{nodes[focus].kind}</Badge>
            <span className="mono c-ink0 b">{nodes[focus].id}</span>
          </div>
          <div className="t-h3" style={{ margin: '8px 0 4px' }}>Block reference</div>
          <div className="mono c-accent b" style={{ marginBottom: 4 }}>{nodes[focus].ref}</div>
          <Btn variant="ghost" size="sm" icon="arrowRight">Open block <span className="kbd" style={{ background:'transparent',borderColor:'rgba(0,0,0,0.2)',marginLeft:4 }}>o</span></Btn>

          <div className="divider dashed"/>
          <div className="t-h3" style={{ marginBottom: 4 }}>Bindings</div>
          <pre className="mono" style={{ margin: 0, fontSize: 11, color: 'var(--ink-1)', whiteSpace: 'pre-wrap',
                                         background: 'var(--bg-0)', padding: 8, border: '1px solid var(--line-soft)', borderRadius: 4 }}>
{nodes[focus].bind}
          </pre>

          <div className="divider dashed"/>
          <div className="t-h3" style={{ marginBottom: 4 }}>I/O bridge</div>
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.6 }}>
            <div className="c-ink2">in &nbsp;←  <span className="c-ink0">{nodes[focus - 1]?.id || 'trigger'}</span>.out</div>
            <div className="c-ink2">out →  <span className="c-ink0">{nodes[focus + 1]?.id || '(end)'}</span>.in</div>
          </div>

          <div className="divider dashed"/>
          <div className="t-h3" style={{ marginBottom: 4 }}>Quick actions</div>
          <div className="stack gap-4">
            <span className="kbd-hint"><span className="kbd">e</span> edit binding inline</span>
            <span className="kbd-hint"><span className="kbd">r</span> rename node id</span>
            <span className="kbd-hint"><span className="kbd">/</span> swap block reference</span>
            <span className="kbd-hint"><span className="kbd">d</span> delete (with confirm)</span>
            <span className="kbd-hint"><span className="kbd">⌘↑</span> move up · <span className="kbd">⌘↓</span> down</span>
          </div>
        </Panel>
      </div>

      {showAdd && <AddNodeModal onClose={() => setShowAdd(false)} onPick={() => setShowAdd(false)}/>}
    </>
  );
};

/* ─── Add node modal (keyboard) ─── */
const AddNodeModal = ({ onClose, onPick }) => {
  const types = Object.entries(BLOCK_TYPES);
  const [focus, setFocus] = useStateBd(0);
  useEffectBd(() => {
    const fn = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setFocus(f => Math.min(types.length - 1, f + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp')   { e.preventDefault(); setFocus(f => Math.max(0, f - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); onPick(types[focus][0]); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [focus]);
  return (
    <div className="cmdp-overlay" onClick={onClose}>
      <div className="cmdp" onClick={e => e.stopPropagation()} style={{ width: 560 }}>
        <div className="cmdp-input">
          <Ic n="plus" size={16} style={{ color: 'var(--accent)' }}/>
          <span className="c-ink0 b">Add node · pick block type</span>
          <span className="flex-1"/>
          <span className="t-small c-ink3">j/k · Enter · Esc</span>
        </div>
        <div className="cmdp-list" style={{ maxHeight: 420 }}>
          {types.map(([key, t], i) => (
            <div key={key} className={'cmdp-item' + (i === focus ? ' sel' : '')}
                 onClick={() => onPick(key)} onMouseEnter={() => setFocus(i)}
                 style={{ gridTemplateColumns: '18px 100px 1fr auto' }}>
              <span className="ic" style={{ color: t.color }}><Ic n={t.ic} size={14}/></span>
              <span className="mono c-ink0 b">{t.label}</span>
              <span className="c-ink2 t-small">{t.desc}</span>
              <span className="kbd">↵</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Other type internals
   ═══════════════════════════════════════════════════════════════ */

const InternalsTool = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
    <Panel title="IMPLEMENTATION · sandboxed">
      <pre className="mono" style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: 'var(--ink-1)',
                                     background: 'var(--bg-0)', padding: 12, border: '1px solid var(--line-soft)', borderRadius: 4,
                                     whiteSpace: 'pre-wrap' }}>
{`// tool.edit-file v2 · runs in node sandbox
export async function edit({ path, hunks }) {
  await assertAllowed(path);            // policy gate
  const before = await fs.read(path);
  const after  = applyHunks(before, hunks);
  await validator('schema.diff', { before, after });
  await fs.write(path, after);
  return { sha: hash(after), bytes: after.length };
}`}
      </pre>
    </Panel>

    <div className="stack gap-12">
      <Panel title="PERMISSIONS">
        <div className="mono" style={{ fontSize: 11, lineHeight: 1.7 }}>
          <div><span className="c-ok">+</span> filesystem.write <span className="c-ink3">(allowlisted paths)</span></div>
          <div><span className="c-ok">+</span> filesystem.read</div>
          <div><span className="c-err">−</span> network</div>
          <div><span className="c-err">−</span> shell</div>
        </div>
      </Panel>
      <Panel title="USED BY">
        <div className="mono" style={{ fontSize: 11, lineHeight: 1.7 }}>
          <div><span className="c-agent">agent.coder</span> <span className="c-ink3">3,402×</span></div>
          <div><span className="c-agent">agent.debugger</span> <span className="c-ink3">188×</span></div>
          <div><span className="c-agent">agent.docs</span> <span className="c-ink3">42×</span></div>
        </div>
      </Panel>
    </div>
  </div>
);

const InternalsPrompt = () => (
  <Panel title="TEMPLATE" meta="2,418 tok · 6 variables">
    <pre className="mono" style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: 'var(--ink-1)', whiteSpace: 'pre-wrap',
                                   background: 'var(--bg-0)', padding: 12, border: '1px solid var(--line-soft)', borderRadius: 4 }}>
{`You are agent.coder, working in workspace {{workspace}}.

PROJECT CONVENTIONS:
{{review_conventions}}

CURRENT PLAN:
{{plan}}

Use these tools when needed: {{tools}}
Available files: {{files}}
Bound model: {{model}}

When emitting a patch, follow schema.git-patch.
If you need clarification, call {{ask_user}} with one question.`}
    </pre>
    <div className="row gap-6" style={{ marginTop: 8 }}>
      <Badge variant="outline" mono>{`{{workspace}}`}</Badge>
      <Badge variant="outline" mono>{`{{plan}}`}</Badge>
      <Badge variant="outline" mono>{`{{tools}}`}</Badge>
      <Badge variant="outline" mono>{`{{files}}`}</Badge>
      <Badge variant="outline" mono>{`{{model}}`}</Badge>
      <Badge variant="outline" mono>{`{{review_conventions}}`}</Badge>
    </div>
  </Panel>
);

const InternalsSchema = () => (
  <Panel title="SCHEMA · JSON">
    <pre className="mono" style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: 'var(--ink-1)', whiteSpace: 'pre-wrap',
                                   background: 'var(--bg-0)', padding: 12, border: '1px solid var(--line-soft)', borderRadius: 4 }}>
{`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "maestro://schema.plan-step/v3",
  "type": "object",
  "required": ["id", "action", "inputs"],
  "properties": {
    "id":        { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "action":    { "enum": ["read", "edit", "shell", "git", "infer"] },
    "inputs":    { "type": "object" },
    "dependsOn": { "type": "array", "items": { "type": "string" } }
  }
}`}
    </pre>
  </Panel>
);

const InternalsDataset = () => (
  <Panel title="EVAL CORPUS · ds.commit-eval v2" meta="24 examples">
    <table className="tbl" style={{ fontSize: 11 }}>
      <thead><tr><th>#</th><th>Input (diff)</th><th>Expected message</th><th>Tags</th></tr></thead>
      <tbody>
        {[
          { i: 1, in: 'feat-auth.diff',     out: 'feat(auth): add SSO via SAML', tags: 'feat · auth' },
          { i: 2, in: 'fix-race.diff',      out: 'fix(scheduler): race on queue empty', tags: 'fix · perf' },
          { i: 3, in: 'refactor-fs.diff',   out: 'refactor(fs): extract path helpers', tags: 'refactor' },
          { i: 4, in: 'docs-readme.diff',   out: 'docs(readme): clarify install steps', tags: 'docs' },
          { i: 5, in: 'chore-deps.diff',    out: 'chore(deps): bump react 18.3', tags: 'chore' },
          { i: 6, in: 'perf-cache.diff',    out: 'perf(cache): use LRU eviction', tags: 'perf' },
        ].map(r => (
          <tr key={r.i}>
            <td className="c-ink3 mono">{r.i}</td>
            <td className="mono c-ink0">{r.in}</td>
            <td className="mono c-ink1">{r.out}</td>
            <td className="c-ink2 t-small">{r.tags}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="t-small c-ink3" style={{ marginTop: 8 }}>+ 18 more</div>
  </Panel>
);

const InternalsRouter = () => (
  <Panel title="ROUTING RULES">
    <pre className="mono" style={{ margin: 0, fontSize: 11, lineHeight: 1.7, color: 'var(--ink-1)',
                                   background: 'var(--bg-0)', padding: 12, border: '1px solid var(--line-soft)', borderRadius: 4 }}>
{`route(input) {
  if (input.tests_pass === true)
    → "reviewer"
  else if (input.tests_pass === false)
    → "debugger"
  else
    → "?? (unhandled)"
}`}
    </pre>
    <div className="row gap-6" style={{ marginTop: 8 }}>
      <Badge variant="ok">2 branches</Badge>
      <Badge variant="outline">0 fallthroughs</Badge>
    </div>
  </Panel>
);

const InternalsGeneric = ({ block }) => (
  <Panel title="DEFINITION">
    <div className="c-ink2 t-body">
      {BLOCK_TYPES[block.type]?.desc || 'No description.'}
    </div>
  </Panel>
);

/* ═══════════════════════════════════════════════════════════════
   CONTRACT internals — role definition + LEADERBOARD of candidates
   ═══════════════════════════════════════════════════════════════ */

// candidates that implement each contract (sample data)
const CONTRACT_CANDIDATES = {
  'contract.diff-to-commit-message': [
    { block: 'commit-message.generator', v: 'v3.5',  ver: 'haiku-4',     fit: 0.89, cost: '$0.011', lat: '1.4s', pass: true,  when: 'just now',   publisher: 'you' },
    { block: 'inf.commit-type',         v: 'v1',    ver: 'sonnet-4.5',  fit: 0.83, cost: '$0.002', lat: '0.6s', pass: false, when: '2h ago',     publisher: 'you' },
    { block: 'agent.coder',             v: 'v6 [adapter]', ver: 'sonnet-4.5', fit: 0.78, cost: '$0.020', lat: '1.8s', pass: false, when: 'yesterday', publisher: 'maestro/core' },
    { block: 'gpt-4o-naive-prompt',     v: 'v1',    ver: 'gpt-4o',      fit: 0.62, cost: '$0.018', lat: '1.6s', pass: false, when: '3d ago',     publisher: 'you' },
    { block: 'baseline',                v: 'v0',    ver: 'echo',         fit: 0.21, cost: '$0',     lat: '0.0s', pass: false, when: '4d ago',     publisher: 'maestro/core' },
  ],
  'contract.implement-from-plan': [
    { block: 'agent.coder',          v: 'v6',   ver: 'sonnet-4.5',  fit: 0.88, cost: '$0.18',  lat: '6m 12s', pass: true,  when: 'now',      publisher: 'maestro/core' },
    { block: 'agent.coder',          v: 'v5',   ver: 'sonnet-4.5',  fit: 0.84, cost: '$0.22',  lat: '7m 04s', pass: false, when: '2d ago',   publisher: 'maestro/core' },
    { block: 'agent.coder.fast',     v: 'v3',   ver: 'haiku-4',     fit: 0.81, cost: '$0.04',  lat: '2m 22s', pass: false, when: 'yesterday', publisher: 'you' },
    { block: 'opus-direct',          v: 'v1',   ver: 'opus-4',      fit: 0.92, cost: '$1.20',  lat: '14m',    pass: true,  when: 'a week ago', publisher: 'you' },
    { block: 'agent.swarm-coder',    v: 'v2',   ver: 'mixed',       fit: 0.71, cost: '$0.46',  lat: '11m 30s',pass: false, when: '2w ago',   publisher: 'others' },
    { block: 'local-qwen',           v: 'v1',   ver: 'qwen-2.5-coder', fit: 0.66, cost: 'free', lat: '8m',  pass: false, when: '3w ago',   publisher: 'you' },
  ],
  'contract.review-patch': [
    { block: 'agent.reviewer',       v: 'v3',   ver: 'opus-4',      fit: 0.91, cost: '$0.11', lat: '1.4s', pass: true,  when: 'now',     publisher: 'maestro/core' },
    { block: 'agent.reviewer',       v: 'v2',   ver: 'sonnet-4.5',  fit: 0.86, cost: '$0.08', lat: '1.2s', pass: true,  when: '5d ago',  publisher: 'maestro/core' },
    { block: 'agent.security-review',v: 'v1',   ver: 'opus-4',      fit: 0.78, cost: '$0.18', lat: '2.4s', pass: false, when: '2d ago',  publisher: 'you' },
  ],
};

const InternalsContract = ({ block }) => {
  const candidates = CONTRACT_CANDIDATES[block.id] || CONTRACT_CANDIDATES['contract.diff-to-commit-message'];
  const threshold = 0.85;
  const complexityColors = { simple: 'var(--ok)', moderate: 'var(--warn)', complex: 'var(--err)' };
  return (
    <>
      {/* Role description */}
      <Panel title="ROLE" focused>
        <div className="row gap-8" style={{ marginBottom: 8 }}>
          <span className="t-h1" style={{ fontSize: 18 }}>{block.role || 'Untitled role'}</span>
          <Badge variant="outline" mono style={{ borderColor: complexityColors[block.complexity], color: complexityColors[block.complexity] }}>
            {block.complexity || 'unknown'}
          </Badge>
          <span className="flex-1"/>
          <span className="t-small c-ink2">
            <span className="c-ink0 b">{block.candidates}</span> candidates · <span className="c-ok b">{block.passing}</span> passing · threshold <span className="mono c-ink0">{threshold.toFixed(2)}</span>
          </span>
        </div>
        <div className="t-body" style={{ color: 'var(--ink-1)', lineHeight: 1.7, maxWidth: 720 }}>
          {block.desc}
        </div>
        <div className="divider dashed"/>
        <div className="row gap-12">
          <span className="kbd-hint"><span className="kbd">e</span> edit role · description</span>
          <span className="kbd-hint"><span className="kbd">⌘+R</span> run a candidate</span>
          <span className="kbd-hint"><span className="kbd">⌘+E</span> change eval criteria</span>
        </div>
      </Panel>

      <div style={{ height: 16 }}/>

      {/* In/out schemas + eval criteria side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Panel title="INTERFACE · inputs ↔ outputs">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', alignItems: 'stretch' }}>
            <div>
              <div className="t-h3" style={{ marginBottom: 6 }}>↳ inputs</div>
              {[
                { name: 'diff',  type: 'GitDiff',  req: true,  desc: 'Unified diff format. ≤ 30 hunks, ≤ 50KB.' },
                { name: 'style', type: 'CommitStyle?', req: false, desc: 'Override project style. Default: read .commitlintrc.' },
                { name: 'scope_hints', type: 'string[]?', req: false, desc: 'Optional scope keywords for the message header.' },
              ].map(f => (
                <div key={f.name} style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: '6px 10px', background: 'var(--bg-0)', marginBottom: 6 }}>
                  <div className="row gap-6">
                    <span className="mono c-ink0 b">{f.name}</span>
                    <span className="c-accent t-small">{f.type}</span>
                    <span style={{ fontSize: 9, color: f.req ? 'var(--err)' : 'var(--ink-3)' }}>{f.req ? 'REQ' : 'OPT'}</span>
                  </div>
                  <div className="t-small c-ink2" style={{ marginTop: 2 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderLeft: '1px dashed var(--line)', borderRight: '1px dashed var(--line)' }}>
              <Ic n="arrowRight" size={14} style={{ color: 'var(--accent)' }}/>
            </div>
            <div>
              <div className="t-h3" style={{ marginBottom: 6 }}>outputs ↴</div>
              {[
                { name: 'message',     type: 'ConventionalCommit', desc: 'Single-line: type(scope): description. ≤ 72 chars.' },
                { name: 'confidence',  type: 'number',             desc: '0–1. Caller may reject below threshold.' },
                { name: 'rationale?',  type: 'string',             desc: 'Optional explanation for the chosen type/scope.' },
              ].map(f => (
                <div key={f.name} style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: '6px 10px', background: 'var(--bg-0)', marginBottom: 6 }}>
                  <div className="row gap-6">
                    <span className="mono c-ink0 b">{f.name}</span>
                    <span className="c-accent t-small">{f.type}</span>
                  </div>
                  <div className="t-small c-ink2" style={{ marginTop: 2 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="EVAL CRITERIA · how candidates are scored">
          <div className="t-h3" style={{ marginBottom: 4 }}>Evaluator</div>
          <div className="mono c-ok b">eval.semantic-diff v2</div>
          <div className="t-small c-ink2" style={{ marginTop: 2 }}>+ format compliance bonus (val.commit-format)</div>

          <div className="divider dashed"/>
          <div className="t-h3" style={{ marginBottom: 4 }}>Dataset</div>
          <div className="mono c-ok b">ds.commit-eval v2</div>
          <div className="t-small c-ink2" style={{ marginTop: 2 }}>24 hand-curated examples</div>

          <div className="divider dashed"/>
          <div className="t-h3" style={{ marginBottom: 4 }}>Pass threshold</div>
          <div className="row gap-6" style={{ alignItems: 'baseline' }}>
            <span className="mono c-ink0 b" style={{ fontSize: 20 }}>0.85</span>
            <span className="t-small c-ink3">semantic similarity ≥ 0.85 AND format compliant</span>
          </div>

          <div className="divider dashed"/>
          <div className="t-h3" style={{ marginBottom: 4 }}>Weights</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px 8px', fontSize: 11 }}>
            <span className="c-ink2">semantic</span><Bar value={70}/><span className="mono c-ink0">0.70</span>
            <span className="c-ink2">format</span>  <Bar value={20}/><span className="mono c-ink0">0.20</span>
            <span className="c-ink2">brevity</span> <Bar value={10}/><span className="mono c-ink0">0.10</span>
          </div>
        </Panel>
      </div>

      <div style={{ height: 16 }}/>

      {/* LEADERBOARD — the heart of contracts */}
      <Panel title="LEADERBOARD · candidates ranked by fitness"
             meta={`${candidates.length} runs · pass threshold ${threshold.toFixed(2)}`}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Candidate block</th>
              <th>Model</th>
              <th>Fitness</th>
              <th>Cost / run</th>
              <th>Latency</th>
              <th>Pass</th>
              <th>Last run</th>
              <th>By</th>
              <th/>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, i) => (
              <tr key={i} className={i === 0 ? 'active' : ''}>
                <td>
                  {i === 0 ? <span className="c-accent b mono">★ 1</span> : <span className="c-ink3 mono">{i + 1}</span>}
                </td>
                <td>
                  <div className="row gap-6">
                    <span className="mono c-ink0 b">{c.block}</span>
                    <Badge variant="outline" mono>{c.v}</Badge>
                  </div>
                </td>
                <td className="mono c-ink2">{c.ver}</td>
                <td>
                  <div className="row gap-6" style={{ alignItems: 'center' }}>
                    <span className={'mono b ' + (c.pass ? 'c-ok' : c.fit > 0.7 ? 'c-warn' : 'c-err')}>{c.fit.toFixed(2)}</span>
                    <div style={{ flex: 1, maxWidth: 80 }}>
                      <Bar value={c.fit * 100} variant={c.pass ? 'ok' : c.fit > 0.7 ? 'warn' : 'err'}/>
                    </div>
                  </div>
                </td>
                <td className="mono c-ink1">{c.cost}</td>
                <td className="mono c-ink2">{c.lat}</td>
                <td>
                  {c.pass
                    ? <Badge variant="ok"><Ic n="check" size={10}/> pass</Badge>
                    : <Badge variant="err"><Ic n="x" size={10}/> fail</Badge>}
                </td>
                <td className="c-ink3 t-small">{c.when}</td>
                <td className="mono c-ink3 t-small">{c.publisher}</td>
                <td>
                  <Btn variant="ghost" size="sm" iconRight="arrowRight">Open</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="divider dashed"/>
        <div className="row gap-12" style={{ padding: '4px 4px 0' }}>
          <span className="kbd-hint"><span className="kbd">⌘+R</span> run a new candidate</span>
          <span className="kbd-hint"><span className="kbd">⌘+B</span> compare top-3 in bench</span>
          <span className="kbd-hint"><span className="kbd">j/k</span> nav</span>
          <span className="flex-1"/>
          <span className="t-small c-ink3">
            Best so far: <span className="c-accent b mono">{candidates[0].block}</span> at <span className="c-ok b">{candidates[0].fit.toFixed(2)}</span>
          </span>
        </div>
      </Panel>

      <div style={{ height: 16 }}/>

      {/* Sub-contracts (for complex contracts) */}
      {block.complexity === 'complex' && (
        <Panel title="DECOMPOSITION · sub-contracts this depends on">
          <div className="t-small c-ink2" style={{ marginBottom: 10 }}>
            A complex contract is built from smaller contracts. An agent fulfilling this is expected to compose blocks fulfilling each sub-contract.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(block.id === 'contract.implement-from-plan' ? [
              { id: 'contract.read-codebase',        pass: 9, total: 11 },
              { id: 'contract.propose-patch-hunks',  pass: 6, total: 9 },
              { id: 'contract.run-tests',            pass: 5, total: 5 },
              { id: 'contract.fix-failing-test',     pass: 3, total: 7 },
              { id: 'contract.summarize-changes',    pass: 4, total: 4 },
            ] : [
              { id: 'contract.classify-task',     pass: 6, total: 8 },
              { id: 'contract.list-dependencies', pass: 5, total: 5 },
              { id: 'contract.order-steps',       pass: 3, total: 6 },
            ]).map((sub, i) => (
              <div key={i} style={{ padding: 10, border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-1)', minWidth: 220 }}>
                <div className="mono c-accent b" style={{ fontSize: 12 }}>{sub.id}</div>
                <div className="row gap-6" style={{ marginTop: 4, fontSize: 11 }}>
                  <span className="c-ok b mono">{sub.pass}</span>
                  <span className="c-ink3">/</span>
                  <span className="mono">{sub.total}</span>
                  <span className="c-ink3">candidates pass</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <Bar value={(sub.pass / sub.total) * 100} variant={sub.pass / sub.total > 0.7 ? 'ok' : sub.pass / sub.total > 0.4 ? 'warn' : 'err'}/>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAGE · Block detail (the rich internals viewer)
   ═══════════════════════════════════════════════════════════════ */
const PageBlockNew = ({ block: blockProp, onRoute }) => {
  // Default block if none passed
  const block = blockProp || BLOCKS.find(b => b.id === 'workflow.feature-pipeline') || BLOCKS[0];
  const t = BLOCK_TYPES[block.type] || BLOCK_TYPES.agent;
  const [tab, setTab] = useStateBd('internals');

  useEffectBd(() => {
    const fn = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey) setTab('internals');
      else if (e.key === 'C' && e.shiftKey) setTab('contract');
      else if (e.key === 'I' && e.shiftKey) setTab('iterations');
      else if (e.key === 'T' && e.shiftKey) setTab('tests');
      else if (e.key === 'U' && e.shiftKey) setTab('usage');
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const Internals = ({
    agent:       () => <InternalsAgent block={block}/>,
    workflow:    () => <InternalsWorkflow block={block}/>,
    tool:        () => <InternalsTool/>,
    inference:   () => <InternalsAgent block={block}/>,        // similar to agent
    transformer: () => <InternalsTool/>,                       // implementation view
    prompt:      () => <InternalsPrompt/>,
    schema:      () => <InternalsSchema/>,
    dataset:     () => <InternalsDataset/>,
    validator:   () => <InternalsSchema/>,
    evaluator:   () => <InternalsTool/>,
    router:      () => <InternalsRouter/>,
    memory:      () => <InternalsGeneric block={block}/>,
    trigger:     () => <InternalsGeneric block={block}/>,
    hook:        () => <InternalsGeneric block={block}/>,
    policy:      () => <InternalsGeneric block={block}/>,
    contract:    () => <InternalsContract block={block}/>,
  }[block.type]) || (() => <InternalsGeneric block={block}/>);

  return (
    <div className="main" style={{ overflow: 'auto' }}>
      {/* Top bar with breadcrumb */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)',
      }}>
        <button className="btn ghost sm" onClick={() => onRoute?.('foundry')}>
          <Ic n="chevron" size={11} style={{ transform: 'rotate(180deg)' }}/>
          Foundry
        </button>
        <span className="c-ink3">/</span>
        <Badge variant="outline" mono>{t.label}</Badge>
        <span className="mono c-ink0 b" style={{ fontSize: 16 }}>{block.id}</span>
        <Badge variant="outline" mono>{block.v || 'v0'}</Badge>
        <Badge variant={block.scope === 'user' ? 'agent' : 'outline'}>{block.scope}</Badge>
        {block.agentInControl && (
          <Badge variant="agent"><span className="dot pulse" style={{ background: 'var(--agent)' }}/> agent active</Badge>
        )}
        <span className="flex-1"/>
        <span className="kbd-hint"><span className="kbd">e</span> edit</span>
        <span className="kbd-hint"><span className="kbd">/</span> swap ref</span>
        <Btn variant="ghost" size="sm" icon="git">Source</Btn>
        <Btn variant="outline" size="sm" icon="play">Run · playground</Btn>
        <Btn variant="primary" size="sm" icon="foundry">Train · forge</Btn>
      </div>

      {/* Subtabs */}
      <div className="subtabs">
        {[
          { id: 'internals',  l: 'Internals',  ic: 'code',     k: 'i' },
          { id: 'contract',   l: 'Contract',   ic: 'contract', k: 'C' },
          { id: 'iterations', l: 'Iterations', ic: 'history',  k: 'I' },
          { id: 'tests',      l: 'Tests',      ic: 'check',    k: 'T' },
          { id: 'usage',      l: 'Usage',      ic: 'activity', k: 'U' },
        ].map(o => (
          <div key={o.id} className={'subtab' + (tab === o.id ? ' active' : '')} onClick={() => setTab(o.id)}>
            <Ic n={o.ic} size={12}/> {o.l}
            <span className="kbd" style={{ marginLeft: 6, fontSize: 9 }}>{o.k}</span>
          </div>
        ))}
        <span style={{ flex: 1 }}/>
        <span className="c-ink3 t-small" style={{ alignSelf: 'center', paddingRight: 16 }}>{t.desc}</span>
      </div>

      <div style={{ padding: 18 }}>
        {tab === 'internals' && <Internals/>}
        {tab === 'contract' && <ContractWidget block={block.id}/>}
        {tab === 'iterations' && (
          <Panel title="ITERATIONS · self-improving" meta="12 since v3.0">
            <table className="tbl">
              <thead><tr><th style={{ width: 14 }}/><th>Ver</th><th>Hypothesis</th><th>Model</th><th>Dataset</th><th>Fitness</th><th>Cost</th><th>By</th></tr></thead>
              <tbody>
                {[
                  { st: 'idle', v: 'v3.0', h: 'baseline',                  m: 'sonnet-4.5', d: 'ds.commit-eval v1', f: '0.71', c: '$0.020', who: 'you' },
                  { st: 'ok',   v: 'v3.1', h: 'add few-shot examples',     m: 'sonnet-4.5', d: 'ds.commit-eval v1', f: '0.78', c: '$0.022', who: 'you' },
                  { st: 'err',  v: 'v3.2', h: 'cheaper backbone',          m: 'gpt-4o-mini',d: 'ds.commit-eval v2', f: '0.74', c: '$0.008', who: 'agent.maestro' },
                  { st: 'ok',   v: 'v3.3', h: 'add diff summarization',    m: 'haiku-4',    d: 'ds.commit-eval v2', f: '0.82', c: '$0.010', who: 'agent.maestro' },
                  { st: 'ok',   v: 'v3.4', h: 'schema-constrained output', m: 'haiku-4',    d: 'ds.commit-eval v2', f: '0.87', c: '$0.011', who: 'agent.maestro' },
                  { st: 'active',v:'v3.5',h: 'tighten temperature',       m: 'haiku-4',    d: 'ds.commit-eval v2', f: '— ',  c: '— ',     who: 'agent.maestro' },
                ].map((r, i) => (
                  <tr key={i} className={r.st === 'active' ? 'active' : ''}>
                    <td>
                      {r.st === 'ok'  && <Ic n="check" size={11} style={{ color: 'var(--ok)' }}/>}
                      {r.st === 'err' && <Ic n="x" size={11} style={{ color: 'var(--err)' }}/>}
                      {r.st === 'active' && <StatusDot status="ok" pulse/>}
                      {r.st === 'idle' && <span className="c-ink4">○</span>}
                    </td>
                    <td className="mono c-ink2">{r.v}</td>
                    <td className="c-ink1">{r.h}</td>
                    <td className="mono c-ink2">{r.m}</td>
                    <td className="mono c-ink3">{r.d}</td>
                    <td className={'mono b ' + (r.st === 'active' ? 'c-accent' : r.st === 'ok' && parseFloat(r.f) > 0.85 ? 'c-ok' : 'c-ink0')}>{r.f}</td>
                    <td className="mono c-ink2">{r.c}</td>
                    <td className="mono c-ink3">{r.who === 'agent.maestro' ? <span className="c-agent">{r.who}</span> : r.who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
        {tab === 'tests' && (
          <Panel title="EVAL RESULTS · ds.commit-eval v2 · iter v3.4">
            <div className="t-small c-ink2" style={{ marginBottom: 12 }}>
              24 examples · <span className="c-ok b">21 pass</span> · <span className="c-warn b">2 partial</span> · <span className="c-err b">1 fail</span>
            </div>
            <table className="tbl" style={{ fontSize: 11 }}>
              <thead><tr><th>#</th><th>Example</th><th>Expected</th><th>Produced</th><th>Score</th><th>Pass</th></tr></thead>
              <tbody>
                {[
                  { i: 1, x: 'feat-auth',  e: 'feat(auth): add SSO via SAML', p: 'feat(auth): add SSO via SAML', s: '0.98', ok: 'pass' },
                  { i: 2, x: 'fix-race',   e: 'fix(scheduler): race on queue empty', p: 'fix(scheduler): race on queue empty', s: '0.94', ok: 'pass' },
                  { i: 3, x: 'refactor-fs',e: 'refactor(fs): extract path helpers', p: 'refactor(fs): extract pathlib', s: '0.81', ok: 'partial' },
                  { i: 4, x: 'docs-readme',e: 'docs(readme): clarify install', p: 'docs(readme): clarify install steps', s: '0.92', ok: 'pass' },
                  { i: 5, x: 'chore-deps', e: 'chore(deps): bump react 18.3', p: 'chore: update dependencies', s: '0.42', ok: 'fail' },
                  { i: 6, x: 'perf-cache', e: 'perf(cache): use LRU eviction', p: 'perf(cache): use LRU eviction', s: '0.99', ok: 'pass' },
                ].map(r => (
                  <tr key={r.i}>
                    <td className="c-ink3">{r.i}</td>
                    <td className="mono c-ink0">{r.x}</td>
                    <td className="mono c-ink2">{r.e}</td>
                    <td className="mono">{r.p}</td>
                    <td className={'mono b ' + (parseFloat(r.s) > 0.85 ? 'c-ok' : parseFloat(r.s) > 0.7 ? 'c-warn' : 'c-err')}>{r.s}</td>
                    <td><Badge variant={r.ok === 'pass' ? 'ok' : r.ok === 'partial' ? 'warn' : 'err'}>{r.ok}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
        {tab === 'usage' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Panel title="WHERE I AM USED">
              <div className="mono" style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div><span className="c-accent">▣</span> workflow.feature-pipeline <span className="c-ink3">3,402×</span></div>
                <div><span className="c-accent">▣</span> workflow.bugfix-loop <span className="c-ink3">218×</span></div>
                <div><span className="c-accent">▣</span> workflow.docs-pass <span className="c-ink3">22×</span></div>
              </div>
            </Panel>
            <Panel title="TELEMETRY · 30d">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 12 }}>
                <span className="c-ink2">Total runs</span>             <span className="mono c-ink0 b">3,642</span>
                <span className="c-ink2">Success rate</span>           <span className="mono c-ok b">93%</span>
                <span className="c-ink2">Avg latency</span>            <span className="mono c-ink0">1.4s</span>
                <span className="c-ink2">Tokens per run</span>          <span className="mono c-ink0">4,218</span>
                <span className="c-ink2">Cost per run</span>           <span className="mono c-ink0">$0.18</span>
                <span className="c-ink2">P95 latency</span>            <span className="mono c-ink0">3.2s</span>
                <span className="c-ink2">Top failure</span>            <span className="c-err mono">tool denied (1%)</span>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { PageBlockNew });
