import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { LineChart } from './LineChart';

describe('LineChart', () => {
  it('shows an empty message with no data', () => {
    render(<LineChart data={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('draws an area and a line path when given data', () => {
    const { container } = render(<LineChart data={[1, 5, 3, 8]} />);
    expect(container.querySelectorAll('path').length).toBe(2);
  });

  it('renders as an accessible image with its label', () => {
    render(<LineChart data={[1, 2, 3]} ariaLabel="Tokens over 7 days" />);
    expect(screen.getByRole('img', { name: 'Tokens over 7 days' })).toBeInTheDocument();
  });
});
