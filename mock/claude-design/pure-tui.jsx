/* global React */
/* MAESTRO CODE · pure TUI primitives */

/* ─── Box panel (with title cut into border) ─── */
const Box = ({ title, meta, focused, children, style }) => (
  <div className={'box' + (focused ? ' focused' : '')} style={style}>
    {title && <div className="box-title">{title}</div>}
    {meta && <div className="box-meta">{meta}</div>}
    <div className="box-body">{children}</div>
  </div>
);

/* ─── ASCII progress bar — `█████░░░░░ 50%` ─── */
const Bar = ({ value = 0, max = 100, width = 12, variant = '', showPct }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const full = Math.round((pct / 100) * width);
  const empty = width - full;
  return (
    <span className="bar-ascii">
      <span className={'full ' + variant}>{'█'.repeat(full)}</span>
      <span className="empty">{'░'.repeat(empty)}</span>
      {showPct && <span className="c3" style={{ marginLeft: 6 }}>{pct}%</span>}
    </span>
  );
};

/* ─── Sparkline using Unicode blocks ─── */
const SPARK = '▁▂▃▄▅▆▇█';
const Spark = ({ values, color = 'var(--ac)' }) => {
  const mn = Math.min(...values), mx = Math.max(...values);
  const range = mx - mn || 1;
  return (
    <span style={{ color, letterSpacing: '-1px', fontFamily: 'inherit' }}>
      {values.map(v => SPARK[Math.floor(((v - mn) / range) * 7)]).join('')}
    </span>
  );
};

/* ─── Status marker `○ ● ✓ ✗` ─── */
const Mk = ({ s }) => {
  const m = { done: '✓', active: '●', pending: '○', failed: '✗', warn: '◐' };
  const k = { done: 'ok', active: 'act', pending: 'pend', failed: 'err', warn: 'warn' };
  return <span className={'marker ' + (k[s] || 'pend')}>{m[s] || '·'}</span>;
};

/* ─── Pipped status dot (animated) ─── */
const Pip = ({ s = 'ok', pulse }) => {
  const c = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', idle: 'var(--fg-3)', act: 'var(--ac)' };
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      background: c[s] || c.idle,
      boxShadow: pulse ? `0 0 6px ${c[s]}` : 'none',
      animation: pulse ? 'blink 1.6s ease-in-out infinite' : 'none',
    }}/>
  );
};

/* ─── Badge ─── */
const B = ({ kind, children, style }) => (
  <span className={'b ' + (kind || '')} style={style}>{children}</span>
);

/* ─── Conversation line ─── */
const L = ({ ts, k = 'agent', mark, children, indent = 0, streaming, dim }) => (
  <div className={'line ' + k}>
    {ts !== undefined && <span className="ts">{ts || ''}</span>}
    <span className={'body' + (dim ? ' dim' : '')} style={{ paddingLeft: indent * 18 }}>
      {k === 'user' && <span className="pre">❯</span>}
      {k === 'tool' && <span className="pre">↳</span>}
      {mark && <span className="mk">{mark}</span>}
      {children}
      {streaming && <span className="caret"/>}
    </span>
  </div>
);

/* ─── Title bar ─── */
const TitleBar = ({ tier = 'Tier 1', model = 'claude-sonnet-4.5', session, online = true }) => (
  <div className="term-title">
    <span className="wm">▌MAESTRO</span>
    <span className="sep">─</span>
    <span className="c1">code · v0.4.1</span>
    <span className="mid">
      cantante <span className="sep">·</span> {session ? <span className="ca">{session}</span> : <span className="c3">no session</span>}
      <span className="sep">·</span> <span className="cagent">agent.maestro</span> at the wheel
    </span>
    <div className="right">
      <span><span className={'pip ' + (online ? 'pulse' : '')}/> {online ? 'online' : 'offline'}</span>
      <span className="sep">│</span>
      <span><span className="c3">tier </span><span className="ca bd">{tier}</span></span>
      <span className="sep">│</span>
      <span><span className="c3">model </span><span className="c0">{model}</span></span>
    </div>
  </div>
);

/* ─── Tabs ─── */
const TabBar = ({ route, onRoute, items }) => (
  <div className="tabs">
    {items.map(t => (
      <span key={t.id}
            className={'tab' + (route === t.id ? ' active' : '')}
            onClick={() => onRoute(t.id)}>
        <span className="n">{t.k}</span>
        {t.label}
        {t.badge && <span className="c3"> ({t.badge})</span>}
      </span>
    ))}
  </div>
);

/* ─── Status line / command line ─── */
const StatusLine = ({ mode = 'NORMAL', items = [] }) => (
  <div className="status">
    <span className={'mode' + (mode === 'CMD' ? ' cmd' : '')}>{mode}</span>
    {items.map((it, i) => (
      <React.Fragment key={i}>
        <span className="sep">│</span>
        <span>{it}</span>
      </React.Fragment>
    ))}
  </div>
);

const CmdLine = ({ value = '', placeholder = 'type a command…' }) => (
  <div className="cmdline">
    <span className="prompt">:</span>
    {value ? <span>{value}<span className="caret"/></span> : <span className="c3">{placeholder}</span>}
  </div>
);

Object.assign(window, {
  Box, Bar, Spark, Mk, Pip, B, L,
  TitleBar, TabBar, StatusLine, CmdLine,
  SPARK,
});
