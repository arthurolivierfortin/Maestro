/* global React */
const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

/* ============ Icons (line, 16px, stroke=1.5) ============ */
const Icon = ({ name, size = 16, className = '', style }) => {
  const s = size;
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', className, style };
  const paths = {
    home: <><path d="M3 12 12 4l9 8"/><path d="M5 10v10h14V10"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    graph: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7.5 7.5 11 16.5M16.5 7.5 13 16.5M8 6h8"/></>,
    foundry: <><path d="M5 3v6l-2 4v8h18v-8l-2-4V3"/><path d="M3 13h18"/><path d="M9 17h6"/></>,
    blocks: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 9h6v6H9z"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8h0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    play: <><path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/></>,
    pause: <><rect x="6" y="4" width="4" height="16" rx="0.5"/><rect x="14" y="4" width="4" height="16" rx="0.5"/></>,
    stop: <><rect x="5" y="5" width="14" height="14" rx="1"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 16-5.5L21 8M21 3v5h-5M21 12a9 9 0 0 1-16 5.5L3 16M3 21v-5h5"/></>,
    chevron: <><path d="m9 6 6 6-6 6"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    terminal: <><path d="M4 17l5-5-5-5M12 19h8"/></>,
    chat: <><path d="M21 12a8 8 0 0 1-8 8H8l-5 3v-7a8 8 0 0 1 5-7.4A8 8 0 0 1 21 12z"/></>,
    git: <><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7M8.5 6.2A6 6 0 0 1 15.5 12"/></>,
    branch: <><path d="M6 3v18"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M18 8v2a4 4 0 0 1-4 4H6"/></>,
    bolt: <><path d="m13 2-9 12h7l-1 8 9-12h-7z" fill="currentColor" fillOpacity=".15"/></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></>,
    check: <><path d="m5 12 5 5 9-11"/></>,
    x: <><path d="M6 6l12 12M18 6L6 18"/></>,
    eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
    arrowRight: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    pulse: <><path d="M2 12h4l3-8 5 16 3-8h5"/></>,
    db: <><ellipse cx="12" cy="5" rx="8" ry="2.5"/><path d="M4 5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5M4 11v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6"/></>,
    code: <><path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/></>,
    flag: <><path d="M4 22V4M4 4h12l-2 4 2 4H4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5"/></>,
    diff: <><path d="M9 3v6m-3-3h6M6 18h6"/><path d="M14 15h6m0 0V9m0 6-7-7"/></>,
    package: <><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></>,
  };
  return <svg {...props}>{paths[name] || null}</svg>;
};

/* ============ Status dot ============ */
const StatusDot = ({ status = 'idle', size = 8, pulse = false }) => {
  const colors = {
    running: 'var(--accent)', success: 'var(--ok)', error: 'var(--err)',
    warning: 'var(--warn)', pending: 'var(--fg-3)', idle: 'var(--fg-3)',
    agent: 'var(--agent)',
  };
  const color = colors[status] || 'var(--fg-3)';
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: pulse ? `0 0 0 0 ${color}` : 'none',
      animation: pulse ? 'pulse-dot 1.4s ease-out infinite' : undefined,
    }}/>
  );
};

/* ============ Badge / Pill ============ */
const Badge = ({ children, variant = 'muted', mono = false, style }) => {
  const variants = {
    muted:   { bg: 'var(--bg-2)',   fg: 'var(--fg-1)', bd: 'var(--line)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent)', bd: 'var(--accent-line)' },
    agent:   { bg: 'var(--agent-soft)',  fg: 'var(--agent)',  bd: 'oklch(0.72 0.16 295 / 0.4)' },
    ok:      { bg: 'var(--ok-soft)',     fg: 'var(--ok)',     bd: 'oklch(0.78 0.16 150 / 0.4)' },
    warn:    { bg: 'var(--warn-soft)',   fg: 'var(--warn)',   bd: 'oklch(0.82 0.14 80 / 0.4)' },
    err:     { bg: 'var(--err-soft)',    fg: 'var(--err)',    bd: 'oklch(0.72 0.18 25 / 0.4)' },
    outline: { bg: 'transparent',        fg: 'var(--fg-1)',   bd: 'var(--line)' },
  };
  const v = variants[variant] || variants.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 500, letterSpacing: 0.01,
      fontFamily: mono ? 'var(--font-mono)' : undefined,
      color: v.fg, background: v.bg, border: `1px solid ${v.bd}`,
      whiteSpace: 'nowrap',
      ...style,
    }}>{children}</span>
  );
};

/* ============ Button ============ */
const Button = ({ children, variant = 'ghost', size = 'md', icon, iconRight, onClick, active, style, title }) => {
  const variants = {
    primary: { bg: 'var(--accent)', fg: 'oklch(0.16 0.008 240)', bd: 'var(--accent)', hover: 'oklch(0.84 0.14 220)' },
    outline: { bg: 'var(--bg-1)', fg: 'var(--fg-0)', bd: 'var(--line)', hover: 'var(--bg-2)' },
    ghost:   { bg: 'transparent', fg: 'var(--fg-1)', bd: 'transparent', hover: 'var(--bg-2)' },
    soft:    { bg: 'var(--bg-2)', fg: 'var(--fg-0)', bd: 'var(--line)', hover: 'var(--bg-3)' },
  };
  const sizes = {
    sm: { px: 8, py: 4, fs: 12, h: 24 },
    md: { px: 12, py: 6, fs: 13, h: 30 },
    lg: { px: 16, py: 8, fs: 14, h: 36 },
  };
  const v = variants[variant];
  const s = sizes[size];
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: `${s.py}px ${s.px}px`, height: s.h, fontSize: s.fs,
        fontWeight: 500,
        color: v.fg, background: active ? v.hover : (hover ? v.hover : v.bg),
        border: `1px solid ${v.bd}`,
        borderRadius: 'var(--radius)',
        transition: 'background 80ms ease, transform 60ms ease',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={s.fs + 2}/>}
      {children}
      {iconRight && <Icon name={iconRight} size={s.fs + 2}/>}
    </button>
  );
};

/* ============ Card / Panel ============ */
const Panel = ({ children, title, subtitle, icon, actions, padding = 14, style, bodyStyle, flush }) => (
  <div style={{
    background: 'var(--bg-1)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-1)',
    ...style,
  }}>
    {title && (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--line)',
        background: 'linear-gradient(180deg, var(--bg-2), var(--bg-1))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <Icon name={icon} size={14} style={{ color: 'var(--fg-2)' }}/>}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', letterSpacing: 0.01 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>{subtitle}</div>}
          </div>
        </div>
        {actions && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{actions}</div>}
      </div>
    )}
    <div style={{ padding: flush ? 0 : padding, flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
  </div>
);

/* ============ Section header ============ */
const SectionHeader = ({ title, subtitle, right, level = 'lg' }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
    <div>
      <h2 style={{
        margin: 0,
        fontSize: level === 'lg' ? 18 : 14,
        fontWeight: 600,
        letterSpacing: '-0.01em',
      }}>{title}</h2>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

/* ============ Sparkline ============ */
const Sparkline = ({ values, width = 80, height = 24, color = 'var(--accent)' }) => {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1 || 1);
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  const area = `M0,${height} L${points.split(' ').join(' L')} L${width},${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path d={area} fill={color} fillOpacity={0.12}/>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

/* ============ Progress bar ============ */
const Progress = ({ value = 0, max = 100, color = 'var(--accent)', height = 4 }) => (
  <div style={{ height, background: 'var(--bg-2)', borderRadius: 999, overflow: 'hidden' }}>
    <div style={{
      width: `${Math.min(100, (value / max) * 100)}%`, height: '100%',
      background: color, borderRadius: 999, transition: 'width 240ms ease',
    }}/>
  </div>
);

/* ============ Tabs ============ */
const Tabs = ({ tabs, value, onChange }) => (
  <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line)' }}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{
        padding: '8px 12px', fontSize: 12, fontWeight: 500,
        color: value === t.id ? 'var(--fg-0)' : 'var(--fg-2)',
        borderBottom: '2px solid',
        borderColor: value === t.id ? 'var(--accent)' : 'transparent',
        marginBottom: -1,
        transition: 'color 80ms',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {t.icon && <Icon name={t.icon} size={13}/>}
        {t.label}
        {t.count != null && <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 999,
          background: value === t.id ? 'var(--accent-soft)' : 'var(--bg-2)',
          color: value === t.id ? 'var(--accent)' : 'var(--fg-2)',
        }}>{t.count}</span>}
      </button>
    ))}
  </div>
);

/* ============ Input ============ */
const Input = ({ icon, placeholder, value, onChange, style, mono = false, kbd, size = 'md' }) => {
  const h = size === 'sm' ? 26 : size === 'lg' ? 36 : 30;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: h, padding: '0 8px',
      background: 'var(--bg-0)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius)',
      ...style,
    }}>
      {icon && <Icon name={icon} size={14} style={{ color: 'var(--fg-2)' }}/>}
      <input
        value={value || ''} onChange={e => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'transparent', border: 0, outline: 'none', color: 'var(--fg-0)',
          flex: 1, fontSize: 13, fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          minWidth: 0,
        }}
      />
      {kbd && <span className="kbd">{kbd}</span>}
    </div>
  );
};

/* ============ Brand mark ============ */
const BrandMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
    <defs>
      <linearGradient id="bmGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="var(--accent)"/>
        <stop offset="1" stopColor="var(--agent)"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--bg-2)" stroke="url(#bmGrad)" strokeWidth="1.5"/>
    {/* concentric arcs — "conductor" */}
    <path d="M9 22 Q16 8 23 22" stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M12 22 Q16 13 20 22" stroke="var(--agent)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".7"/>
    <circle cx="16" cy="22" r="1.6" fill="var(--accent)"/>
  </svg>
);

Object.assign(window, {
  Icon, StatusDot, Badge, Button, Panel, SectionHeader, Sparkline, Progress, Tabs, Input, BrandMark,
});
