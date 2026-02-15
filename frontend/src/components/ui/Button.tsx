/**
 * Design System Button component.
 * Variants: primary, secondary, danger, ghost.
 * Sizes: sm, md, lg.
 */

import { ReactNode, ButtonHTMLAttributes } from 'react';
import './ui.scss';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
