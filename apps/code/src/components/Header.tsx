import type { PageId } from '../App';

interface TabDef {
  key: number;
  label: string;
  pageId: PageId;
}

const tabs: TabDef[] = [
  { key: 1, label: 'Console', pageId: 'console' },
  { key: 2, label: 'Spaces', pageId: 'spaces' },
  { key: 3, label: 'Catalog', pageId: 'catalog' },
  { key: 4, label: 'Models', pageId: 'models' },
  { key: 5, label: 'Monitor', pageId: 'monitor' },
];

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  return (
    <>
      <div className="term-title">
        <span className="wm">▌MAESTRO</span>
        <span className="sep">─</span>
        <span className="c1">code · v0.1.0</span>
        <span className="mid">maestro · agent.maestro at the wheel</span>
        <div className="right">
          <span><span className="pip pulse" /> online</span>
        </div>
      </div>
      <div className="tabs">
        {tabs.map((tab) => (
          <span
            key={tab.key}
            className={'tab' + (tab.pageId === currentPage ? ' active' : '')}
            onClick={() => onNavigate(tab.pageId)}
          >
            <span className="n">{tab.key}</span>
            {tab.label}
          </span>
        ))}
      </div>
    </>
  );
}
