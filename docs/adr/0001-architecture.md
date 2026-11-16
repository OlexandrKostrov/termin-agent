# ADR 0001: Architecture and guiding decisions

- Status: accepted
- Date: 2026-11-16

## Context

termin-agent places an outbound phone call to a German medical practice and books an appointment within constraints the user wrote in English. The call is a high-stakes, low-trust setting:

- the agent speaks personal and health-related data (GDPR Art. 9),
- it must disclose that it is an AI (EU AI Act Art. 50),
- a wrongly accepted slot is a real-world cost for the user and the practice.

An LLM is the right tool for open-ended German conversation, but it is the wrong tool for _guarantees_.

## Decisions

### 1. Hard rules are enforced in deterministic code

The conversational model never acts directly. It proposes typed actions (accept a slot, provide a field, spell, end the call). The `policy` package validates every action before anything is spoken:

| Rule                                        | Enforced by                                                      |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Never accept a slot outside the constraints | `checkSlot(slot, constraints, ctx)`                              |
| Never invent personal data                  | `guardField(field, profile)`: values only come from the profile  |
| Disclose AI and principal in sentence one   | `disclosureSentence(principal)`: a fixed template, not generated |
| Only call allow-listed numbers              | `checkOutboundNumber(number, allowList)`                         |

The model can be wrong. The guards make that a recoverable conversational event, not a wrong booking.

### 2. Two explicit state machines

- **Request**: `draft → queued → calling → booked | no_slot | callback | failed`.
- **Call**: `dialing → disclosure → negotiating ⇄ confirming → closing`, ending in `completed | voicemail | callback_requested | refused | dropped`.

Both are plain transition tables, so they are reviewable at a glance and exhaustively tested. A pure function maps a call result onto the request's terminal status. No library (XState etc.): the machines are small, and a table is the clearest documentation.

### 3. Internal packages are consumed as TypeScript source

Workspace packages export `./src/index.ts` directly ("internal packages"). There is no build step between packages, no stale `dist/`, and no source maps to chase. Apps that ship get bundled at their own boundary. This is revisited if a package is ever published.

### 4. Time is always Europe/Berlin, and time math uses Luxon

Constraints are local wall-clock rules ("after 15:00, not Wednesday"). Slots carry an ISO-8601 instant with offset and are evaluated in Europe/Berlin, so DST is handled. Relative expressions ("next week") are resolved against an injected `now`, never the system clock, which keeps tests and evals deterministic.

The agent _speaks_ times in unambiguous 24-hour form ("fünfzehn Uhr dreißig"). The parser _understands_ colloquial 12-hour forms ("halb vier") and flags them as ambiguous so the agent confirms them.

### 5. Validation at the edges with zod

Every external input (API bodies, LLM structured output, scenario files) is parsed with zod. Domain types are inferred from the schemas, so there is one source of truth.

### 6. Stack

TypeScript (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Node 22, pnpm workspaces, Vitest + fast-check, ESLint (typescript-eslint strict-type-checked), Prettier. Later milestones add PostgreSQL via Drizzle, Fastify, a provider-agnostic LLM adapter (Anthropic first), and a custom voice pipeline (telephony media streams, streaming STT/TTS).

## Consequences

- More upfront modelling than a "prompt + tools" prototype, but the guarantees are testable without an LLM.
- Evals can separate _conversation quality_ (graded) from _hard rules_ (asserted).
