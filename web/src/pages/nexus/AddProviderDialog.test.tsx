import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

const post = vi.fn();
vi.mock('../../api', () => ({
  POST: (p: string, b: unknown) => post(p, b),
  ApiError: class ApiError extends Error {},
}));

import { AddProviderDialog } from './AddProviderDialog';

beforeEach(() => { post.mockReset(); post.mockResolvedValue({}); });

describe('AddProviderDialog', () => {
  it('derives the slug from the name and posts to /admin/providers', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<AddProviderDialog onClose={onClose} onCreated={onCreated} />);

    fireEvent.input(screen.getByPlaceholderText('OpenAI Prod'), { target: { value: 'OpenAI Prod' } });
    fireEvent.click(screen.getByRole('button', { name: /create pool/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/admin/providers');
    expect(body).toMatchObject({ name: 'OpenAI Prod', slug: 'openai-prod', provider: 'openai', tier: 'standard' });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('reveals custom-provider fields only for the custom kind', () => {
    render(<AddProviderDialog onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByPlaceholderText('data[].id')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /upstream provider/i }), { target: { value: 'custom' } });
    expect(screen.getByPlaceholderText('data[].id')).toBeInTheDocument();
  });
});
