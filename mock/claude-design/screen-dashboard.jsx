/* global React, Icon, StatusDot, Badge, Button, Panel, SectionHeader, Sparkline, Progress */
const { useState: useStateD, useEffect: useEffectD } = React;

const DashboardScreen = ({ onNavigate }) => {
  // services
  const services = [
    { name: 'Backend',     port: 5000, status: 'healthy', latency: 12, detail: '.NET API · 14m uptime' },
    { name: 'LLM Provider', port: 5010, status: 'healthy', latency: 8,  detail: 'Routing 3 providers' },
    { name: 'Frontend',    port: 5173, status: 'healthy', latency: 2,  detail: 'Vite HMR active' },
    { name: 'SignalR',     port: 5000, status: 'degraded', latency: 84, detail: 'High reconnect rate' },
  ];

  const sessions = [
    { id: 'ses_8af4', name: 'Cantante — File Tree Module', status: 'running', agent: 'Coder', model: 'claude-sonnet-4.5', phase: 'Implement step 3/7', progress: 42, elapsed: '14m 22s', repo: 'cantante' },
    { id: 'ses_71bc', name: 'Maestro — Telemetry Backfill', status: 'running', agent: 'Tester', model: 'gpt-4o', phase: 'Generate integration tests', progress: 68, elapsed: '32m 04s', repo: 'maestro' },
    { id: 'ses_29de', name: 'Cantante — Commit Agent Training', status: 'running', agent: 'Foundry',  model: 'llama-3.1-70b', phase: 'Benchmark vs baseline', progress: 91, elapsed: '1h 12m', repo: 'cantante' },
    { id: 'ses_4a09', name: 'Auth refactor — review pass', status: 'paused',  agent: 'Reviewer', model: 'gpt-4o-mini', phase: 'Awaiting confirmation', progress: 55, elapsed: '8m 41s', repo: 'auth' },
    { id: 'ses_e2c1', name: 'Cantante — Dependency upgrade', status: 'success', agent: 'Coder', model: 'claude-sonnet-4.5', phase: 'PR #284 opened', progress: 100, elapsed: '23m 11s', repo: 'cantante' },
  ];

  return (
    <div data-screen-label="01 Dashboard" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto', height: '100%' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Overview</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
            All systems nominal. <span style={{ color: 'var(--fg-2)' }}>3 sessions running.</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon="terminal" size="md">Terminal</Button>
          <Button variant="outline" icon="search" size="md">
            Command palette
            <span className="kbd" style={{ marginLeft: 4 }}>⌘K</span>
          </Button>
          <Button variant="primary" icon="plus" size="md">New session</Button>
        </div>
      </div>

      {/* stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Active sessions" value="3" delta="+1" trend={[2,2,3,3,3,4,3,3,3,3]} icon="activity"/>
        <StatCard label="Blocks available" value="142" delta="+4" trend={[130,131,135,136,138,138,140,141,142,142]} icon="blocks"/>
        <StatCard label="Tokens (24h)" value="2.41M" delta="+18%" trend={[1.1,1.3,1.4,1.7,1.6,1.9,2.0,2.2,2.3,2.4]} icon="bolt"/>
        <StatCard label="Cost (24h)" value="$8.42" delta="-12%" trend={[12,11,10,11,9.5,9,8.8,8.5,8.4,8.4]} icon="pulse" negative/>
      </div>

      {/* services + sessions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, flex: 1, minHeight: 0 }}>
        {/* sessions */}
        <Panel title="Sessions" icon="activity" actions={
          <>
            <Badge variant="outline" mono>{sessions.length} total</Badge>
            <Button size="sm" variant="ghost" icon="refresh"/>
            <Button size="sm" variant="ghost">View all <Icon name="arrowRight" size={12}/></Button>
          </>
        } flush>
          <div>
            {sessions.map((s, i) => (
              <SessionRow key={s.id} session={s} onClick={() => onNavigate('session', { id: s.id })} last={i === sessions.length - 1}/>
            ))}
          </div>
        </Panel>

        {/* right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <Panel title="Services" icon="cpu" actions={<Badge variant="ok">3 of 4 healthy</Badge>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {services.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusDot status={s.status === 'healthy' ? 'success' : s.status === 'degraded' ? 'warning' : 'error'} pulse={s.status==='healthy'}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{s.name} <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>:{s.port}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>{s.detail}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{s.latency}ms</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Active model" icon="sparkle" actions={<Badge variant="accent" mono>claude-sonnet-4.5</Badge>}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <Metric label="Context" value="200K"/>
              <Metric label="In / Out" value="$3 / $15"/>
              <Metric label="Avg latency" value="1.2s"/>
              <Metric label="Quality" value="9.1" pillColor="ok"/>
            </div>
          </Panel>

          <Panel title="Workspaces" icon="folder" actions={<Button size="sm" variant="ghost" icon="plus"/>} flush>
            <div>
              <WorkspaceRow name="cantante" sessions={3} progress={62}/>
              <WorkspaceRow name="maestro" sessions={1} progress={68}/>
              <WorkspaceRow name="auth-service" sessions={1} progress={55}/>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, delta, trend, icon, negative }) => {
  const positive = delta?.startsWith('+');
  const isCost = negative; // for cost, down is good
  const good = (positive && !isCost) || (!positive && isCost);
  return (
    <div style={{
      padding: 14, background: 'var(--bg-1)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: 'var(--shadow-1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)', fontSize: 11 }}>
          <Icon name={icon} size={12}/>{label}
        </div>
        {delta && <span style={{
          fontSize: 11, padding: '1px 6px', borderRadius: 4,
          color: good ? 'var(--ok)' : 'var(--fg-2)',
          background: good ? 'var(--ok-soft)' : 'transparent',
          fontFamily: 'var(--font-mono)',
        }}>{delta}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>{value}</div>
        <Sparkline values={trend} color={good ? 'var(--ok)' : 'var(--accent)'}/>
      </div>
    </div>
  );
};

const Metric = ({ label, value, pillColor }) => (
  <div>
    <div style={{ color: 'var(--fg-2)', fontSize: 11 }}>{label}</div>
    {pillColor
      ? <Badge variant={pillColor} mono style={{ marginTop: 2 }}>{value}</Badge>
      : <div className="mono" style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{value}</div>}
  </div>
);

const WorkspaceRow = ({ name, sessions, progress }) => (
  <div style={{
    padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    borderTop: '1px solid var(--line)',
  }}>
    <Icon name="folder" size={13} style={{ color: 'var(--fg-2)' }}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{name}</span>
        <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{sessions} session{sessions>1?'s':''}</span>
      </div>
      <div style={{ marginTop: 4 }}><Progress value={progress}/></div>
    </div>
  </div>
);

const SessionRow = ({ session, onClick, last }) => {
  const statusMap = {
    running: { color: 'running', label: 'running', pulse: true },
    paused:  { color: 'warning', label: 'paused', pulse: false },
    success: { color: 'success', label: 'completed', pulse: false },
  };
  const sm = statusMap[session.status] || statusMap.running;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: '14px 1fr 130px 130px 80px 18px',
        gap: 14, alignItems: 'center',
        borderTop: '1px solid var(--line)',
        cursor: 'pointer',
        transition: 'background 80ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <StatusDot status={sm.color} pulse={sm.pulse}/>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, color: 'var(--fg-2)', fontSize: 11 }}>
          <span className="mono">{session.id}</span>
          <span>·</span>
          <span>{session.phase}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Badge variant="agent">{session.agent}</Badge>
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{session.model}</span>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-2)', marginBottom: 3 }}>
          <span className="mono">{session.progress}%</span>
          <span className="mono">{session.elapsed}</span>
        </div>
        <Progress value={session.progress} color={session.status === 'success' ? 'var(--ok)' : session.status === 'paused' ? 'var(--warn)' : 'var(--accent)'}/>
      </div>
      <Icon name="chevron" size={14} style={{ color: 'var(--fg-3)' }}/>
    </div>
  );
};

Object.assign(window, { DashboardScreen });
