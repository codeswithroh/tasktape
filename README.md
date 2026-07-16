# TaskTape

**Show your work once. Replay it safely.**

TaskTape is a desktop automation builder that learns from a recorded demonstration and the user's own words. It turns both into an editable workflow recipe that can be reviewed, scheduled, and executed.

## Current status

TaskTape now completes one real workflow end to end. A user can record a media-organizing routine, type or dictate the intended result, edit the inferred goal, choose a daily or weekly schedule while saving, review exact file changes, and run actual moves or copies with a persisted activity log. Manual and scheduled results appear in Run history.

A spoken schedule such as "every Monday at 9 AM" prefills the save controls. It never becomes active until the user reviews and saves the workflow. Every saved and completed state includes a clear New workflow action.

Recording starts with TaskTape's visual source gallery, which shows full displays and every currently available application window as named thumbnail tiles. The selected source is revalidated in Electron's main process immediately before capture.

Users can add or replace their own OpenAI API key from Settings. App-managed keys are encrypted through the operating system's secure storage and never exposed back to the renderer; `.env.local` remains a development-only fallback.

The initial release is macOS-first and is being built for OpenAI Build Week. The product vision is broader than the hackathon implementation, but the demo will prove one complete, reliable workflow rather than simulate universal desktop control.

The executable boundary is intentionally specific: TaskTape scans top-level files in one selected folder, recognizes common video and image formats, and organizes them into confirmed destination folders. Unsupported files and name collisions remain unchanged. Scheduled runs require TaskTape to be open. Background launch, history search, rollback, and arbitrary application control are not yet implemented.

## Product loop

1. Record a real desktop workflow.
2. Describe the result by voice or text.
3. Review the inferred goal, organization rules, and schedule.
4. Save the workflow and review the exact files TaskTape will change.
5. Run it now or let TaskTape run it on schedule while the app is open.
6. Inspect the result, run history, or start another workflow.

## Documentation

- [Product brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Voice and scheduling research](docs/voice-and-scheduling-research.md)
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
