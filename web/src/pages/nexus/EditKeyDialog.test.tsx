import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import type { NexusKeyHealth } from '../../api';

const patch = vi.fn();
const get = vi.fn();
const put = vi.fn();
const del = vi.fn();
const fetchModels = vi.fn();
vi.mock('../../api', () => ({
  PATCH: (path: string, body: unknown) => patch(path, body),
  GET: (p: string) => get(p),
  PUT: (p: string, b?: unknown) => put(p, b),
  DEL: (p: string) => del(p),
  fetchProviderModels: (id: string, key?: string) => fetchModels(id, key),
  ApiError: class ApiError extends Error {},
}));

import { EditKeyDialog } from './EditKeyDialog';

const key: NexusKeyHealth = {
  id: 'key-1', maskedKey: 'sk-••••••••••••••••••••••••••••••••abcd', label: 'primary', status: 'active',
  coolingUntil: null, rpmLimit: 60, tpmLimit: 100000, maxUsers: 1000, ownerTeamName: null, lastUsedAt: null,
};

const props = { k: key, providerId: 'p1', provider: 'openrouter', tier: 'standard' };

const FETCHED = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000 },
  { id: 'meta/llama-3', name: 'Llama 3' },
];

beforeEach(() => {
  patch.mockReset(); patch.mockResolvedValue({ key });
  get.mockReset(); get.mockResolvedValue({ models: [] });
  put.mockReset(); put.mockResolvedValue({});
  del.mockReset();
  fetchModels.mockReset();
});

describe('EditKeyDialog', () => {
  it('keeps the masked credential out of the title and shows it in a boxed row', () => {
    // The mask used to be the modal's title, where a full-length value ran off the edge and had to
    // be scrolled sideways to read.
    render(<EditKeyDialog {...props} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Edit key · primary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Edit key · primary/ }).textContent).not.toContain('••');
    expect(screen.getByText(key.maskedKey)).toBeInTheDocument();
  });

  it('prefills the current values and PATCHes only the edited fields', async () => {
    render(<EditKeyDialog {...props} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect((screen.getByDisplayValue('primary') as HTMLInputElement).value).toBe('primary');
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument(); // max users prefilled

    fireEvent.input(screen.getByDisplayValue('1000'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /save key/i }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/keys/key-1');
    expect(patch.mock.calls[0][1]).toMatchObject({ label: 'primary', maxUsers: 250, rpmLimit: 60, tpmLimit: 100000 });
    // No key replacement was entered, so apiKey must not be sent.
    expect(patch.mock.calls[0][1]).not.toHaveProperty('apiKey');
  });

  it('hides the replacement input until Replace is asked for', async () => {
    render(<EditKeyDialog {...props} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByPlaceholderText('sk-…')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /replace/i }));
    expect(screen.getByPlaceholderText('sk-…')).toBeInTheDocument();

    // Backing out restores the untouched state.
    fireEvent.click(screen.getByRole('button', { name: /keep current/i }));
    expect(screen.queryByPlaceholderText('sk-…')).toBeNull();
  });

  it('sends apiKey only when a replacement is entered', async () => {
    render(<EditKeyDialog {...props} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /replace/i }));
    fireEvent.input(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-new-value' } });
    fireEvent.click(screen.getByRole('button', { name: /save key/i }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][1]).toMatchObject({ apiKey: 'sk-new-value' });
  });

  it('re-fetches models for a replacement key and merges the picked ones with their pricing', async () => {
    fetchModels.mockResolvedValue({ models: FETCHED });
    render(<EditKeyDialog {...props} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /replace/i }));
    fireEvent.input(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-new-value' } });
    fireEvent.click(screen.getByRole('button', { name: /fetch models/i }));

    await waitFor(() => expect(screen.getByText('Models (0/2 selected)')).toBeInTheDocument());
    expect(fetchModels).toHaveBeenCalledWith('p1', 'sk-new-value');

    fireEvent.click(screen.getByRole('button', { name: /^openai\/gpt-4o(?![a-z0-9-])/ }));
    fireEvent.click(screen.getByRole('button', { name: /save key/i }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    const payload = put.mock.calls[0][1] as { models: Array<Record<string, unknown>> };
    expect(payload.models[0]).toMatchObject({
      provider: 'openrouter', modelString: 'openai/gpt-4o',
      inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000,
    });
  });

  it('does not touch the registry when no models were picked', async () => {
    fetchModels.mockResolvedValue({ models: FETCHED });
    render(<EditKeyDialog {...props} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /replace/i }));
    fireEvent.input(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-new-value' } });
    fireEvent.click(screen.getByRole('button', { name: /fetch models/i }));
    await waitFor(() => expect(screen.getByText('Models (0/2 selected)')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save key/i }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(put).not.toHaveBeenCalled();
  });
});
