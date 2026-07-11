# Changelog

All notable changes to Alayra Nexus™ are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The `model: "alayra-nexus-1"` routing contract is the public API surface covered by
semver. The legacy ids `kinetic-nexus-1` and `nexus` remain accepted as aliases.

## [Unreleased]

### Added
- **Operator notifications — Resend email + webhooks (Phase 6.4).** Get alerted when the
  gateway degrades or is attacked instead of watching the dashboard: a provider key
  auto-banned, a circuit breaker opening, or an admin login locked out. Off by default;
  configured from a new Settings card. Email goes through Resend (free tier) with the API
  key stored AES-256-GCM encrypted (never plaintext, never logged, masked in the UI), and
  a generic webhook target covers Slack/Discord/PagerDuty. Delivery is fire-and-forget and
  **never on the request path** — a mail outage cannot slow or fail a proxied request — and
  is coalesced so a flapping key produces one message per window, not a flood.
- **Speech-to-text — `POST /v1/audio/transcriptions` (Phase 6.3d).** Audio transcription
  over the same routing, failover, breaker, budgets, and analytics as every other
  endpoint. The audio arrives as a multipart upload; Nexus rebuilds the form with the
  model it routed to (never the client's) and forwards it, so the model abstraction holds
  here as everywhere else. The reply — JSON, plain text, or a subtitle format, depending
  on the caller's `response_format` — is passed straight through. Billed once per
  transcription against a model's `transcriptionPrice`. Uploads are bounded
  (`MAX_UPLOAD_BYTES`, ~26 MB default).
- **Per-modality price fields in the Models tab.** The registry editor now has inputs for
  image (`$/image`), speech (`$/1M chars`), and transcription (`$/file`) pricing, so the
  non-token endpoints added in 6.3b–6.3d can be priced from the dashboard rather than the
  API.
- **Text-to-speech — `POST /v1/audio/speech` (Phase 6.3c).** Speech synthesis routes to a
  model that declares the `speech` capability, through the same routing, failover,
  circuit breaker, budgets, and analytics as every other endpoint. The upstream returns
  audio, so the response is streamed back as raw bytes with its `Content-Type` intact
  (no JSON re-encoding). Billed per input character against a model's
  `speechPricePer1MChars`, reusing the per-modality usage accounting added in 6.3b.
- **Image generation — `POST /v1/images/generations` (Phase 6.3b).** Text-to-image
  requests route to a model that declares the `image` capability, through the same
  routing, failover, circuit breaker, budgets, and analytics as every other endpoint.
  Introduces **per-modality billing**: images are metered per generated image against a
  model's `imagePrice`, not per token, so image cost is accounted honestly without
  polluting token totals. Token usage now carries a `unit` and `quantity` (additive,
  zero-downtime migration) — the foundation the audio endpoints build on next.
- **Embeddings and legacy completions — `POST /v1/embeddings`, `POST /v1/completions`
  (Phase 6.3).** `/v1/embeddings` unlocks RAG stacks (LangChain, LlamaIndex, vector
  search); `/v1/completions` is the fill-in-the-middle / autocomplete endpoint. Both run
  through the same model-first routing, circuit breaker, admission control, BYOK
  isolation, budgets, and analytics as chat — a thin non-chat transport over the shared
  core, not a second routing path. Each selects a model by capability (`embedding`,
  `completion`); if none is configured the endpoint returns `503` naming the missing
  capability. Usage and cost are recorded per request against the real model.
- **Anthropic Messages API — `POST /v1/messages` (Phase 6.2).** Alayra Nexus now speaks
  Anthropic's protocol as well as OpenAI's, so **Claude Code** and the Anthropic SDKs
  route through the same gateway. Point Claude Code at it with
  `ANTHROPIC_BASE_URL=<nexus>` and `ANTHROPIC_AUTH_TOKEN=<team key>`. Streaming, tool
  calls, images, and a `system` prompt are translated to and from the OpenAI shape at
  the edge — the request runs through the exact same routing, failover, budgets,
  guardrails, cache, and analytics as `/v1/chat/completions`, not a second path.
  `GET /v1/models` now returns a shape both OpenAI and Anthropic clients accept, and API
  keys may be sent as `Authorization: Bearer` **or** `x-api-key`.

### Changed
- **Routing is model-first (Phase 6.1).** The Models tab registry is now the source of
  truth for which model runs, its tier, and its priority — not each pool's single
  `preferredModel`. Selection walks models (tier → priority → cost) and finds a healthy
  key for the chosen model's provider, so one Anthropic key can now serve, say, Sonnet
  at the premium tier and Haiku at the fast tier. Models gain a **capabilities** set
  (`chat`, `completion`, `embedding`, `image`, `speech`, `transcription`) — the
  foundation the upcoming protocol endpoints filter on. A pool is now purely
  credentials; its model field is optional and labelled legacy. Existing deployments
  are seeded automatically on startup (each active pool's model becomes a registry
  entry with its tier and `chat`), so routing behaves exactly as before until you add
  more models. A legacy pool-tier fallback covers chat if the registry is somehow
  empty.

### Fixed
- **Per-request cost is no longer silently $0** when a pool's model was absent from the
  registry. Usage is now attributed to the real registry model id chosen by routing, so
  spend and budget accounting are correct.
- **`PUT /admin/models` now validates the registry.** It previously stored whatever it
  was sent; a malformed save could corrupt routing for every request. Entries are
  schema-checked and rejected for duplicate ids or duplicate provider+model pairs.

## [1.2.0] - 2026-07-10

### Added
- **Admin authentication hardening (Phase 6).** Signing in now exchanges the password
  for a short-lived **session token** at `POST /admin/login`; the dashboard no longer
  keeps `ADMIN_PASSWORD` in browser storage. Optional **TOTP two-factor
  authentication** (RFC 6238, implemented on node's crypto with no new dependency and
  verified against the RFC's published test vectors) with ten single-use **recovery
  codes**, both enrolled from Settings or `/admin/auth/totp/*`. Enrolment takes effect
  only once a code confirms it, so an abandoned enrolment cannot lock you out.
  **Per-source lockout** after `ADMIN_MAX_LOGIN_ATTEMPTS` failures (default 5) for
  `ADMIN_LOCKOUT_SECONDS` (default 900), returning `429` + `Retry-After`. A wrong
  password and a wrong code are indistinguishable in the response, so the login form
  cannot be used as a password oracle. **Admin API tokens** (`/admin/tokens`, hashed
  and revocable) let scripts and CI authenticate without a second factor.
  `nexus_admin_login_total{result}` tracks sign-in outcomes. Every unsuccessful
  outcome feeds the lockout counter, including a correct password submitted without
  a code — otherwise an attacker already holding the password would have an
  unthrottled oracle confirming it.
- **Custom-domain storage** — a `DomainAlias` model with per-domain verification state
  and a TXT challenge token. Schema only; the UI arrives in Phase 7.
- **Architecture docs** (`docs/architecture/`): `PROJECT-STRUCTURE.md` covers the
  layering rule and the full request path; `FILE-OVERVIEW.md` is a where-to-look
  index and a checklist for adding a feature.
- **BYOK — bring your own key (Phase 5.5):** a provider key can now be owned by a
  team (`ownerTeamId`) instead of living in the shared pool. An owned key serves only
  that team's traffic. Routing tries the team's own keys first, then — if the team's
  new `byokFallback` flag allows it — the shared pool; with fall-back disabled the
  team is hard-isolated and gets `503` rather than a credential it did not bring.
  Owned keys are a *scoped pool*, not a parallel proxy: they reuse the same admission
  control, circuit breaker, guardrails, SSRF checks, and analytics pipeline. A caller
  with no team can never be routed through an owned key. Responses carry
  `X-Nexus-BYOK: true`, and `nexus_byok_requests_total{result}` tracks
  own / fallback / isolated_block. Configure via **Pools → + Key → Owner**, or
  `POST /admin/providers/:providerId/keys`.

- **Response caching (Phase 4.5):** optional exact-match response cache. When enabled,
  an identical request (same model + messages + generation params) is served from
  Redis, skipping the provider entirely — a real $0 call. The cache key excludes
  `stream`/`user`, so a hit is replayed in whichever mode the client asked for; every
  hit emits a $0 usage event attributed to the team (analytics stay honest, budget is
  not consumed). Tool-call and `n > 1` responses are not cached. Off by default;
  configurable via `CACHE_ENABLED` / `CACHE_TTL_SECONDS`, the dashboard Settings tab,
  or `GET/PUT /admin/settings/cache`. Responses carry `X-Nexus-Cache: hit|miss`, and a
  `nexus_response_cache_total{result}` metric tracks hit/miss/store.

### Security
- The admin password, the Nexus API key, and the metrics token are now compared with
  `crypto.timingSafeEqual` over fixed-width digests. `===` on strings short-circuits at
  the first differing byte, so rejection latency leaked how many leading bytes of a
  guess were correct. Team keys were already safe (hashed lookups).
- Provider names and ids no longer reach inline `onclick` handlers. HTML escaping does
  not protect a JavaScript string context — a browser decodes an attribute before
  parsing its contents as code — so a provider named `O'Reilly'); …` could break out.
  Values now travel in `data-` attributes read by a delegated listener. The edit-pool
  modal's `value=` attributes and several tabs' upstream error text are escaped too.

### Changed
- **`GET /admin/routing/status` reports per-provider key counts.** `totalKeys` and
  `activeKeys` were summed across a whole tier and then stamped onto every provider in
  it, so any tier with more than one provider showed each of them the tier's combined
  total — which the dashboard renders per provider.
- **README:** admin authentication was described as "bcrypt-hashed"; it never was.
- **Repository layout.** The admin dashboard moved from `public/` to `frontend/`,
  where its CSS and JavaScript are now separate files rather than one inline
  `<script>`; `frontend/js/` is a set of ES modules and is linted like the rest of
  the source. The admin API moved from `src/routes/admin.ts` to `src/routes/admin/`,
  split by resource. No endpoint, request, or response changed. If you mount or copy
  the dashboard yourself, update the path.
- **The response cache is now partitioned by routing scope.** A response produced by
  a team's private key is never replayed to another team or to the shared pool. This
  changes the cache key, so entries written by an earlier version are ignored and the
  cache repopulates naturally over one TTL after upgrade.
- **Deleting a team now also deletes the provider keys it owns.** Its *access* keys
  still survive, unassigned, losing only their budget cap. Releasing a private
  credential into the shared pool — where every other caller could route through it —
  is not an acceptable outcome of a delete. `DELETE /admin/teams/:id` returns
  `deletedOwnedKeys` so a caller can report what went with it.
- BYOK spend is costed, attributed, and counted against the team's budget cap. Set
  `budgetUsd: null` for a team that funds its own keys and should not be capped.

### Fixed
- **A missing Postgres or Redis now fails with an instruction, not a retry storm.**
  Starting the gateway without its dependencies printed roughly twenty identical
  `ECONNREFUSED` stack traces followed by an opaque `MaxRetriesPerRequestError`.
  Startup now checks both dependencies first and prints which one is unreachable, at
  which host and port, and the command that starts it. Connection URLs are reduced to
  `host:port` in that message, so a password in `REDIS_URL` or `DATABASE_URL` is never
  written to stdout. Reconnection errors during normal operation are logged once and
  then collapsed into a periodic count.
- **README:** the dashboard is served at `/`, not `/dashboard`, and manual setup now
  says that Postgres and Redis must be running first.
- **Opening the dashboard from the filesystem now explains itself.** Its JavaScript is
  ES modules, which a browser refuses to load from a `file://` origin — so
  double-clicking `index.html` rendered the login screen with every button inert and
  no visible error. A small classic script now detects this and points at
  `npm run dev` (or `npx serve frontend` to preview without a database).
- **Demo mode** now shows the BYOK **Owner** column in its provider key tables, so the
  preview matches the real dashboard.
- **The admin dashboard is now present in the container image.** The runtime stage
  never copied the dashboard's static files, and `@fastify/static` only logs a
  warning for a missing root — so published images started cleanly, served the API
  correctly, and returned `404` for `/`. Affects `v1.0.0` and `v1.1.0`; if you run
  the image, pull again once the next tag is published. Source installs were never
  affected.
- **Tier-downgrade reporting.** `X-Nexus-Tier-Downgrade` was set on every request a
  non-premium tier served, including deployments that never configured a premium
  provider. It now means what it says: a higher tier existed and could not serve the
  request.
- **Dashboard:** provider base URLs, team-key names, key labels, and error text are
  escaped before reaching `innerHTML`, and copy-button values moved out of inline
  `onclick` strings into `data-` attributes read by a delegated listener. A value
  containing a quote could previously break out of the attribute it sat in.
- **Dashboard:** a failed model-registry save no longer leaves the local registry
  holding the rejected change, which the next save would have persisted.
- **Dashboard:** the key "Test" button no longer stays stuck reading `err` when the
  request itself throws. The analytics charts now index their series once instead of
  rescanning the full result set for every plotted point.

## [1.1.0] - 2026-07-09

### Added
- **Teams & budget hierarchy (Phase 5):** a `Team` entity groups scoped access keys
  and carries a per-period USD budget cap (daily / weekly / monthly). Enforcement
  runs on the admission path: over-budget teams get `429` + `Retry-After` (window
  reset), suspended teams get `403`. Spend is Redis-tracked and seeded from real
  usage history, so caps set mid-period start from actual spend and survive a Redis
  restart. New admin API: `GET/POST/PATCH/DELETE /admin/teams` (list includes live
  period spend), team assignment on key creation, and `PATCH /admin/team-keys/:id`
  to reassign. Existing keys without a team are unaffected.
- **Observability (Phase 4.6):** a Prometheus-compatible `/metrics` endpoint —
  request rate/duration, upstream TTFB, tokens, cache-hit rate, per-provider
  request/error rates, pool utilization, and standard process metrics. Auth-guarded
  by `METRICS_TOKEN` (or `ADMIN_PASSWORD`), exempt from the abuse guard's rate limit.
  Optional OpenTelemetry span for the gateway→provider call (no-op without an SDK).
- README "Connect your tools" section with copy-paste setup for Cursor, Cline / Roo
  Code, Continue.dev, the OpenAI SDK (Python + Node), and curl.

### Fixed
- **Database migrations now actually apply.** The migration files were flat SQL that
  `prisma migrate deploy` (run by the container at startup) silently ignored — a
  fresh `docker run` database got no tables, and Compose installs missed the
  post-init migration. Migrations now use the standard Prisma layout and are applied
  in order on startup; the Compose initdb mount was removed as redundant.
  **Existing deployments** whose schema was created by the old initdb path should
  baseline once before upgrading:
  `npx prisma migrate resolve --applied 0001_init && npx prisma migrate resolve --applied 0002_team_key_usage`
  (or use `npm run db:push`).

## [1.0.0] - 2026-07-09

First tagged release and first published container image
(`ghcr.io/alayra-systems-pvt-limited/alayra-nexus`).

### Added
- **OpenAI-compatible proxy** (`/v1/chat/completions`) with full streaming
  pass-through and a single virtual model, `alayra-nexus-1`.
- **Real admission control** — atomic per-key RPM/TPM enforcement via a Redis Lua
  script, a real tokenizer (`js-tiktoken`) for pre-admission estimates, TPM
  reservation with post-response reconciliation, and upstream TTFT / body /
  stream-idle timeouts.
- **Circuit breaker** — per-key escalating cooldown, a single half-open recovery
  probe, separate flat handling for 429s, and auto-ban on repeated auth failures.
- **Cache-aware sticky routing** — multi-turn conversations stay pinned to the key
  that last served them so provider prompt caches are reused.
- **Cost-aware routing** (optional) — bias toward the cheapest healthy, in-headroom
  provider within a tier, as a tiebreaker that never overrides health or cache
  affinity.
- **Content guardrails** (optional) — pluggable prompt/response filtering to redact
  PII or block banned content / injection patterns.
- **SSRF protection** — outbound provider requests are restricted to http(s) and
  blocked from private/loopback/internal hosts by default, with an opt-in allowlist.
- **Async analytics pipeline** — usage events are buffered and written to Postgres
  in batched inserts off the request path.
- **Abuse guard** — a Redis-backed, per-credential rate limiter sized as a DoS
  backstop rather than a throughput cap.
- **Admin dashboard** — provider pools, model registry, team keys, analytics, and a
  Settings tab (network security, guardrails, cost-aware routing).
- **Distribution** — multi-arch (amd64 + arm64) Docker image, `docker compose`
  quickstart, CI (lint / typecheck / test / build / security audit), and CodeQL
  scanning.

### Fixed
- Container image: install OpenSSL in the Alpine build and runtime stages so Prisma
  resolves the correct `openssl-3.0.x` engine instead of mis-guessing `1.1.x`, which
  could otherwise fail the query engine at container startup.

### Security
- Apache-2.0 licensed. Outbound SSRF blocking on by default; secrets encrypted at
  rest with AES-256-GCM.

### Known gaps (roadmap)
- Constant-time comparison and 2FA for admin auth (Phase 6) are not yet in place;
  protect the admin password and API key accordingly for now.

[Unreleased]: https://github.com/Alayra-Systems-Pvt-Limited/Alayra-Nexus/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/Alayra-Systems-Pvt-Limited/Alayra-Nexus/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Alayra-Systems-Pvt-Limited/Alayra-Nexus/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Alayra-Systems-Pvt-Limited/Alayra-Nexus/releases/tag/v1.0.0
