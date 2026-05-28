interface CostCardProps {
  label: string;
  value: string;
  subLabel?: string;
}

export function CostCard({ label, value, subLabel }: CostCardProps) {
  return (
    <div className="box" style={{ minWidth: 120, flex: 1 }}>
      <div className="box-title">{label}</div>
      <div className="box-body">
        <div className="c0 bd" style={{ fontSize: 22 }}>{value}</div>
        {subLabel && <div className="c2" style={{ fontSize: 11, marginTop: 4 }}>{subLabel}</div>}
      </div>
    </div>
  );
}
