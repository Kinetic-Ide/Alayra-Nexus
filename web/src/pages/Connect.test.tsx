import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import type { GatewayConfig } from '../api';

const useApi = vi.fn();
vi.mock('../hooks/useApi', () => ({ useApi: () => useApi() }));

import { Connect } from './Connect';

const sample: GatewayConfig = { baseUrl: 'https://nexus.example.com', nexusApiKey: 'nx_abc123', isFirstRun: false };

beforeEach(() => vi.clearAllMocks());

describe('Connect', () => {
  it('shows the base URL, key, endpoints, and a quick-start with tabs', () => {
    useApi.mockReturnValue({ data: sample, loading: false, error: null, reload: vi.fn() });
    render(<Connect />);
    expect(screen.getAllByText('https://nexus.example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('nx_abc123')).toBeInTheDocument();
    expect(screen.getByText('Quick start')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'cURL' })).toBeInTheDocument();
    expect(screen.getByText('https://nexus.example.com/v1/chat/completions')).toBeInTheDocument();
  });
});
