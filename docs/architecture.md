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

## Capture source selection

TaskTape lists full displays and open application windows through Electron `desktopCapturer`, then renders a grouped thumbnail gallery in the sandboxed UI. A source ID selected by the user is validated against a freshly enumerated main-process source list. The display-media handler consumes that one pending selection and rejects requests without one; the renderer cannot nominate an arbitrary capture target.

## Analysis pipeline

The recorder saves a local video, then the sandboxed renderer uses native browser media decoding and a canvas to extract at most eight evenly spaced, downscaled JPEG frames. This avoids adding a GPL-licensed static `ffmpeg` distribution to the desktop package.

After recording, the user can type an intent or capture a bounded, microphone-only WebM/Opus voice note. The note is sent through the main process to `gpt-4o-mini-transcribe`; the editable transcript then becomes the primary intent input. TaskTape sends that transcript and only the selected video frames to the Responses API. Microphone permission is requested just in time and typing remains a complete fallback.

The default analysis model is [`gpt-5.6`](https://developers.openai.com/api/docs/models/gpt-5.6-sol), which supports image input and structured outputs through the Responses API. Direct video input is not assumed; the frame extraction boundary is intentional and testable.

## Workflow intermediate representation

Model output never executes directly. It must parse into a versioned Zod schema containing the goal, media rules, optional schedule proposal, observed evidence, and ambiguity annotations. The user can edit the goal, rules, source folder, and proposed timing before saving. The executor accepts only schema-valid recipes and known capability types.

## Initial capability boundary

The hackathon proof uses deterministic filesystem capabilities: inspect, classify, rename, create-directory, and move. Browser and arbitrary desktop control are future adapters, not simulated features in the initial build.

The first executable recipe scans regular files at the top level of one user-selected folder. It classifies supported video and image extensions, creates user-confirmed destination folders, and either moves or copies with exclusive destination creation. Unsupported files and collisions stay unchanged. A persisted plan records file size and modification time; execution refuses an action if the source changed after review.

## Persistence

Recordings, versioned workflow recipes, schedules, approved plans, and activity logs use filesystem-backed local metadata. Workflow JSON files are written with mode `0600`. The history view reads immutable run logs across saved workflows. SQLite remains deferred until history search or larger run volumes require indexed, transactional state.

## Scheduling

Each workflow can persist one daily or weekly schedule in local time as part of the save flow. A schedule stated in the transcript can prefill these controls, but it is not persisted until Save. The main process checks for due schedules every 30 seconds, creates a fresh plan from the current folder contents, executes known filesystem capabilities, advances the next run time, and writes a normal activity log marked as scheduled. An overdue schedule is checked when the app launches.

The current scheduler runs only while TaskTape is open. Operating-system background launch and catch-up policy controls are intentionally deferred and are stated in the scheduling UI.

## Security

- API credentials remain in the main process and are never exposed back to the renderer. Keys entered in Settings are encrypted through Electron `safeStorage`, persisted with mode `0600`, and take precedence over the development-only environment fallback.
- The main process allows only trusted-renderer display capture and microphone requests. Electron 43 on macOS reports `getDisplayMedia` as a media request with no camera or microphone type, while microphone requests contain only `audio`; camera-bearing requests remain denied.
- Recordings and extracted frames are ignored by Git and local by default.
- Manual destructive actions require explicit review and approval. Scheduled runs are limited to the saved folder and collision-safe executor. Rollback is not yet implemented.
- External links are opened through the operating system after the application denies new in-app windows.

## Testing strategy

- Vitest for schema and domain behavior.
- Integration tests for local persistence, media-frame boundaries, and capability adapters.
- Playwright's Electron support for packaged user journeys.
- Manual macOS verification for screen-recording and microphone permission behavior.
- Live OpenAI tests labeled separately from deterministic mocked tests.
