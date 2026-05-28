/* global React */
/* Maestro Code — Shell, mascot, icons, primitives shared across pages */

/* ─── Wireframe head mascot SVG (from user's original mock) ─── */
const MaestroHead = ({ size = 120, opacity = 0.5 }) => {
  // Procedural wireframe profile head
  const stroke = 'currentColor';
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 120 150"
         style={{ opacity, color: 'var(--ink-3)', display: 'block' }}>
      <defs>
        <clipPath id="headClip">
          <path d="M40 26 Q60 14 80 24 Q98 40 96 70 Q96 96 88 116 L84 134 L42 134 L40 116 Q26 96 28 70 Q30 42 40 26 Z"/>
        </clipPath>
      </defs>
      <g clipPath="url(#headClip)" fill="none" stroke={stroke} strokeWidth="0.5" opacity="0.9">
        {/* longitudes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <path key={'lon'+i} d={`M${30 + i * 10} 0 Q${40 + i * 7} 75 ${30 + i * 10} 150`} />
        ))}
        {/* latitudes */}
        {Array.from({ length: 11 }).map((_, i) => (
          <ellipse key={'lat'+i} cx="60" cy={20 + i * 12} rx={28 - Math.abs(i - 5) * 2} ry="4"/>
        ))}
      </g>
      {/* silhouette */}
      <path d="M40 26 Q60 14 80 24 Q98 40 96 70 Q96 96 88 116 L84 134 L42 134 L40 116 Q26 96 28 70 Q30 42 40 26 Z"
            fill="none" stroke={stroke} strokeWidth="0.6"/>
      {/* halftone dots for stylization */}
      <g fill={stroke} opacity="0.4">
        {Array.from({ length: 60 }).map((_, i) => {
          const x = 32 + (i * 7.3) % 60;
          const y = 22 + (i * 11.7) % 110;
          return <circle key={i} cx={x} cy={y} r={0.6 + (i % 3) * 0.2}/>;
        })}
      </g>
    </svg>
  );
};

/* Smaller decorative version */
const MaestroBust = ({ size = 80, opacity = 0.85 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80"
       style={{ opacity, color: 'var(--accent)', display: 'block' }}>
    <g fill="none" stroke="currentColor" strokeWidth="0.5">
      {/* halftone bust silhouette */}
      {Array.from({ length: 240 }).map((_, i) => {
        const angle = (i * 47) % 360;
        const r = 28 + ((i * 13) % 6);
        const x = 40 + Math.cos(angle * Math.PI / 180) * r * 0.6;
        const y = 38 + Math.sin(angle * Math.PI / 180) * r * 0.7;
        if (y > 60) return null;
        const inSilhouette = (x - 40) ** 2 / 320 + (y - 36) ** 2 / 600 < 1.0;
        if (!inSilhouette) return null;
        return <circle key={i} cx={x} cy={y} r={0.7} fill="currentColor" opacity={0.6 + (i % 3) * 0.13}/>;
      })}
    </g>
  </svg>
);

/* ─── Tiny inline icons ─── */
const Ic = ({ n, size = 14, style }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
              stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
              style };
  const paths = {
    home: <><path d="M3 12 12 4l9 8"/><path d="M5 10v10h14V10"/></>,
    chat: <><path d="M21 12a8 8 0 0 1-8 8H8l-5 3v-7a8 8 0 0 1 5-7.4A8 8 0 0 1 21 12z"/></>,
    blocks: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    contract: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/></>,
    catalog: <><path d="m12 3 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></>,
    foundry: <><path d="M5 3v6l-2 4v8h18v-8l-2-4V3"/><path d="M3 13h18M9 17h6"/></>,
    cpu: <><rect x="6" y="6" width="12" height="12"/><path d="M9 9h6v6H9z"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    graph: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7.5 7.5 11 16.5M16.5 7.5 13 16.5M8 6h8"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/></>,
    plug: <><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    pin: <><path d="M12 17v5M9 4h6l1 6 3 3v2H5v-2l3-3z"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    play: <><path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/></>,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    stop: <><rect x="5" y="5" width="14" height="14"/></>,
    bolt: <><path d="m13 2-9 12h7l-1 8 9-12h-7z"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 19h16"/></>,
    upload: <><path d="M12 21V9m-5 5 5-5 5 5M4 5h16"/></>,
    git: <><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7M8.5 6.2A6 6 0 0 1 15.5 12"/></>,
    chevron: <><path d="m9 6 6 6-6 6"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    check: <><path d="m5 12 5 5 9-11"/></>,
    x: <><path d="M6 6l12 12M18 6L6 18"/></>,
    arrowRight: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    terminal: <><path d="M4 17l5-5-5-5M12 19h8"/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    code: <><path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/></>,
    eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
    pulse: <><path d="M2 12h4l3-8 5 16 3-8h5"/></>,
    db: <><ellipse cx="12" cy="5" rx="8" ry="2.5"/><path d="M4 5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5M4 11v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5"/></>,
  };
  return <svg {...p}>{paths[n] || null}</svg>;
};

/* ─── App header ─── */
const AppHeader = ({ tier = 'Tier 1', model = 'claude-sonnet-4.5', online = true }) => (
  <div className="app-header">
    <div className="brand">
      <span className="wordmark">MAESTRO</span>
      <span className="bar"/>
    </div>
    <div className="header-mid">
      <span>AI Engineering Console</span>
    </div>
    <div className="header-right">
      <span><span className="pip"/>System {online ? 'online' : 'offline'}</span>
      <span className="pill"><span className="label">tier</span><span className="v c-accent b">{tier}</span></span>
      <span className="pill"><span className="label">model</span><span className="v">{model}</span></span>
      <span className="pill"><span className="label">ctx</span><span className="v">200K</span></span>
    </div>
  </div>
);

/* ─── Nav rail ─── */
const NAV = [
  { id: 'console',    icon: 'chat',     label: 'Console',    group: 'WORK',   kbd: '1', badge: '●' },
  { id: 'spaces',     icon: 'folder',   label: 'Spaces',     group: null,     kbd: '2', badge: '4·3' },
  { id: 'foundry',    icon: 'foundry',  label: 'Foundry',    group: 'BUILD',  kbd: '3', badge: '142·◆' },
  { id: 'models',     icon: 'cpu',      label: 'Models',     group: 'SYSTEM', kbd: '5' },
  { id: 'providers',  icon: 'plug',     label: 'Providers',  group: null,     kbd: '6' },
  { id: 'monitor',    icon: 'pulse',    label: 'Monitor',    group: null,     kbd: '7' },
  { id: 'first-run',  icon: 'sparkle',  label: 'First run',  group: 'CONFIG', kbd: '9' },
  { id: 'catalog',    icon: 'blocks',   label: 'Blocks (legacy)', group: null, kbd: '4', hidden: true },
  { id: 'workflow',   icon: 'graph',    label: 'Session monitor', group: null, kbd: '0', hidden: true },
  { id: 'block',      icon: 'contract', label: 'Contract',   group: null,     kbd: '0', hidden: true },
];

const NavRail = ({ route, onRoute }) => {
  let lastGroup = null;
  const visible = NAV.filter(n => !n.hidden);
  return (
    <div className="rail">
      {visible.map(n => {
        const showGroup = n.group && n.group !== lastGroup;
        if (n.group) lastGroup = n.group;
        return (
          <React.Fragment key={n.id}>
            {showGroup && <div className="rail-group-title">{n.group}</div>}
            <button className={'rail-item' + (route === n.id ? ' active' : '')}
                    onClick={() => onRoute(n.id)}>
              <span className="ic"><Ic n={n.icon} size={14}/></span>
              <span>{n.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {n.badge && <span className="badge"
                  style={{
                    border: 'none', padding: '0 4px', minWidth: 14, textAlign: 'center',
                    background: route === n.id ? 'var(--accent-soft)' : 'var(--bg-3)',
                    color: route === n.id ? 'var(--accent)' : 'var(--ink-3)',
                  }}>{n.badge}</span>}
                <span className="kbd">{n.kbd}</span>
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ─── Footer ─── */
const AppFooter = ({ route, extras = [] }) => (
  <div className="app-footer">
    <div className="left">
      <span>MAESTRO v0.4.1</span>
      <span className="sep">·</span>
      <span>{route}</span>
      {extras.map((e, i) => <React.Fragment key={i}><span className="sep">·</span><span>{e}</span></React.Fragment>)}
    </div>
    <div className="right">
      <span>SECURE</span><span className="sep">·</span>
      <span>ENCRYPTED</span><span className="sep">·</span>
      <span>SYNCED</span><span className="sep">·</span>
      <span><span className="kbd">⌘K</span> command palette</span>
      <span className="sep">·</span>
      <span><span className="kbd">?</span> help</span>
    </div>
  </div>
);

/* ─── Panel primitive ─── */
const Panel = ({ title, meta, focused, flush, onBg1, children, style, className }) => (
  <div className={'panel' + (focused ? ' focused' : '') + (flush ? ' flush' : '') + (onBg1 ? ' on-bg-1' : '') + (className ? ' ' + className : '')}
       style={style}>
    {title && <span className="panel-title">{title}</span>}
    {meta && <span className="panel-meta">{meta}</span>}
    {children}
  </div>
);

/* ─── Status dot ─── */
const StatusDot = ({ status = 'idle', pulse }) => (
  <span className={'dot ' + status + (pulse ? ' pulse' : '')}/>
);

/* ─── Badge ─── */
const Badge = ({ variant = 'muted', children, mono, style }) => (
  <span className={'badge ' + variant + (mono ? ' mono' : '')} style={style}>{children}</span>
);

/* ─── Button ─── */
const Btn = ({ variant = '', size, icon, iconRight, children, onClick, style }) => (
  <button className={'btn ' + variant + (size === 'sm' ? ' sm' : '')} onClick={onClick} style={style}>
    {icon && <Ic n={icon} size={size === 'sm' ? 12 : 13}/>}
    {children}
    {iconRight && <Ic n={iconRight} size={size === 'sm' ? 12 : 13}/>}
  </button>
);

/* ─── Bar / progress ─── */
const Bar = ({ value = 0, variant = '' }) => (
  <div className="bar-track">
    <div className={'bar-fill ' + variant} style={{ width: `${Math.min(100, value)}%` }}/>
  </div>
);

/* ─── Inline conversation primitives ─── */
const Line = ({ ts, kind = 'agent', marker, children, indent = 0, streaming, dim }) => (
  <div className={'line ' + kind} style={{ paddingLeft: indent * 18, opacity: dim ? 0.7 : 1 }}>
    {ts != null && <span className="ts">{ts}</span>}
    {kind === 'user' && <span className="body"><span className="prompt">❯</span> {children}</span>}
    {kind !== 'user' && (
      <span className="body">
        {marker && <span className="marker">{marker}</span>}
        {kind === 'tool' && <span className="arrow">↳</span>}
        {children}
        {streaming && <span className="caret"/>}
      </span>
    )}
  </div>
);

Object.assign(window, {
  MaestroHead, MaestroBust, Ic, AppHeader, NavRail, AppFooter, NAV,
  Panel, StatusDot, Badge, Btn, Bar, Line,
});
