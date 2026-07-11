# Alayra Nexus — Dashboard Redesign Plan (Phase 7+)

**Status:** planning · **Author:** Abbas · **Scope:** the Nexus operator dashboard
(`frontend/`), served statically by Fastify. The `kinetic-admin` app is *reference only* —
a source of UX patterns (role-gated sidebar, stat-card / page-header / status-badge
primitives, Recharts usage) — and is never modified.

**Goal:** a world-class, at-a-glance operator console — a slate "glass" surface, a clean
12-section information architecture, live charts, a dark **and** light theme, and the
enterprise flows (first-run identity, audit/logs, admin accounts, branding, notifications)
that make it read as a finished, top-of-market product.

---

## 0. Where we are today (audit)

| Area | Current state |
|---|---|
| Rendering | Vanilla ES modules + one 201-line hand-written CSS file. No build step. Static-served by Fastify from `frontend/`. |
| Sections | 6 tabs: **Connect · Nexus · Models · Team Keys · Analytics · Settings**. Landing = Connect. |
| Theme | Dark only (slate `#09090b`, purple accent). No light mode, no theme switch, no font system. |
| Charts | Chart.js, **loaded from a CDN at runtime** (`analytics.js:19`). |
| Settings | One overcrowded tab (SSRF, guardrails, routing, cache, notifications, compliance, audit viewer all stacked). |
| Auth/first-run | `ADMIN_PASSWORD` env + optional TOTP + session tokens + admin API tokens (owner/viewer). `boot-check.js` only handles the `file://` mistake. No first-run wizard, no admin identity (email), no device fingerprint, no reset flow. |
| Backend already built (6.x) and **not yet surfaced in UI** | Audit log + filter (`GET /admin/audit`), compliance/retention, SSO config (`/admin/sso/config`), admin API tokens (mint/revoke) with roles, 2FA enrol/disable/recovery, routing status, cache config, per-modality usage (tokens/images/speech/transcription). |

**The backend is far ahead of the UI.** Much of the "new" work is *exposing* capabilities
that already exist and are tested, not building them.

---

## 1. Bugs & risks found while studying (fix as we touch each area)

1. **CDN charting dependency.** Chart.js is fetched from `cdn.jsdelivr.net` on first paint of
   Analytics. An air-gapped or strict-CSP enterprise install (our target buyer) gets no
   charts and a console error. **Fix:** vendor the chart library locally (self-hosted asset
   or bundled). Blocks nothing else; do it in the design-foundation phase.
2. **Landing tab is Connect.** The prompt wants **Overview** as the active landing plane.
   `app.js:14` hard-codes `showTab('connect')`.
3. **`assignedTier` is stored but not wired.** `Team.assignedTier` exists in the schema with a
   comment "wired with the Teams tab rebuild" — routing does not yet honor a team's preferred
   tier. The Teams rebuild must either wire it or the field is misleading. **Verify routing
   actually reads it** before advertising per-team routing in the UI.
4. **Settings overcrowding.** Seven+ cards in one scroll; no sub-navigation. Known; the
   redesign fixes it with sub-tabs.
5. **Audit viewer is buried in Settings.** 6.7 shipped the audit UI inside the Settings tab;
   the target IA gives **Logs** its own top-level section.
6. **No theme-awareness anywhere.** Every color is a hard-coded dark token. A light theme is a
   from-scratch token pass, not a tweak.
7. **`showTab` has no missing-node guard** (`app.js:29`) — a bad `data-tab` throws. Minor, but
   the new router should be defensive.
8. **Routing "rules" are implicit.** There is no user-editable rule engine — routing is
   model-first selection + tier order + a cost-weight tiebreaker. The UI must represent this
   *honestly* (a transparent "how a request is routed" view), not imply arbitrary rules that
   don't exist. Re-audit `modelSelect.ts` + `routing.ts` for correctness during that phase.

---

## 2. Rendering architecture — DECIDED: Vite + Preact, static build

**Chosen (2026-07-11): Option B — Vite + Preact building to static assets.** A tiny,
React-API component kit + a **self-hosted** chart lib (Recharts, or Chart.js vendored),
compiled to `frontend/dist`. **Fastify keeps serving static files exactly as today — the
single-container, self-host deployment model is unchanged.** The only cost is a build step
in CI/Docker, added in P7.1.

Rejected: *A (vanilla-in-place)* — caps how polished 12 rich sections can get; kept only as a
fallback if the build step ever proves troublesome. *C (Next.js/SSR)* — converts the gateway
from a static folder into a Node SSR app, against the OSS single-binary story; overkill here.

P7.1 executes this: scaffold Vite+Preact, wire the Docker/CI build to emit `frontend/dist`,
confirm Fastify static serving is byte-for-byte equivalent, then port the shell.

---

## 3. Design foundation (P7.1) — do this first, everything depends on it

- **Slate-glass surface.** One continuous slate background, no panel borders/lines; sidebar,
  top bar, logo, and cards float as translucent "glass" (subtle backdrop-blur + low-alpha
  fills + soft shadow) over it. Establish the elevation system (glass levels 0–2).
- **Design tokens.** Re-express every color as a semantic token (`--surface`, `--elevated`,
  `--text`, `--muted`, `--accent`, status colors) with **dark and light** values behind a
  `data-theme` attribute. Both palettes tuned for eye comfort (no pure-white on pure-black;
  WCAG-AA contrast; softened for low-vision / eyewear users per the brief).
- **Theme switch** in the top bar; persisted; respects `prefers-color-scheme` on first load.
- **Typography.** Adopt **two** system-adjacent, widely-shipped families (recommend **Inter**
  for UI text + **JetBrains Mono** for keys/IDs/code), self-hosted, no CDN.
- **Component kit:** StatCard (clickable variant), PageHeader, Card/GlassPanel, Button set,
  Badge/StatusBadge, Table, Tabs/SubTabs, Modal/Sheet, Toast, EmptyState, Meter, CopyField,
  chart wrappers. This kit is what makes 12 sections look like one product.
- **Chart layer:** self-hosted, theme-aware (reads the tokens), one shared options preset.
- **App shell:** new sidebar (grouped, role-gated, active-state), top bar (status pill,
  theme toggle, **notifications bell**, branding slot, account menu), client router.

---

## 4. Target information architecture — the 12 sections

Readiness tags: **[UI]** backend ready, UI-only · **[UI+small BE]** minor endpoint work ·
**[UI+big BE]** needs a real backend feature.

1. **Overview** *(new landing)* **[UI+small BE]** — persistent stat cards: total usage, input
   tokens, output tokens, active keys, active models, active teams, total cost-to-date. Below:
   four 7-day charts (in/out tokens · usage by key · usage by model · daily cost). Below that,
   two columns: recent **Logs** (left) and **Nexus key usage** (right). **Every card is
   clickable** and deep-links to its section (usage/tokens/cost → Analytics; keys → Nexus;
   models → Models). *BE:* one `/admin/overview` aggregate (counts + headline totals) so the
   landing is a single fast call, not six.
2. **Nexus [UI]** — provider pools + key rotation, redesigned as a centered, balanced column
   (not full-bleed, not cramped). Live RPM/TPM meters, breaker state, add/edit provider & keys.
3. **Models [UI]** — model registry redesign; capability toggles; **per-modality price capture**
   (input/output/image/speech/transcription — all already in the backend) shown clearly;
   primary/fallback/tier badges; a **Routing Rules** sub-view (see §5).
4. **Connect [UI]** — base URL / model id / API key with copy; a per-endpoint reference with
   **on-hover explanations** (what `/v1/chat/completions`, `/v1/messages`, `/v1/embeddings`,
   images, speech, transcription each do) and client snippets (Cursor, Cline, Claude Code, SDKs).
5. **Analytics [UI+small BE]** — enterprise charts (multi-color, by team / model / day, cost)
   plus **new per-modality charts including text-to-speech / speech usage** (backend already
   records `unit`/`quantity`; add a small per-unit time-series query). CSV export retained.
6. **Teams [UI+big BE]** — team-level settings: budget cap & period, assigned pool/model/tier,
   BYOK fallback, the keys a team issues, and per-team cost. *BE gaps:* wire `assignedTier`
   into routing; **member list needs a data model** (teams currently have no members). Scope
   decision below.
7. **Enterprise [UI+big BE]** — org-level settings above teams. *BE:* there is **no Org model**
   yet (Team was shaped to accept an `orgId` later). Either build a minimal Org layer or scope
   this to "organization profile + global enterprise policies" for now.
8. **Security [UI]** — aggregate everything security into one home: 2FA/TOTP enrol & recovery
   codes, active sessions & lockout policy, SSRF allowlist, **admin API tokens** (mint/revoke,
   owner/viewer). All endpoints already exist — this is surfacing + arranging.
9. **Caching metrics [UI+small BE]** — the brief's insight is correct and valuable: show last
   cache write, entries/size, hit count, hit-rate, and the TTL, so an operator understands
   staleness risk (a cache serving old data after a teammate changed it is a real footgun).
   Response caching exists (Phase 4.5) with Prometheus counters; **add a `/admin/cache/stats`
   JSON endpoint** + a per-entry/aggregate view and a clear TTL control with a "why this matters"
   note. Include a one-click **purge**.
10. **Settings [UI]** — restructure into **sub-tabs** (AI keys, Providers/Pools defaults,
    Routing, Cache, Guardrails, Notifications, Compliance, Appearance). **Appearance** hosts the
    theme (dark/light) and font choice. No more one-scroll pile.
11. **Logs [UI]** — promote the 6.7 audit trail to its own section: filterable, read-only,
    who/what/target/IP/status/time. This is where Overview's "recent logs" and every card's
    "jump to logs" land.
12. **Admin [UI+big BE]** — the account/identity home. Create up to **3 sub-admins**
    (name + email + role), suspend/remove them, add **role-based viewer users** so a team can
    see only their metrics, and manage invites (link or emailed password — operator's choice).
    *BE:* today RBAC is a single owner identity + owner/viewer tokens; **true multi-user admin
    accounts are a new backend feature** (was explicitly deferred in 6.5). This is the largest
    backend item and gates the first-run identity work below.

---

## 5. Routing rules — re-check for accuracy (folded into Models §3)

Nexus routing is **model-first selection**: capability filter → tier order → cost-weight
tiebreaker (`modelSelect.ts`, `routing.ts`), with a live `GET /admin/routing/status`. There is
no arbitrary rule engine, and the UI must reflect that truth — a transparent "given this
request, here is the ordered candidate list and why" view, not fictional rules. **Action:**
audit `modelSelect`/`routing` for correctness (tier ordering, cost weight, fallback, the
unwired `assignedTier`), then present it honestly. Verify against the backend before shipping UI copy.

---

## 6. Cross-cutting product features

- **First-run experience [UI+big BE].** When the gateway is launched fresh:
  1. Show the two run commands with **copy buttons** (no drag-select).
  2. A welcome screen → **"Generate my key"** → modal with the generated key, **copy** +
     **download** buttons, and clear "save this — it is your recovery key" instructions. The key
     is stored **hashed**; thereafter every provider/API key the operator adds is **encrypted**
     (the encryption path already exists).
  3. **Admin identity setup:** first name, last name, email, password, re-enter password —
     each field validated, password with an **eye toggle**, strict input sanitization (no script
     of any kind). Stored in the DB (email enables emailed alerts later, once Resend is set).
  4. **Optional authenticator (TOTP) with Skip.** If set, it is stored and enforced on the next
     sign-in from a changed device/IP.
  - *Security model (DECIDED 2026-07-11):* subsequent logins ask for email + password; a wrong
    password **or a changed device fingerprint** additionally requires TOTP. A **forgot-password
    fail-switch** accepts the recovery key; if the operator has neither, the documented CLI
    restore **wipes the database and all keys/metrics** as it resets — confirmed as intended, so
    an attacker who knows the trick gains nothing. Users are warned on day one to save the key.
    The wipe must be loud, double-confirmed, and clearly documented before it runs.
  - *BE reality:* Nexus auth is currently `ADMIN_PASSWORD` env, no DB admin identity, no device
    fingerprint, no recovery-key store, no reset-wipe. This is a **significant backend phase**
    and overlaps Admin (§12) multi-user accounts. `kinetic-admin` already has a device
    fingerprint (`lib/fingerprint.ts`) we can model the client side on.
- **Notifications bell [UI+medium BE].** Live count badge (0 when empty; live increments); click
  opens unread system notifications; clicking one deep-links to the exact section. *BE:* operator
  alerts exist as email/webhook only — add a small **in-dashboard notification feed** (store +
  `GET /admin/notifications` + unread state), or drive it from the audit/event stream.
- **Branding [UI+small BE].** Admin sets **company name + logo**; it appears by the sign-out
  control in the dashboard and on the login screen; the Alayra Nexus trademark/copyright sits in
  the login footer. *BE:* a small branding settings blob + logo upload (or data-URI store).

---

## 7. Reconciliation with the prior "Phases 7–12" list

The earlier list (Connect key-gen + custom domain, Teams rebuild, Analytics enterprise rebuild,
Docs tab, Alerts rule builder, Settings sub-tabs 2FA/CNAME/support) is **covered and extended**
by §4–§6. Additions this plan makes that the old list missed: the **Overview landing**, a real
**theme system (dark/light) + fonts**, the **Caching metrics** section, dedicated **Logs** and
**Admin** sections, the **first-run identity + recovery-key/reset-wipe** flow, the
**notifications bell**, **branding**, and the **CDN-chart fix**. The old "Docs tab" is folded
into Connect's on-hover endpoint reference; a standalone Docs section can be added if you want it.

---

## 8. Phase-by-phase execution order

Ordered so **fast, low-risk, backend-ready UI wins land first**, and the heavy backend features
come after the design system exists to present them.

- **P7.1 — Design foundation & shell.** Architecture decision executed; slate-glass tokens;
  dark+light theme + switch; fonts; component kit; self-hosted charts (kills the CDN bug);
  new sidebar/top-bar/router; Overview becomes landing. *(No backend.)*
- **P7.2 — Overview.** Stat cards (clickable/deep-link) + four 7-day charts + Logs/Nexus-usage
  columns. *(+ `/admin/overview` aggregate.)*
- **P7.3 — Nexus + Models + Connect** redesign (all UI-ready), incl. per-modality pricing
  display and the honest Routing-rules view + routing correctness audit.
- **P7.4 — Analytics** enterprise rebuild + per-modality (speech/TTS) charts. *(+ small per-unit
  series query.)*
- **P7.5 — Security + Logs** sections (surface existing 2FA/tokens/SSRF/lockout + promote audit).
- **P7.6 — Settings sub-tabs + Appearance** (theme/fonts live here) + **Caching metrics**.
  *(+ `/admin/cache/stats` + purge.)*
- **P7.7 — Notifications bell + Branding.** *(+ notification feed store + branding blob/upload.)*
- **P7.8 — Teams** rebuild. *(Wire `assignedTier`; decide member-list model.)*
- **P7.9 — Admin (multi-user accounts) + First-run identity + recovery/reset-wipe.** The big
  backend phase; do last, after the shell can present it and after your sign-off on the security
  model. *(Enterprise/Org layer scoped here or deferred.)*

Each phase ends with the standing green gate (lint/typecheck/test/build/audit 0) and a pushed
`nexus-changes.md` entry, same as every 6.x phase.

---

## 9. Decisions

**Settled (2026-07-11):**
1. **Rendering architecture — Vite + Preact, static build (Option B).** See §2.
2. **First-run reset = full database wipe — confirmed.** See §6.

**Still open — settle when we reach those phases (P7.8 / P7.9), not blocking P7.1–P7.7:**
3. **Teams — member list & Enterprise/Org layer.** Build a real multi-user/org data model, or
   ship Teams with settings/budget/keys and treat "members" + "Enterprise" as a later phase?
4. **Scope of P7.9.** Is true multi-user Admin (sub-admins + role-based users + invites) part of
   this redesign, or a fast-follow after the visual redesign ships? (Ties into the multi-user
   backend deferred in 6.5, and to the first-run identity work.)

---

*Nothing in this plan has been implemented. It is the study + roadmap only, per request.*
