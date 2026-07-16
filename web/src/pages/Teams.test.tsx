import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';

const get   = vi.fn();
const post  = vi.fn();
const patch = vi.fn();
const del   = vi.fn();
vi.mock('../api', () => ({
  GET:   (p: string) => get(p),
  POST:  (p: string, b?: unknown) => post(p, b),
  PATCH: (p: string, b?: unknown) => patch(p, b),
  DEL:   (p: string) => del(p),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; this.name = 'ApiError'; }
  },
}));

import { Teams } from './Teams';

const team = (over: Record<string, unknown> = {}) => ({
  id: 't1', name: 'Frontend', status: 'active', assignedTier: 'fast',
  budgetUsd: 100, budgetPeriod: 'monthly', keyCount: 2, spendUsd: 40, createdAt: '2026-07-01T00:00:00Z',
  ...over,
});
const key = (over: Record<string, unknown> = {}) => ({
  id: 'k1', name: 'Abbas', maskedKey: 'nx_ab••••••••1234', team: { id: 't1', name: 'Frontend' }, createdAt: '2026-07-10T00:00:00Z',
  ...over,
});

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset(); del.mockReset();
  get.mockImplementation((p: string) => {
    if (p === '/admin/teams')     return Promise.resolve({ teams: [team()] });
    if (p === '/admin/team-keys') return Promise.resolve({ keys: [key()] });
    return Promise.resolve({});
  });
  post.mockResolvedValue({ team: { id: 't2' }, key: { name: 'CI', plainKey: 'nx_plaintext_once' } });
  patch.mockResolvedValue({});
  del.mockResolvedValue({ success: true });
});

describe('Teams — list', () => {
  it('shows a team with its tier, budget, and status', async () => {
    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Frontend')).toBeInTheDocument());
    expect(screen.getByText('Fast')).toBeInTheDocument();           // preferred routing tier badge
    expect(screen.getByText(/\$40\.00 \/ \$100\.00/)).toBeInTheDocument(); // spend / budget
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('creates a team through the modal', async () => {
    render(<Teams />);
    await waitFor(() => expect(screen.getByRole('button', { name: /new team/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new team/i }));

    const nameInput = await screen.findByPlaceholderText(/Frontend, Data Science/i);
    fireEvent.input(nameInput, { target: { value: 'Data Science' } });
    fireEvent.click(screen.getByRole('button', { name: /create team/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/teams', expect.objectContaining({ name: 'Data Science' })));
  });

  it('deletes a team only after confirming', async () => {
    render(<Teams />);
    await waitFor(() => expect(screen.getByRole('button', { name: /delete frontend/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /delete frontend/i }));

    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /delete team/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/admin/teams/t1'));
  });
});

describe('Teams — access keys', () => {
  it('lists keys and shows the plaintext once on creation', async () => {
    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Frontend')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /access keys/i }));

    await waitFor(() => expect(screen.getByText('Abbas')).toBeInTheDocument());

    fireEvent.input(screen.getByPlaceholderText(/CI pipeline/i), { target: { value: 'CI' } });
    fireEvent.click(screen.getByRole('button', { name: /create key/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/team-keys', { name: 'CI', teamId: null }));
    await waitFor(() => expect(screen.getByText('nx_plaintext_once')).toBeInTheDocument());
  });

  it('revokes a key only after confirming', async () => {
    render(<Teams />);
    await waitFor(() => expect(screen.getByText('Frontend')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /access keys/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /revoke abbas/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /revoke abbas/i }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /revoke key/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/admin/team-keys/k1'));
  });
});
