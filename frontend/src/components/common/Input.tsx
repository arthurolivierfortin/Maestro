/**
 * Input Component
 */

import { InputHTMLAttributes, forwardRef } from 'react';
import './Input.scss';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, fullWidth = false, className = '', ...props }, ref) => {
    const inputClasses = ['input__field', error && 'input__field--error', className]
      .filter(Boolean)
      .join(' ');

    const containerClasses = ['input', fullWidth && 'input--full-width'].filter(Boolean).join(' ');

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={props.id} className="input__label">
            {label}
            {props.required && <span className="input__required">*</span>}
          </label>
        )}
        <input ref={ref} className={inputClasses} {...props} />
        {error && <span className="input__error">{error}</span>}
        {helper && !error && <span className="input__helper">{helper}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
