import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders its title and closes on the close button and Escape', () => {
    const onClose = vi.fn();
    render(<Modal title="Add provider pool" onClose={onClose}>body</Modal>);
    expect(screen.getByText('Add provider pool')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
