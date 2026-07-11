import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import type { ModelsResponse } from '../api';

const useApi = vi.fn();
vi.mock('../hooks/useApi', () => ({ useApi: () => useApi() }));

import { Models } from './Models';

const sample: ModelsResponse = {
  capabilities: ['chat', 'completion', 'embedding'],
  models: [
    { id: 'm1', displayName: 'GPT-4o', modelString: 'gpt-4o', provider: 'openai', tier: 'premium', status: 'active', priority: 1, capabilities: ['chat'], hasVision: true, hasFIM: false, hasToolCalling: true, inputCostPer1M: 2.5, outputCostPer1M: 10, imagePrice: 0, speechPricePer1MChars: 0, transcriptionPrice: 0, contextWindow: 128000, maxTokens: 4096 },
    { id: 'm2', displayName: 'TTS', modelString: 'tts-1', provider: 'openai', tier: 'fast', status: 'active', priority: 1, capabilities: ['speech'], hasVision: false, hasFIM: false, hasToolCalling: false, inputCostPer1M: 0, outputCostPer1M: 0, imagePrice: 0, speechPricePer1MChars: 15, transcriptionPrice: 0, contextWindow: 0, maxTokens: 0 },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe('Models', () => {
  it('renders the registry with per-modality pricing and context', () => {
    useApi.mockReturnValue({ data: sample, loading: false, error: null, reload: vi.fn() });
    render(<Models />);
    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    expect(screen.getByText('$2.50 / $10.00 per 1M')).toBeInTheDocument(); // token pricing
    expect(screen.getByText('$15.00 / 1M chars')).toBeInTheDocument();     // speech pricing, not "$0"
    expect(screen.getByText('128K')).toBeInTheDocument();                  // context window, compacted
  });
});
