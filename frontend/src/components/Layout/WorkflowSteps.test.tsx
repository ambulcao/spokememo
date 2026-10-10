import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowSteps from './WorkflowSteps';

describe('WorkflowSteps', () => {
  it('renders all four workflow step labels', () => {
    render(<WorkflowSteps currentStep="upload" />);
    expect(screen.getByText('Enviar áudio')).toBeInTheDocument();
    expect(screen.getByText('Processamento com IA')).toBeInTheDocument();
    expect(screen.getByText('Revisar transcrição')).toBeInTheDocument();
    expect(screen.getByText('Ver resumo')).toBeInTheDocument();
  });

  it('marks the current step as active', () => {
    render(<WorkflowSteps currentStep="transcript" />);
    const activeLabel = screen.getByText('Revisar transcrição');
    // The label lives inside the `.step` element that carries the `active` class.
    expect(activeLabel.closest('.step')).toHaveClass('active');
  });
});
