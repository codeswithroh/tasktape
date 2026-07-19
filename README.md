# TaskTape

**Turn a narrated bug recording into a living regression check.**

TaskTape Replay is a macOS desktop tool for teaching repeatable regression checks. Record the bug, explain the expected result, and TaskTape builds an editable check that can be run again after the product changes.

Claude Code and Codex can also operate TaskTape directly through its built-in local MCP server. An agent can launch an instrumented browser, reproduce a bug, collect screenshots, DOM snapshots, console messages, network failures, and an action trace, then compile that evidence into the same Replay check a human can review and run.

## Current status

The Build Week reference flow records a browser bug, captures the expected outcome by voice or text, replays the interaction with OpenAI computer use, and judges the final screen against that outcome. Each run stores a passed, failed, or inconclusive result with the final screenshot and a concise evidence trail.

The agent-operated reference flow is limited to local HTTP and HTTPS development servers. TaskTape creates a headed isolated Chrome session and exposes 12 bounded MCP tools for observation, interaction, evidence capture, check creation, and explicit execution. Finishing a capture never runs or schedules the check.

Checks have editable instructions and can run now or on hourly, daily, weekday, or weekly timing. Manual and scheduled results appear in Run history, so a team can see when a previously fixed behavior regresses.

A spoken schedule such as "every Monday at 9 AM" prefills the save controls. It never becomes active until the user confirms unattended execution and saves the task. The Scheduled view shows the next run, last result, pause or resume, and Run now controls.

Recording starts with TaskTape's visual source gallery, which shows full displays and every currently available application window as named thumbnail tiles. The selected source is revalidated in Electron's main process immediately before capture.

Users can add or replace their own OpenAI API key from Settings. App-managed keys are encrypted through the operating system's secure storage and never exposed back to the renderer; `.env.local` remains a development-only fallback.

The initial release is macOS-first and is being built for OpenAI Build Week. The hackathon demo proves one complete browser regression loop deeply. It does not claim broad, deterministic automation across every desktop application.

## Download

Download the Apple Silicon beta from the [TaskTape Replay site](https://codeswithroh.github.io/tasktape/) or from [GitHub Releases](https://github.com/codeswithroh/tasktape/releases/latest). The DMG contains TaskTape's tested browser runtime, so Google Chrome is not required.

The beta is not signed or notarized yet. After copying TaskTape to Applications, macOS may require you to control-click the app, choose Open, and confirm once. A signed release requires an Apple Developer ID certificate and notarization credentials.

The reliable local-file capability learns extension groups and child-folder destinations from the demonstration, then organizes top-level files inside one approved folder. The user does not configure separate video or image fields. Tasks that need an application or website use OpenAI computer use through a native macOS input adapter. Model safety checks stop the run for review, and the agent is bounded to 25 turns. Scheduled runs require TaskTape to be open and the Mac to be awake. Background launch, history search, rollback, and safety-check resumption are not yet implemented.

## Product loop

1. Record the bug yourself or ask Claude Code or Codex to reproduce it through TaskTape.
2. Capture the expected result by voice, text, or the MCP session request.
3. Review the learned replay steps, trace evidence, and success condition.
4. Save the check and choose whether it should run on a schedule.
5. Replay it against the current build.
6. Inspect the verdict, final screenshot, evidence, and run history.

## Agent connection

TaskTape shows the current local endpoint and copyable setup commands in Settings. With the app open, the default commands are:

```bash
claude mcp add --transport http tasktape http://127.0.0.1:19790/mcp
codex mcp add tasktape --url http://127.0.0.1:19790/mcp
```

Ask the connected agent to reproduce a bug on a local development URL and turn it into a Replay check. Agent evidence is stored under TaskTape's local application data, never in the repository.

## Documentation

- [Product brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Agent-operated replay milestone](docs/agent-mcp-milestone.md)
- [Voice and scheduling research](docs/voice-and-scheduling-research.md)
- [Market validation](docs/market-validation.md)
- [Milestone roadmap](docs/roadmap.md)
- [Verification log](docs/verification.md)

## Development

Prerequisites: Node.js 22+, pnpm 11.7.0, Xcode Command Line Tools, and macOS for desktop capture and computer-control verification. The packaging command downloads the pinned Playwright Chromium runtime into the release bundle.

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
