# TaskTape

**Show your work once. Replay it safely.**

TaskTape is a desktop automation builder that learns from a recorded demonstration and a short intent interview. It turns both into an editable workflow recipe that can be reviewed, dry-run, executed, and scheduled.

## Current status

Planning and foundation only. No application feature is implemented or claimed to work yet.

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
- [Milestone roadmap](docs/roadmap.md)
- [Verification log](docs/verification.md)

## Development

The technical stack and exact setup commands will be added at the end of Milestone 0, after the dependency audit is complete. See `AGENTS.md` for the engineering and verification rules that govern this repository.
