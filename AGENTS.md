# AGENTS.md — New Horizons 2026 Live Event Dashboard

## Mission and engineering standard
This is a high-visibility, client-facing, live-event software delivery. Build an accurate, reliable, visually excellent dashboard and a simple staff controller that remains understandable and maintainable by its owner or any future developer. Favor clarity, maintainability, verifiability, security, and operational resilience over cleverness or speed. Treat all instructions in this file as project-level engineering requirements.

## Scope and boundaries
The broader event initiative may include two distinct systems. **This repository's confirmed scope is only the Live Event Dashboard and its Staff Controller.** Do not implement the other system without explicit approval.

Event reference: https://newhorizons2026.com. b2match is the event registration and meeting platform. The public dashboard is shown on a large venue screen and presents three pillars:

- **MEET — Attendance:** registered participants versus QR-code checked-in participants, plus an understandable attendance progress indicator. Registration and check-in counts are expected to come from the available b2match API access; actual endpoints, permissions, semantics, and refresh limits must be verified.
- **MATCH — Meetings:** organizer-provided meeting target versus actual completed meetings. A meeting is a meeting, not a unique participant; one person can have several meetings. Completed meeting count is updated manually by authorized staff using `+1`, `+2`, `+3`, and a controlled undo/correction mechanism. **Do not provide free-form numeric total entry** unless specifically approved. Animate changes with a rolling/odometer-style number transition without changing underlying numerical accuracy.
- **GROW — Feedback:** average meeting rating on a 1–5 scale and total rating submissions. Staff enter each rating using one of five explicit rating controls. Keep individual rating records for correct averages and undo/audit purposes. Do not display written feedback notes on the public screen.

One staff operator and roughly 300 current registrations are planning assumptions, **not limits or guarantees**. The meeting target, meeting-completion definition, API coverage, and exact operational settings must be confirmed from authoritative sources. Never present a scheduled meeting as completed unless the agreed source semantics support that conclusion.

## Approved direction, not an excuse to skip validation
- **Frontend:** React + Vite + TypeScript + Tailwind CSS, with appropriate accessible animation tools.
- **Backend/API:** Supabase Edge Functions for server-side b2match access and authenticated staff mutations.
- **Database, auth and real-time:** Supabase PostgreSQL, Supabase Auth, Supabase Realtime.
- **Hosting:** Frontend hosting is undecided. Supabase hosts the API routes; validate deployment compatibility and plan terms before production.

Keep the app lightweight. Do not introduce Next.js, a separate Express server, Redis, Zapier, or additional infrastructure without a documented technical need and owner approval. Dependencies must be justified, maintained, and pinned through a committed lockfile.

## Authority and approval gates
1. **Never invent** facts, counts, endpoints, credentials, event targets, business rules, client approvals, or successful test results. Clearly label test fixtures and mock data; never expose them as live event data.
2. Do not silently change scope, KPI definitions, UI behavior, integrations, stack, data model, security model, deployment topology, costs, or production settings.
3. **Ask the project owner before major decisions**: new features, schema migrations with operational impact, new paid services, third-party data sharing, destructive operations, production releases, authentication changes, and meaningful architectural redesigns. Present options, impact, risks, and recommendation; await explicit approval.
4. Routine, in-scope implementation details may be decided using the documented architecture, but must be described in the work summary and reflected in relevant docs.
5. Never perform hidden actions, conceal limitations, bypass authorization, fabricate logs, or claim completion without evidence.
6. Do not overwrite or delete user/client data or production resources without explicit authorization and a rollback plan.

## Repository organization
Prefer this layout unless a clear reason to change it is approved:

```text
/
  AGENTS.md
  README.md
  .env.example
  frontend/
    src/
      app/             # routing, app bootstrap, providers
      pages/           # event display and staff controller
      components/      # shared, focused UI components
      features/        # meet, match, grow, controller
      hooks/
      lib/             # typed API client and utilities
      styles/
      assets/          # approved brand assets only
    public/
    tests/
  supabase/
    functions/          # Edge endpoints and shared b2match logic
    migrations/         # versioned PostgreSQL schema
    tests/              # synthetic-only function logic tests
  docs/
    architecture/
    frontend/
    backend/
    database/
    integrations/
    security/
    testing/
    deployment/
    operations/
    maintenance/
    handover/
  scripts/             # documented, necessary tooling only
```

Use clear, predictable names; place each file where future maintainers expect it. Avoid mysterious scripts, generic catch-all utilities, duplicate modules, temporary files, obsolete components, and unreferenced assets. Do not create empty scaffolding merely to satisfy a diagram. Keep source files focused and discoverable. Separate public dashboard and private controller routes, permissions, and layouts.

## Documentation is part of the implementation
`docs/` is the canonical technical knowledge base. Establish a small set of stable, topic-specific files, such as:

- `docs/architecture/SYSTEM_OVERVIEW.md` — boundaries, data flows, key decisions.
- `docs/frontend/UI_AND_BRANDING.md` — layouts, components, animations, accessibility, official visual rules.
- `docs/backend/API_CONTRACTS.md` — internal endpoints, validation, errors, access control.
- `docs/database/SCHEMA.md` — tables, constraints, migrations, retention, consistency.
- `docs/integrations/B2MATCH_API.md` — verified endpoints, permissions, mappings, polling, limits, failure behavior.
- `docs/security/SECURITY.md` — auth, secrets, permissions, threats, incident procedures.
- `docs/testing/TEST_STRATEGY.md` — automated and event-day acceptance tests.
- `docs/deployment/DEPLOYMENT.md` — environments, configuration, release, rollback.
- `docs/operations/EVENT_DAY_RUNBOOK.md` — monitoring, staff workflow, outages, recovery.
- `docs/maintenance/MAINTENANCE.md` — dependency upgrades, housekeeping, routine checks.
- `README.md` — setup, repository navigation, and operational entry points; keep it usable by the project owner and any future maintainer.

**Update the existing canonical document for a topic on every relevant code change.** Never generate `API_FIX_2.md`, `API_NEW.md`, dated duplicate explanations, or one-off Markdown documents per change. Create a new document only for a genuinely new, lasting topic that does not fit an existing document. Maintain links from `README.md` and avoid contradictory or stale guidance. Keep decisions and verified facts distinct from pending assumptions; use a concise change-history section within the relevant canonical document when traceability is useful. Read the relevant docs *before* editing code. Update docs in the same change set as the code.

## Official visual identity
Use the provided **“new horizons branding option 2 (3).pdf”** as the authoritative brand asset, not improvised interpretations. Its visual concept is **Horizons in Motion** and its event pillars are **MEET / MATCH / GROW**. It specifies Manrope for display/headlines and Inter for information/body text. Core listed colors: primary red `#AC0F2E`, burgundy `#7A0019`, cream `#FFF6F1`, charcoal `#2B2B2B`, deep blue `#082D5B`. The brand PDF's 'Blush' swatch appears pale pink visually but its extracted hex text reads `#08D9DE`; **do not silently resolve this inconsistency**—verify the approved hex with the owner or original design assets before encoding that color. The official geometry uses intersecting petal shapes, consistent spacing and approved palette combinations. Never distort brand motifs, introduce unapproved colors, or treat illustrative mockups as final specifications.

Design for a distant audience: large legible numerals, plain labels, high contrast, minimal clutter, stable layout, and smooth but restrained motion. Honor reduced-motion preferences. The private controller prioritizes fast, error-resistant operation and accessible touch targets. No decorative animation may obscure numerical truth.

## Data integrity and live behavior
- **Hybrid sources:** b2match API for registration/check-in counts; authenticated staff actions stored in Supabase for completed meetings and ratings. Never claim meetings or ratings are API-synchronized unless the integration has been explicitly implemented and verified.
- Access b2match only from a server-side Supabase Edge Function. Keep all private tokens in environment secrets, not frontend bundles or Git. Validate actual API response contracts and permitted polling frequency before selecting a refresh interval.
- For meeting increments, use atomic, validated, transactional server-side mutations; prohibit negative totals and prevent accidental duplicate submissions (idempotency keys). Implement `+1`, `+2`, `+3`, and an auditable undo that reverses a specific prior action safely.
- For feedback, store each rating with integer validation `1..5`; derive average from actual rating records or a provably consistent aggregate. Undo must preserve auditability and recalculate correctly.
- Persist every successful change before reporting success. Use authorized real-time subscriptions to update the screen; reconnect and refetch authoritative state after network interruptions. Never rely on client-only counters as the source of truth.
- When the b2match API is temporarily unavailable, preserve the last known successful values and visibly indicate stale data or connection status; **never replace unknown values with zero**.
- Track timestamps and source freshness. Do not mix demo values with production. Define target values as explicit, owner-approved configuration; do not guess.
- Protect against rapid double-taps and conflicting operations without introducing excessive friction to normal event operations. Provide a readable recent-action history and undo feedback.

## Security and privacy
Require authentication and server-side authorization for every controller mutation. The public dashboard must have read-only access to only the aggregated values needed for display. Apply least privilege, parameter validation, appropriate CORS policy, secure session handling, rate limiting where appropriate, and careful logging without secrets or unnecessary participant data. Supabase row-level security must be configured and tested for any direct client access; privileged service credentials must never reach the browser. Prefer not to ingest participant-level personal data at all. Document retention, access ownership, and recovery procedures.

## Engineering quality rules
- Use strict TypeScript, formatting, linting, and meaningful types at API boundaries. Validate external inputs and responses at runtime.
- Prefer small, cohesive modules and straightforward functions. Avoid repeated logic, unnecessary loops, speculative abstraction, overengineering, and premature optimization.
- Use consistent naming, predictable imports, descriptive errors, and focused comments explaining *why* non-obvious decisions exist. Do not add autogenerated noise or vague AI-sounding commentary.
- Do not leave commented-out old implementations, unused code, stale feature flags, unexplained dependencies, orphan files, or abandoned test artifacts. Remove safely after confirming no references or migration dependencies remain.
- Preserve existing behavior outside the requested change. Keep changes reviewable and scoped; explain trade-offs and any compatibility implications.
- Never run destructive database commands, unreviewed migrations, or production operations casually.

## Testing and event-day readiness
For each affected feature, write or update appropriate automated tests. At minimum verify meeting increments (`+1/+2/+3`), duplicate-click handling, undo, rating bounds and averages, authentication/authorization, API response validation, stale-data fallback, realtime reconnection, and persistence across refreshes. Test realistic concurrent operations even if one operator is expected. Test large-screen legibility and different screen sizes, keyboard/touch access, reduced-motion behavior, and network failures. Do not mark tests as passed unless actually run; report skipped or blocked checks plainly.

Before release, perform an end-to-end rehearsal with clearly marked synthetic data, verify secrets and permissions, validate actual b2match values, test deployment/rollback, confirm monitoring and backups, and rehearse recovery if the internet, API, or database becomes unavailable. Document the event-day runbook and a designated operator workflow.

## Required agent workflow
1. Read `AGENTS.md`, `README.md`, and relevant canonical docs; inspect existing implementation before planning changes.
2. State the requested scope, known facts, assumptions, proposed edits, and whether an approval gate applies. Ask only for decisions actually needed.
3. Implement the smallest correct change; keep the repository tidy and follow established conventions.
4. Run relevant formatting, linting, type checks, tests, and build checks; never invent results.
5. Remove verified dead code and artifacts introduced or made obsolete by the change.
6. Update existing relevant docs in the same work item; update `.env.example` when configuration changes, without exposing secrets.
7. Deliver the mandatory file-by-file change report and completion checklist below after **every** implementation task, including small changes. Do not replace it with a vague summary.

## Definition of done
A task is complete only when its approved behavior is implemented, data integrity and security are preserved, affected tests and build checks are executed or clearly identified as blocked, docs reflect reality, obsolete code is cleaned up, and another developer can understand the change. A production release additionally requires owner approval and a verified rollback path. **Never sacrifice event-day accuracy, reliability, or handover quality for cosmetic polish.**


## Mandatory change report after every code change
Every completed task must end with a clear, factual **Change Report** addressed to the project owner. This is a response requirement, not a requirement to generate another Markdown file. Do not create a separate report document for each change. Include:

1. **Task and outcome:** what was requested, what actually changed, and whether it is complete, partial, or blocked.
2. **File-by-file breakdown:** list **every** created, modified, renamed, and deleted file by its exact repository-relative path. For each file, explicitly describe what was **added**, **changed**, and **removed**, as applicable. Name relevant functions, components, hooks, routes, SQL objects, configurations, styles, and business rules; explain their purpose and user-visible impact. If nothing was removed, say so rather than inventing removals.
3. **Behavior and data impact:** describe changes to counters, rating calculations, API contracts, persistence, auth, realtime behavior, animations, and any migrations or compatibility implications. State `none` when not applicable.
4. **Documentation changes:** identify the **existing canonical documentation files updated** and the sections amended. If documentation was not relevant, explain why.
5. **Verification evidence:** list the exact checks actually run (tests, typecheck, lint, build, manual verification) and their observed pass/fail/blocked outcomes. Never say a test passed if it was not executed.
6. **Cleanup:** identify removed dead code, unused imports/dependencies, obsolete assets, or temporary files. If none, say `No cleanup needed`.
7. **Approvals, risks, and next actions:** distinguish approved decisions from proposed ones; disclose any remaining limitation or work not done. Do not imply a production deployment occurred without proof.

Use this consistent response format (adapt details to the task, but do not omit affected files):

```text
CHANGE REPORT — <short task title>
Status: Complete | Partial | Blocked
Summary: <actual result>

Files created:
- path/to/file — Added: <specific components/functions/behavior>
Files modified:
- path/to/file — Added: ...; Changed: ...; Removed: ...
Files renamed:
- old/path -> new/path — Reason: ...
Files deleted:
- path/to/file — Reason: ...; reference checks: ...

Behavior / data / security impact: ...
Documentation updated: path/to/existing-doc.md — <sections updated>
Checks performed: <command or check> — PASS / FAIL / BLOCKED / NOT RUN
Cleanup performed: ...
Approvals / outstanding items / risks: ...

DEFINITION OF DONE
[ ] Approved scope implemented; no unauthorized changes
[ ] Every changed file accounted for in this report
[ ] No fabricated values, assumptions presented as facts, or hidden behavior
[ ] No unused, dead, duplicate, or unexplained code introduced
[ ] Security, data correctness, and rollback impact checked
[ ] Relevant tests, lint, typecheck, and build run (or blockers stated)
[ ] Existing canonical documentation updated where applicable
[ ] User-visible behavior and known limitations clearly described
[ ] Production release approved separately, if applicable
```

Mark each checklist item `[x]` only when verified; otherwise leave `[ ]` and explain the gap. Never use a polished report to conceal incomplete work. Keep the level of detail proportional to the change while preserving exact file paths and meaningful function-level explanations.
