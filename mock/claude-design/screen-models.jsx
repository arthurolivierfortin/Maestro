/* global React, Icon, StatusDot, Badge, Button, Sparkline, Progress */
const { useState: useStateM } = React;

const ModelsScreen = ({ onNavigate }) => {
  const models = [
    { provider: 'anthropic', id: 'claude-sonnet-4.5', display: 'Claude Sonnet 4.5', ctx: '200K', inp: 3, out: 15, speed: 8, quality: 9.1, status: 'active', latency: 1180, tps: 84, color: '#cc785c' },
    { provider: 'anthropic', id: 'claude-opus-4',     display: 'Claude Opus 4',      ctx: '200K', inp: 15, out: 75, speed: 5, quality: 9.5, status: 'available', latency: 2400, tps: 42, color: '#cc785c' },
    { provider: 'anthropic', id: 'claude-haiku-4',    display: 'Claude Haiku 4',     ctx: '200K', inp: 0.8, out: 4, speed: 10, quality: 8.2, status: 'available', latency: 620, tps: 144, color: '#cc785c' },
    { provider: 'openai',    id: 'gpt-4o',            display: 'GPT-4o',             ctx: '128K', inp: 5, out: 15, speed: 8, quality: 8.7, status: 'available', latency: 1320, tps: 78, color: '#10a37f' },
    { provider: 'openai',    id: 'gpt-4o-mini',       display: 'GPT-4o mini',        ctx: '128K', inp: 0.15, out: 0.6, speed: 10, quality: 7.4, status: 'available', latency: 480, tps: 162, color: '#10a37f' },
    { provider: 'ollama',    id: 'llama-3.1-70b',     display: 'Llama 3.1 70B',      ctx: '128K', inp: 0, out: 0, speed: 4, quality: 7.9, status: 'local', latency: 3200, tps: 22, color: '#7c5cff' },
    { provider: 'ollama',    id: 'qwen-2.5-coder',    display: 'Qwen 2.5 Coder 32B', ctx: '128K', inp: 0, out: 0, speed: 6, quality: 8.4, status: 'local', latency: 1840, tps: 38, color: '#7c5cff' },
    { provider: 'azure',     id: 'gpt-4-turbo',       display: 'GPT-4 Turbo (Azure)', ctx: '128K', inp: 10, out: 30, speed: 7, quality: 8.5, status: 'unavailable', latency: null, tps: null, color: '#0078d4' },
  ];
  const [sel, setSel] = useStateM(models[0].id);

  return (
    <div data-screen-label="06 Models" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Icon name="cpu" size={18} style={{ color: 'var(--accent)' }}/>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Models</h1>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Registry · routed through LLM Provider <span className="mono" style={{ color: 'var(--fg-1)' }}>:5010</span></span>
        <div style={{ flex: 1 }}/>
        <Badge variant="ok"><StatusDot status="success" pulse/> 3 providers online</Badge>
        <Button variant="outline" icon="refresh" size="md">Probe</Button>
        <Button variant="primary" icon="plus" size="md">Add model</Button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 360px' }}>
        {/* main list */}
        <div style={{ overflow: 'auto' }}>
          {/* hardware bar */}
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, borderBottom: '1px solid var(--line)', background: 'var(--bg-0)' }}>
            <HwCard label="GPU" value="RTX 4090" detail="24 GB VRAM · 76°C"/>
            <HwCard label="VRAM used" value="18.4 / 24 GB" detail="qwen-2.5-coder loaded" progress={76}/>
            <HwCard label="System RAM" value="32 / 64 GB" detail="50%" progress={50}/>
            <HwCard label="Tokens/sec" value="38" detail="local inference" trend={[24,28,30,34,36,38,38]}/>
          </div>

          {/* table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 1 }}>
              <tr>
                {['Model','Context','In / Out / 1M', 'Speed', 'Quality', 'Last 24h', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, color: 'var(--fg-2)', borderBottom: '1px solid var(--line)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map(m => <ModelRow key={m.id} m={m} selected={sel === m.id} onClick={() => setSel(m.id)}/>)}
            </tbody>
          </table>
        </div>

        {/* detail panel */}
        <div style={{ borderLeft: '1px solid var(--line)', background: 'var(--bg-1)', overflow: 'auto' }}>
          <ModelDetail model={models.find(m => m.id === sel)}/>
        </div>
      </div>
    </div>
  );
};

const HwCard = ({ label, value, detail, progress, trend }) => (
  <div style={{ padding: 12, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)' }}>
    <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>{label}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{value}</span>
      {trend && <Sparkline values={trend} width={60} height={18} color="var(--accent)"/>}
    </div>
    <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>{detail}</div>
    {progress != null && <div style={{ marginTop: 6 }}><Progress value={progress}/></div>}
  </div>
);

const ModelRow = ({ m, selected, onClick }) => {
  const statusVariant = m.status === 'active' ? 'ok' : m.status === 'unavailable' ? 'err' : 'outline';
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: selected ? 'var(--bg-2)' : 'transparent',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 5, background: m.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {m.provider[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{m.display}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-2)' }}>{m.provider} · {m.id}</div>
          </div>
        </div>
      </td>
      <td className="mono" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', color: 'var(--fg-1)' }}>{m.ctx}</td>
      <td className="mono" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', color: 'var(--fg-1)' }}>
        {m.inp === 0 ? <span style={{ color: 'var(--ok)' }}>free</span> : `$${m.inp.toFixed(2)} / $${m.out.toFixed(2)}`}
      </td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}><DotMeter value={m.speed} color="var(--accent)"/></td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono" style={{ fontWeight: 600 }}>{m.quality.toFixed(1)}</span>
          <DotMeter value={Math.round(m.quality)} color="var(--ok)"/>
        </div>
      </td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
        {m.tps != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkline values={[m.tps*0.7, m.tps*0.8, m.tps*0.9, m.tps, m.tps*1.05, m.tps*0.95, m.tps]} width={60} height={18} color="var(--accent)"/>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{m.tps}t/s</span>
          </div>
        ) : <span style={{ color: 'var(--fg-3)' }}>—</span>}
      </td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
        <Badge variant={statusVariant}>
          {m.status === 'active' && <StatusDot status="success" pulse/>}
          {m.status === 'local' && <Icon name="cpu" size={10}/>}
          {m.status}
        </Badge>
      </td>
    </tr>
  );
};

const DotMeter = ({ value, max = 10, color }) => (
  <div style={{ display: 'inline-flex', gap: 2 }}>
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} style={{
        width: 4, height: 10, borderRadius: 1,
        background: i < value ? color : 'var(--bg-3)',
      }}/>
    ))}
  </div>
);

const ModelDetail = ({ model }) => {
  if (!model) return null;
  return (
    <div>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: model.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {model.provider[0].toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{model.display}</h2>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{model.provider} · {model.id}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          <Button variant="primary" icon="bolt" size="sm">Test</Button>
          <Button variant="outline" icon="settings" size="sm">Configure</Button>
          <Button variant="ghost" size="sm">Set as default</Button>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <SectionLabelM>Capabilities</SectionLabelM>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['code-generation','reasoning','vision','tool-use','streaming','json-mode'].map(c => (
              <Badge key={c} variant="outline">{c}</Badge>
            ))}
          </div>
        </div>

        <div>
          <SectionLabelM>Quality by task</SectionLabelM>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <QualBar label="code-generation"   value={9.2}/>
            <QualBar label="reasoning"         value={9.0}/>
            <QualBar label="summarization"     value={8.5}/>
            <QualBar label="creative-writing"  value={7.8}/>
          </div>
        </div>

        <div>
          <SectionLabelM>Cost (24h)</SectionLabelM>
          <div style={{ padding: 12, background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>$6.21</span>
              <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>1.41M in · 218k out</span>
            </div>
            <div style={{ marginTop: 8 }}><Sparkline values={[0.2,0.3,0.4,0.6,0.5,0.7,0.8,0.9,0.8,1.0,1.1,1.2]} width={300} height={32} color="var(--accent)"/></div>
          </div>
        </div>

        <div>
          <SectionLabelM>Used by</SectionLabelM>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <UsedBy name="agent.coder"   share={62}/>
            <UsedBy name="agent.planner" share={28}/>
            <UsedBy name="agent.reviewer" share={10}/>
          </div>
        </div>

        <div>
          <SectionLabelM>Strengths</SectionLabelM>
          <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.6 }}>
            Excellent code generation, strong tool use, careful with destructive operations. <span style={{ color: 'var(--fg-2)' }}>Tends to over-explain on simple tasks.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionLabelM = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 8 }}>{children}</div>
);
const QualBar = ({ label, value }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 30px', alignItems: 'center', gap: 8, fontSize: 12 }}>
    <span className="mono" style={{ color: 'var(--fg-2)' }}>{label}</span>
    <Progress value={value * 10}/>
    <span className="mono" style={{ fontWeight: 600, textAlign: 'right' }}>{value.toFixed(1)}</span>
  </div>
);
const UsedBy = ({ name, share }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 40px', alignItems: 'center', gap: 8, fontSize: 12 }}>
    <span className="mono">{name}</span>
    <Progress value={share}/>
    <span className="mono" style={{ textAlign: 'right', color: 'var(--fg-2)' }}>{share}%</span>
  </div>
);

Object.assign(window, { ModelsScreen });
