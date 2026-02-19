/**
 * Wizard Step Wrapper Component
 *
 * Container for individual wizard steps with consistent layout.
 */

import React from 'react';

export interface WizardStepProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function WizardStep({ title, description, children }: WizardStepProps) {
  return (
    <div className="wizard-step">
      <div className="wizard-step__header">
        <h3 className="wizard-step__title">{title}</h3>
        {description && <p className="wizard-step__description">{description}</p>}
      </div>
      <div className="wizard-step__content">{children}</div>
    </div>
  );
}
