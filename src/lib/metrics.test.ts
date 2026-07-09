/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Alayra Nexus™ is a trademark of Alayra Systems. Use of the name or logo
 * is not granted by the software license below.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for details.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// metrics.ts imports prisma for the pool-gauge refresh; mock it so importing the
// module doesn't construct a real client. These tests exercise the counters/
// histograms directly and never call refreshPoolGauges.
vi.mock('./prisma', () => ({ prisma: {} }));

import { observeRequest, observeTtfb, addTokens, providerRequest, providerError, cacheHit, registry } from './metrics';

beforeEach(() => registry.resetMetrics());

describe('metrics recording', () => {
  it('records request outcomes with outcome/tier labels and duration', async () => {
    observeRequest('success', 'premium', 0.12);
    observeRequest('upstream_error', 'fast', 0.4);
    const text = await registry.metrics();
    expect(text).toMatch(/nexus_requests_total\{outcome="success",tier="premium"[^}]*\}\s+1/);
    expect(text).toMatch(/nexus_requests_total\{outcome="upstream_error",tier="fast"[^}]*\}\s+1/);
    expect(text).toContain('nexus_request_duration_seconds_bucket');
  });

  it('defaults a missing tier to "none"', async () => {
    observeRequest('no_capacity', undefined, 0.01);
    const text = await registry.metrics();
    expect(text).toMatch(/nexus_requests_total\{outcome="no_capacity",tier="none"[^}]*\}\s+1/);
  });

  it('counts tokens by direction and ignores zero', async () => {
    addTokens(100, 40);
    addTokens(0, 0);
    const text = await registry.metrics();
    expect(text).toMatch(/nexus_tokens_total\{direction="input"[^}]*\}\s+100/);
    expect(text).toMatch(/nexus_tokens_total\{direction="output"[^}]*\}\s+40/);
  });

  it('records per-provider requests and errors by kind', async () => {
    providerRequest('openai');
    providerError('openai', 'rate_limit');
    providerError('anthropic', 'server');
    const text = await registry.metrics();
    expect(text).toMatch(/nexus_provider_requests_total\{provider="openai"[^}]*\}\s+1/);
    expect(text).toMatch(/nexus_provider_errors_total\{provider="openai",kind="rate_limit"[^}]*\}\s+1/);
    expect(text).toMatch(/nexus_provider_errors_total\{provider="anthropic",kind="server"[^}]*\}\s+1/);
  });

  it('counts cache (sticky) hits and TTFB observations', async () => {
    cacheHit(); cacheHit();
    observeTtfb(0.3);
    const text = await registry.metrics();
    expect(text).toMatch(/nexus_cache_hits_total\{[^}]*\}\s+2/);
    expect(text).toContain('nexus_upstream_ttfb_seconds_bucket');
  });

  it('exposes standard process metrics and the Prometheus content type', async () => {
    const text = await registry.metrics();
    expect(text).toContain('process_cpu_seconds_total');
    expect(registry.contentType).toContain('text/plain');
  });
});
