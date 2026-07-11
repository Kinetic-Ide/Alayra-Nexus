import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

const post = vi.fn();
vi.mock('../../api', () => ({
  POST: (p: string, b: unknown) => post(p, b),
  ApiError: class ApiError extends Error {},
}));

import { AddKeyDialog } from './AddKeyDialog';

beforeEach(() => { post.mockReset(); post.mockResolvedValue({}); });

describe('AddKeyDialog', () => {
  it('posts the key to the pool with numeric limits', async () => {
    const onChanged = vi.fn();
    render(<AddKeyDialog providerId="p1" providerName="OpenAI Prod" onClose={vi.fn()} onChanged={onChanged} />);

    fireEvent.input(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /add key/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/admin/providers/p1/keys');
    expect(body).toMatchObject({ apiKey: 'sk-secret', rpmLimit: 60, tpmLimit: 100000 });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('disables the submit until a key is entered', () => {
    render(<AddKeyDialog providerId="p1" providerName="OpenAI Prod" onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add key/i })).toBeDisabled();
  });
});
