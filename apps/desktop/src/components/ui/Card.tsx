import { ReactNode } from 'react';
import './ui.scss';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onClick,
  hoverable = false,
}: CardProps) {
  return (
    <div
      className={`ui-card ui-card--${variant} ui-card--pad-${padding} ${hoverable ? 'ui-card--hoverable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="ui-card__header">
      <div>
        <h3 className="ui-card__title">{title}</h3>
        {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="ui-card__action">{action}</div>}
    </div>
  );
}
