import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SummaryContent from './SummaryContent';

describe('SummaryContent', () => {
  it('shows a placeholder when there is no summary', () => {
    render(<SummaryContent summary={null} />);
    expect(screen.getByText('O resumo gerado por IA aparece aqui')).toBeInTheDocument();
  });

  it('renders the summary text, key points, and action items', () => {
    render(
      <SummaryContent
        summary={{
          summary: 'The team discussed the roadmap.',
          key_points: ['Ship v2', 'Hire designer'],
          action_items: ['Email stakeholders'],
        }}
      />
    );

    expect(screen.getByText('The team discussed the roadmap.')).toBeInTheDocument();
    expect(screen.getByText('Pontos principais')).toBeInTheDocument();
    expect(screen.getByText('Ship v2')).toBeInTheDocument();
    expect(screen.getByText('Ações')).toBeInTheDocument();
    expect(screen.getByText('Email stakeholders')).toBeInTheDocument();
  });

  it('omits empty sections', () => {
    render(<SummaryContent summary={{ summary: 'Just a summary.' }} />);
    expect(screen.queryByText('Pontos principais')).not.toBeInTheDocument();
    expect(screen.queryByText('Ações')).not.toBeInTheDocument();
  });
});
