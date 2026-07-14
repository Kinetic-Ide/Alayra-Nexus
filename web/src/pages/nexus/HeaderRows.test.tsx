import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { HeaderRows } from './HeaderRows';

describe('HeaderRows', () => {
  it('prefills existing headers and reports edits as an object', () => {
    const onChange = vi.fn();
    render(<HeaderRows value={{ 'anthropic-version': '2023-06-01' }} onChange={onChange} />);
    expect(screen.getByDisplayValue('anthropic-version')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2023-06-01')).toBeInTheDocument();

    fireEvent.input(screen.getByDisplayValue('2023-06-01'), { target: { value: '2024-01-01' } });
    expect(onChange).toHaveBeenLastCalledWith({ 'anthropic-version': '2024-01-01' });
  });

  it('drops rows whose name is blank', () => {
    const onChange = vi.fn();
    render(<HeaderRows value={{}} onChange={onChange} />);
    // The single seeded blank row: fill only the value, name stays blank → nothing emitted.
    const inputs = screen.getAllByRole('textbox');
    fireEvent.input(inputs[1], { target: { value: 'orphan-value' } });
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('resyncs when the parent replaces the headers from outside', () => {
    // The Add-provider dialog re-seeds defaults when the upstream provider changes. A rows snapshot
    // taken only at mount would ignore that, leaving the editor blank for a provider that needs a
    // header (e.g. Anthropic).
    const { rerender } = render(<HeaderRows value={{}} onChange={vi.fn()} />);
    expect(screen.queryByDisplayValue('anthropic-version')).not.toBeInTheDocument();

    rerender(<HeaderRows value={{ 'anthropic-version': '2023-06-01' }} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('anthropic-version')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2023-06-01')).toBeInTheDocument();
  });
});
