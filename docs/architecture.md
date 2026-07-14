# Architecture

## Decision

TaskTape is a macOS-first Electron application built with TypeScript, React, and Vite.

Electron is used because its desktop capture and process isolation APIs let the project deliver and test a native recorder within the Build Week schedule. Recordings, recipes, and run data stay local by default, and privileged operations stay in the main process.

## Process boundaries

- **Renderer:** product UI only. It has no Node.js access and cannot read arbitrary files.
- **Preload:** a narrow, typed bridge exposing approved operations.
- **Main:** recording orchestration, filesystem capabilities, persistence, scheduling, and OpenAI requests.
- **Shared:** versioned schemas and pure domain logic used by every process and by tests.

`contextIsolation`, renderer sandboxing, and disabled Node integration are mandatory. New IPC operations require a typed contract and input validation.

## Analysis pipeline

The recorder saves a local video, then the sandboxed renderer uses native browser media decoding and a canvas to extract at most eight evenly spaced, downscaled JPEG frames. This avoids adding a GPL-licensed static `ffmpeg` distribution to the desktop package. TaskTape sends only those selected frames to the OpenAI Responses API. Audio capture and transcription are not implemented in Milestone 2's current scope.

The default analysis model is [`gpt-5.6`](https://developers.openai.com/api/docs/models/gpt-5.6-sol), which supports image input and structured outputs through the Responses API. Direct video input is not assumed; the frame extraction boundary is intentional and testable.

## Workflow intermediate representation

Model output never executes directly. It must parse into a versioned Zod schema containing the confirmed goal, inputs, ordered known capabilities, approvals, ambiguity annotations, and dry-run expectations. The executor accepts only schema-valid recipes and known capability types.

## Initial capability boundary

The hackathon proof uses deterministic filesystem capabilities: inspect, classify, rename, create-directory, and move. Browser and arbitrary desktop control are future adapters, not simulated features in the initial build.

## Persistence

Milestone 1 begins with filesystem-backed local metadata. SQLite will be introduced only when scheduling and run history require transactional state in Milestone 4.

## Security

- API credentials remain in the main process and are never exposed to the renderer.
- Recordings and extracted frames are ignored by Git and local by default.
- Destructive actions require explicit approval and an available rollback strategy.
- External links are opened through the operating system after the application denies new in-app windows.

## Testing strategy

- Vitest for schema and domain behavior.
- Integration tests for local persistence, media-frame boundaries, and capability adapters.
- Playwright's Electron support for packaged user journeys.
- Manual macOS verification for screen-recording permissions and native capture behavior.
- Live OpenAI tests labeled separately from deterministic mocked tests.
