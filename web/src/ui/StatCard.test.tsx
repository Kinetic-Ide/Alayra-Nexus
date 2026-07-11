import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('shows its label and value', () => {
    render(<StatCard label="Active keys" value="3" />);
    expect(screen.getByText('Active keys')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('deep-links when given an href', () => {
    render(<StatCard label="Usage" value="0" href="/analytics" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/analytics');
  });

  it('invokes onClick when clickable', () => {
    const onClick = vi.fn();
    render(<StatCard label="Cost" value="$0" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
