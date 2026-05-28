/* global React, Icon, StatusDot, Badge, Button, Input, Sparkline */
const { useState: useStateCat } = React;

const CatalogScreen = ({ onNavigate }) => {
  const [filter, setFilter] = useStateCat('all');
  const [scope, setScope] = useStateCat('all');

  const blocks = [
    { id: 'agent.planner',         type: 'agent', scope: 'global',  v: 'v4', desc: 'Breaks a high-level task into ordered, actionable steps.', uses: 1240, fit: 0.91, cost: '$0.08', tools: ['read-file','shell'], inputs: ['task'], outputs: ['plan'] },
    { id: 'agent.coder',           type: 'agent', scope: 'global',  v: 'v6', desc: 'Implements code changes based on a plan or spec.', uses: 3402, fit: 0.88, cost: '$0.18', tools: ['edit-file','shell','git'], inputs: ['plan','codebase'], outputs: ['patch'] },
    { id: 'agent.reviewer',        type: 'agent', scope: 'global',  v: 'v3', desc: 'Reviews a patch for quality, security and conventions.', uses: 1810, fit: 0.84, cost: '$0.11', tools: ['read-file'], inputs: ['patch'], outputs: ['review'] },
    { id: 'agent.tester',          type: 'agent', scope: 'global',  v: 'v3', desc: 'Generates and runs tests against a patch.', uses: 940,  fit: 0.79, cost: '$0.09', tools: ['edit-file','shell'], inputs: ['patch'], outputs: ['report'] },
    { id: 'tool.shell',            type: 'tool',  scope: 'global',  v: 'v2', desc: 'Sandboxed shell with allowlisted commands.', uses: 18420, fit: null, cost: '$0', tools: [] },
    { id: 'tool.edit-file',        type: 'tool',  scope: 'global',  v: 'v2', desc: 'Patch-based file editor with diff preview.', uses: 9210,  fit: null, cost: '$0', tools: [] },
    { id: 'tool.git',              type: 'tool',  scope: 'global',  v: 'v1', desc: 'Branches, commits, PR creation.', uses: 5210, fit: null, cost: '$0', tools: [] },
    { id: 'workflow.feature-pipe', type: 'workflow', scope: 'project', v: 'v3', desc: 'Plan → Code → Test → Review → Commit pipeline.', uses: 218, fit: 0.86, cost: '$0.42', tools: [] },
    { id: 'workflow.bugfix',       type: 'workflow', scope: 'project', v: 'v2', desc: 'Bug repro → Fix → Regression test.', uses: 84, fit: 0.81, cost: '$0.28', tools: [] },
    { id: 'commit-message.gen',    type: 'inference', scope: 'user', v: 'v3.5', desc: 'Conventional commit message generator.', uses: 612, fit: 0.89, cost: '$0.012', tools: [] },
    { id: 'validator.schema',      type: 'tool',  scope: 'global', v: 'v1', desc: 'Validates JSON against a schema.', uses: 1140, fit: null, cost: '$0', tools: [] },
    { id: 'agent.debugger',        type: 'agent', scope: 'user',  v: 'v2', desc: 'Investigates failing tests, produces hypotheses.', uses: 188, fit: 0.74, cost: '$0.22', tools: ['read-file','shell','edit-file'] },
  ];

  const visible = blocks.filter(b =>
    (filter === 'all' || b.type === filter) &&
    (scope === 'all' || b.scope === scope)
  );

  const counts = {
    all: blocks.length,
    agent: blocks.filter(b => b.type === 'agent').length,
    tool: blocks.filter(b => b.type === 'tool').length,
    workflow: blocks.filter(b => b.type === 'workflow').length,
    inference: blocks.filter(b => b.type === 'inference').length,
  };

  return (
    <div data-screen-label="05 Catalog" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Icon name="blocks" size={18} style={{ color: 'var(--accent)' }}/>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Catalog</h1>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Block library · everything-is-a-block</span>
        <div style={{ flex: 1 }}/>
        <Input icon="search" placeholder="Search 142 blocks…" kbd="⌘P" style={{ width: 320 }}/>
        <Button variant="outline" icon="package">Import</Button>
        <Button variant="primary" icon="plus">New block</Button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '220px 1fr' }}>
        {/* sidebar */}
        <div style={{ borderRight: '1px solid var(--line)', background: 'var(--bg-1)', padding: 14, overflow: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 6 }}>Type</div>
          <SidebarItem label="All blocks"  count={counts.all}      active={filter==='all'}       onClick={() => setFilter('all')}/>
          <SidebarItem label="Agents"      count={counts.agent}    active={filter==='agent'}     onClick={() => setFilter('agent')}    icon="user"  color="var(--agent)"/>
          <SidebarItem label="Tools"       count={counts.tool}     active={filter==='tool'}      onClick={() => setFilter('tool')}     icon="terminal" color="var(--accent)"/>
          <SidebarItem label="Workflows"   count={counts.workflow} active={filter==='workflow'}  onClick={() => setFilter('workflow')} icon="graph"/>
          <SidebarItem label="Inference"   count={counts.inference} active={filter==='inference'} onClick={() => setFilter('inference')} icon="sparkle" color="var(--warn)"/>

          <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }}/>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 6 }}>Scope</div>
          <SidebarItem label="All"      count={blocks.length} active={scope==='all'}    onClick={() => setScope('all')}/>
          <SidebarItem label="Project"  count={blocks.filter(b=>b.scope==='project').length} active={scope==='project'} onClick={() => setScope('project')} icon="folder"/>
          <SidebarItem label="User"     count={blocks.filter(b=>b.scope==='user').length}    active={scope==='user'}    onClick={() => setScope('user')}    icon="user"/>
          <SidebarItem label="Global"   count={blocks.filter(b=>b.scope==='global').length}  active={scope==='global'}  onClick={() => setScope('global')}  icon="package"/>

          <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }}/>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 6 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {['code-gen','review','test','planning','refactor','docs','security'].map(t => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        </div>

        {/* grid */}
        <div style={{ overflow: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{visible.length} blocks · sorted by usage</div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 2 }}>
              <Button size="sm" variant="soft" active icon="blocks">Grid</Button>
              <Button size="sm" variant="ghost" icon="layers">List</Button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {visible.map(b => <BlockCard key={b.id} block={b}/>)}
          </div>
        </div>
      </div>
    </div>
  );
};

const SidebarItem = ({ label, count, active, onClick, icon, color }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 8px', borderRadius: 4,
      background: active ? 'var(--bg-2)' : 'transparent',
      color: active ? 'var(--fg-0)' : 'var(--fg-1)',
      cursor: 'pointer', fontSize: 12, marginBottom: 2,
      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
    }}
  >
    {icon && <Icon name={icon} size={12} style={{ color: color || 'var(--fg-2)' }}/>}
    <span style={{ flex: 1 }}>{label}</span>
    <span className="mono" style={{ fontSize: 10, color: 'var(--fg-2)' }}>{count}</span>
  </div>
);

const BlockCard = ({ block }) => {
  const typeColor = {
    agent: 'var(--agent)', tool: 'var(--accent)', workflow: 'var(--fg-1)', inference: 'var(--warn)',
  }[block.type] || 'var(--fg-1)';
  return (
    <div style={{
      padding: 14, background: 'var(--bg-1)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column', gap: 10,
      cursor: 'pointer', transition: 'border-color 80ms, transform 80ms',
      position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--line-strong)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
    >
      {/* type stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: typeColor }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge variant={block.type === 'agent' ? 'agent' : 'accent'}>{block.type}</Badge>
        <Badge variant="outline" mono>{block.v}</Badge>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }} className="mono">{block.scope}</span>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{block.id}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, textWrap: 'pretty' }}>{block.desc}</div>
      </div>
      {block.tools && block.tools.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {block.tools.map(t => <Badge key={t} variant="outline" mono>{t}</Badge>)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 'auto' }}>
        <Metric2 label="Uses" value={block.uses.toLocaleString()}/>
        {block.fit != null && <Metric2 label="Fitness" value={block.fit.toFixed(2)}/>}
        <Metric2 label="Cost/run" value={block.cost}/>
      </div>
    </div>
  );
};

const Metric2 = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    <span style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.06 }}>{label}</span>
    <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-0)' }}>{value}</span>
  </div>
);

Object.assign(window, { CatalogScreen });
