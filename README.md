# TaskTape

**Show your work once. Replay it safely.**

TaskTape is a desktop automation builder that learns from a recorded demonstration and the user's own words. It turns both into an editable workflow recipe that can be reviewed, scheduled, and executed.

## Current status

TaskTape turns a recording into a saved task with editable instructions, an execution capability, and an optional schedule. A user can type or dictate the intended result, review what TaskTape learned, edit the goal and instructions, run it now, or choose hourly, daily, weekday, or weekly timing. Manual and scheduled results appear in Run history.

A spoken schedule such as "every Monday at 9 AM" prefills the save controls. It never becomes active until the user confirms unattended execution and saves the task. The Scheduled view shows the next run, last result, pause or resume, and Run now controls.

Recording starts with TaskTape's visual source gallery, which shows full displays and every currently available application window as named thumbnail tiles. The selected source is revalidated in Electron's main process immediately before capture.

Users can add or replace their own OpenAI API key from Settings. App-managed keys are encrypted through the operating system's secure storage and never exposed back to the renderer; `.env.local` remains a development-only fallback.

The initial release is macOS-first and is being built for OpenAI Build Week. The product vision is broader than the hackathon implementation, but the demo will prove one complete, reliable workflow rather than simulate universal desktop control.

The reliable local-file capability learns extension groups and child-folder destinations from the demonstration, then organizes top-level files inside one approved folder. The user does not configure separate video or image fields. Tasks that need an application or website use OpenAI computer use through a native macOS input adapter. Model safety checks stop the run for review, and the agent is bounded to 25 turns. Scheduled runs require TaskTape to be open and the Mac to be awake. Background launch, history search, rollback, and safety-check resumption are not yet implemented.

## Product loop

1. Record a real desktop workflow.
2. Describe the result by voice or text.
3. Review the inferred goal, learned actions, and schedule.
4. Save the task and confirm any recurring execution.
5. Run it now or let TaskTape run it on schedule while the app is open.
6. Inspect the result, run history, or start another workflow.

## Documentation

- [Product brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Voice and scheduling research](docs/voice-and-scheduling-research.md)
- [Milestone roadmap](docs/roadmap.md)
- [Verification log](docs/verification.md)

## Development

Prerequisites: Node.js 22+, pnpm 11.7.0, Xcode Command Line Tools, and macOS for desktop capture and computer-control verification.

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
