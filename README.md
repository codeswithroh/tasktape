# TaskTape

**Turn a narrated bug recording into a living regression check.**

TaskTape Replay is a macOS desktop tool for teaching repeatable regression checks. Record the bug, explain the expected result, and TaskTape builds an editable check that can be run again after the product changes.

## Current status

The Build Week reference flow records a browser bug, captures the expected outcome by voice or text, replays the interaction with OpenAI computer use, and judges the final screen against that outcome. Each run stores a passed, failed, or inconclusive result with the final screenshot and a concise evidence trail.

Checks have editable instructions and can run now or on hourly, daily, weekday, or weekly timing. Manual and scheduled results appear in Run history, so a team can see when a previously fixed behavior regresses.

A spoken schedule such as "every Monday at 9 AM" prefills the save controls. It never becomes active until the user confirms unattended execution and saves the task. The Scheduled view shows the next run, last result, pause or resume, and Run now controls.

Recording starts with TaskTape's visual source gallery, which shows full displays and every currently available application window as named thumbnail tiles. The selected source is revalidated in Electron's main process immediately before capture.

Users can add or replace their own OpenAI API key from Settings. App-managed keys are encrypted through the operating system's secure storage and never exposed back to the renderer; `.env.local` remains a development-only fallback.

The initial release is macOS-first and is being built for OpenAI Build Week. The hackathon demo proves one complete browser regression loop deeply. It does not claim broad, deterministic automation across every desktop application.

The reliable local-file capability learns extension groups and child-folder destinations from the demonstration, then organizes top-level files inside one approved folder. The user does not configure separate video or image fields. Tasks that need an application or website use OpenAI computer use through a native macOS input adapter. Model safety checks stop the run for review, and the agent is bounded to 25 turns. Scheduled runs require TaskTape to be open and the Mac to be awake. Background launch, history search, rollback, and safety-check resumption are not yet implemented.

## Product loop

1. Record the bug and the steps that reproduce it.
2. Describe the expected result by voice or text.
3. Review the learned replay steps and success condition.
4. Save the check and choose whether it should run on a schedule.
5. Replay it against the current build.
6. Inspect the verdict, final screenshot, evidence, and run history.

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
