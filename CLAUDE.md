# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. Keep it current: update **Milestone status** in every milestone PR.

## Product

termin-agent is a German-speaking AI voice agent. It phones a medical practice (Arztpraxis) on a user's behalf and books an appointment (Termin). The user writes the request in English ("GP next week, after 15:00, not Wednesday"). The agent negotiates in German and returns a structured result plus the transcript.

This is a portfolio project for AI/Product Engineer roles. Optimise for clarity, correctness and engineering judgement over feature count. Reviewers read the code, the README and the evals.

MVP: one call type (outbound booking). The agent must handle these branches: slot accepted; no slot in window (counter-offer or give up gracefully); "call back later"; voicemail (hang up, leave no message); requests to repeat or spell name, birth date or insurance (gesetzlich/privat); refusal or dropped call.

## Hard rules (non-negotiable, enforced in code, tested)

1. **Never accept a slot outside the user's constraints.** Every accept goes through `checkSlot` (`packages/policy`).
2. **Never invent personal data.** Spoken personal data comes only from `guardField` (`packages/policy`). If a field is missing, say so; never guess.
3. **The first sentence is the AI disclosure** naming the principal (EU AI Act Art. 50): `disclosureSentence`. It is a fixed template and is never LLM-generated.
4. **No calls to third parties in the MVP.** Outbound numbers must pass `checkOutboundNumber` against the env allow-list (the simulated practice plus the author's own numbers).
5. **Ask the user before** adding any paid service (Deepgram, ElevenLabs, Twilio, …) or anything that places a real call.
6. Health data minimisation: share the visit reason only at the level the user allowed (`visit.shareDetail`).

## Commands

```bash
pnpm install
pnpm check            # format:check + lint + typecheck + test (what CI runs)
pnpm test             # vitest, all packages
pnpm test:coverage
pnpm lint
pnpm typecheck        # tsc --noEmit in every package
pnpm format           # prettier --write
pnpm --filter @termin/time-de test   # single package
```

## Layout

- `packages/domain`: zod schemas (single source of truth for types), request + call state machines, `AppError` contract.
- `packages/time-de`: Europe/Berlin date resolution, German public holidays, German number words, `speakTime`/`speakDate`/`parseGermanTime`, spelling alphabets.
- `packages/policy`: pure guards: `checkSlot`, `guardField`, `disclosureSentence`, `checkOutboundNumber`.
- `docs/adr/`: architecture decisions. Add an ADR for any decision a reviewer might question.

Planned (not yet present): `packages/llm` (provider adapter, Anthropic first, OpenAI in M6), `packages/agent`, `packages/practice-sim`, `packages/voice`, `packages/db` (PostgreSQL + Drizzle, docker-compose), `apps/api` (Fastify: `POST /requests` with `Idempotency-Key`, `GET /requests/:id`), `apps/cli`, `evals/`.

## Conventions

- TypeScript strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`; ESM (`NodeNext`), so relative imports end in `.js`.
- Internal packages export `./src/index.ts` directly; there is no build step between packages (ADR 0001).
- Types are inferred from zod schemas (`z.infer`); don't hand-write duplicates.
- Pure functions in the domain/policy layers: no I/O, no `Date.now()`. Inject `now`.
- All times are evaluated in `Europe/Berlin` with Luxon. Slots are ISO-8601 with an offset.
- Errors: throw `DomainError` with a stable `code`. The API maps errors to `{ code, message, details }`.
- Tests sit next to the code (`*.test.ts`). Use fast-check for invariants, and give each hard rule a property test.
- Small, focused commits. One PR per milestone with green CI (format, lint, typecheck, tests).
- Develop on the session branch you were given; never push to `main`.

## Milestone status

- [x] M0: scaffold, tooling, CI, docs
- [x] M1: domain schemas, request + call state machines, `time-de`, `policy`
- [ ] M2: English request → `Constraints` (LLM structured output) + confirmation echo
- [ ] M3: text-mode agent vs. scripted practice, all MVP branches
- [ ] M4: LLM receptionist simulator, eval harness, `EVALS.md` with hard-rule gates
- [ ] M5: voice pipeline, API, PostgreSQL via Drizzle
- [ ] M6: polish, OpenAI adapter + side-by-side evals, demo recording

## Open items carried into M2+

- `visit.detail` is free text in the user's language (English). Before the agent speaks it, M2 must produce a German rendering that the user confirms (store it as its own field). The agent must never translate it live.
- `parseGermanTime` flags 12-hour colloquial times as `ambiguous`. The agent (M3) must read back the slot in 24-hour form in the `confirming` phase before accepting.
- Holidays that apply only in parts of a state (Fronleichnam in parts of SN/TH, Mariä Himmelfahrt in BY) are not modelled; the practice's answer wins.
- Retries after `callback` create a new request linked to the old one (the request machine's terminals stay terminal).
