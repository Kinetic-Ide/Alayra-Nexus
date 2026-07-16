import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import type { GatewayConfig } from '../api';

const useApi = vi.fn();
vi.mock('../hooks/useApi', () => ({ useApi: () => useApi() }));
// Rotate is owner-only in the UI; sign in as one so the button is on screen to assert about.
vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, getIdentity: () => ({ role: 'owner', userId: 'u1', name: 'Ada' }) };
});

import { Connect } from './Connect';

// The base URL as a REAL gateway sends it: origin + /v1 (lib/baseUrl.ts). The previous fixture
// omitted the /v1, which is why this suite never noticed the page printing `/v1/v1/…` for a year.
const sample: GatewayConfig = {
  baseUrl: 'https://nexus.example.com/v1',
  apiKeySet: true,
  apiKeyMasked: 'nx_abc1••••ef90',
  isFirstRun: false,
};

beforeEach(() => vi.clearAllMocks());

describe('Connect', () => {
  it('shows the base URL, endpoints, and a quick-start with tabs', () => {
    useApi.mockReturnValue({ data: sample, loading: false, error: null, reload: vi.fn() });
    render(<Connect />);
    expect(screen.getByText('Quick start')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'cURL' })).toBeInTheDocument();
  });

  it('never doubles the /v1 — the copyable base keeps it, the paths carry their own', () => {
    // The regression this locks down: the gateway sends `${origin}/v1`, and the endpoint paths are
    // written from the root, so joining them onto one value printed `…/v1/v1/chat/completions` on
    // the page whose whole job is "copy this and it works".
    useApi.mockReturnValue({ data: sample, loading: false, error: null, reload: vi.fn() });
    const { container } = render(<Connect />);

    // Paste-into-your-SDK base: keeps the /v1.
    expect(screen.getByText('https://nexus.example.com/v1')).toBeInTheDocument();
    // Endpoint reference: exactly one /v1, from the path.
    expect(screen.getByText('https://nexus.example.com/v1/chat/completions')).toBeInTheDocument();
    expect(container.textContent).not.toContain('/v1/v1/');
  });

  // Phase 7.13a changed this page's contract: the key is hashed at rest, so the page shows a hint
  // and offers a rotation. It used to print the live credential to anyone who could load the page.
  it('shows only a masked hint of the API key, never the key', () => {
    useApi.mockReturnValue({ data: sample, loading: false, error: null, reload: vi.fn() });
    const { container } = render(<Connect />);

    expect(screen.getByText('nx_abc1••••ef90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rotate/ })).toBeInTheDocument();
    // The page explains WHY it cannot show the key, rather than looking broken.
    expect(screen.getByText(/only once, when it is created/i)).toBeInTheDocument();
    // The quick-start carries a placeholder, not a real credential pasted into a shell command.
    expect(container.textContent).toContain('YOUR_NEXUS_KEY');
  });

  it('says how to get a key when none is set', () => {
    useApi.mockReturnValue({
      data: { ...sample, apiKeySet: false, apiKeyMasked: null },
      loading: false, error: null, reload: vi.fn(),
    });
    render(<Connect />);
    expect(screen.getByText(/Not set — rotate to generate one/i)).toBeInTheDocument();
  });
});
