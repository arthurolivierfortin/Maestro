/**
 * Loading Spinner Component
 */

import './LoadingSpinner.scss';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
}

export function LoadingSpinner({ size = 'md', fullScreen = false, message }: LoadingSpinnerProps) {
  const spinner = (
    <div className="loading-spinner">
      <div className={`loading-spinner__circle loading-spinner__circle--${size}`} />
      {message && <p className="loading-spinner__message">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="loading-spinner--fullscreen">{spinner}</div>;
  }

  return spinner;
}

export default LoadingSpinner;
