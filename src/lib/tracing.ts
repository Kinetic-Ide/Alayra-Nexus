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

import { trace, SpanStatusCode, type Span, type Attributes } from '@opentelemetry/api';

// ── OpenTelemetry (optional) ──────────────────────────────────────────────────
// We create spans for the gateway → provider call using the OTel API only. Without
// an OTel SDK registered in the process these are cheap no-ops, so there is zero
// cost by default. To collect real traces, run the app with a standard OTel SDK
// (e.g. `node --require @opentelemetry/auto-instrumentations-node/register`) and
// point `OTEL_EXPORTER_OTLP_ENDPOINT` at your collector — the spans below are then
// exported and correlated with the auto-instrumented Fastify/fetch spans.

const tracer = trace.getTracer('alayra-nexus');

/** Start a span for one upstream provider request. Caller must end it. */
export function startUpstreamSpan(attributes: Attributes): Span {
  return tracer.startSpan('nexus.upstream.request', { attributes });
}

export { SpanStatusCode };
export type { Span };
