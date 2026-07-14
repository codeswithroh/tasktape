# TaskTape

**Show your work once. Replay it safely.**

TaskTape is a desktop automation builder that learns from a recorded demonstration and a short intent interview. It turns both into an editable workflow recipe that can be reviewed, dry-run, executed, and scheduled.

## Current status

Milestone 1 is complete. Milestone 2 has verified local key-frame extraction, a schema-bound analysis boundary, and the follow-up intent interview against a deterministic provider. The live OpenAI smoke test is currently blocked by the configured project's API quota, and audio extraction is not implemented yet.

The initial release is macOS-first and is being built for OpenAI Build Week. The product vision is broader than the hackathon implementation, but the demo will prove one complete, reliable workflow rather than simulate universal desktop control.

## Product loop

1. Record a real desktop workflow.
2. Answer focused questions about intent, variables, exceptions, and desired outcome.
3. Review the generated workflow recipe and its permissions.
4. Dry-run the workflow against a safe preview.
5. Run immediately or schedule it.
6. Inspect the result and activity log.

## Documentation

- [Product brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Milestone roadmap](docs/roadmap.md)
- [Verification log](docs/verification.md)

## Development

Prerequisites: Node.js 22+, pnpm 11.7.0, and macOS for desktop capture verification.

```bash
cd /Users/rohitpurkait/Documents/codex_build_week
pnpm install
pnpm check
pnpm dev
```

The separately invoked live model test regenerates its screenshot fixture before calling OpenAI:

```bash
pnpm test:live
```

The ignored `.env.local` file contains local credentials. Start from `.env.example` on a new machine and never commit secret values.

See `AGENTS.md` for the engineering and verification rules that govern this repository.
