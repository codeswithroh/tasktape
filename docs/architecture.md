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

## Reference product path

The Build Week product is TaskTape Replay: a narrated bug recording becomes a reusable regression check. The reference target is a disposable browser application with a broken and a fixed mode. This keeps the demo observable and repeatable while exercising the same capture, analysis, computer-use, evidence, scheduling, and history boundaries used by the wider product.

TaskTape supports two inputs into that shared model. A person can record a screen or window and describe the intended result, or an external agent can reproduce a bug through TaskTape's MCP browser tools. Both paths produce a versioned computer Replay check with editable instructions and an expected outcome.

## Agent connection

The Electron main process starts an MCP Streamable HTTP server on `127.0.0.1:19790`. It uses the official TypeScript MCP SDK and the SDK's localhost host validation to protect against DNS rebinding. Requests with non-local browser origins are rejected. Automated Electron runs bind an ephemeral loopback port to avoid test collisions.

The MCP server and desktop renderer share the same browser evidence manager, workflow persistence, execution boundary, and run history. The renderer never hosts the server and receives only a narrow status object through preload IPC. Claude Code and Codex connection commands are shown in Settings, following Palmier's pattern of keeping setup beside the canonical local application state.

The first MCP capability intentionally targets local web applications. `start_bug_session` accepts only loopback HTTP or HTTPS URLs, launches a temporary headed Chromium context, starts Playwright tracing, and allows one active session. Release builds include the pinned Playwright browser runtime, while development can also use an explicitly configured or installed Chrome. Accessible role, label, text, or CSS selectors drive bounded click, fill, select, key, and wait operations. Password fields are refused.

Every operation stores an ordered action plus a screenshot. The session also records console messages, page errors, failed requests, HTTP error responses, initial and final screenshots, and a Playwright trace containing DOM snapshots and action timing. Finishing compiles the recorded actions into a review-required computer workflow and closes the temporary browser. Running or scheduling remains a separate explicit action.

Agent actions also persist their schema-validated replay command. TaskTape can compile those commands into a small Playwright TypeScript test using the exact observed selectors and inputs, without calling a model during later test runs. The export carries the expected outcome as review context and uses a visual assertion that requires the developer to approve a baseline. Older sessions remain readable but cannot be exported from their natural-language summaries.

The same session can produce a Markdown bug report with reproduction steps and diagnostic context. Reports are copied through the main process, exports use a native save dialog and `0600` file mode, and revealing evidence opens the existing local session directory. The renderer receives only evidence counts and availability flags.

## Capture source selection

TaskTape lists full displays and open application windows through Electron `desktopCapturer`, then renders a grouped thumbnail gallery in the sandboxed UI. A source ID selected by the user is validated against a freshly enumerated main-process source list. The display-media handler consumes that one pending selection and rejects requests without one; the renderer cannot nominate an arbitrary capture target.

## Analysis pipeline

The recorder saves a local video, then the sandboxed renderer uses native browser media decoding and a canvas to extract at most eight evenly spaced, downscaled JPEG frames. This avoids adding a GPL-licensed static `ffmpeg` distribution to the desktop package.

After recording, the user can type an intent or capture a bounded, microphone-only WebM/Opus voice note. The note is sent through the main process to `gpt-4o-mini-transcribe`; the editable transcript then becomes the primary intent input. TaskTape sends that transcript and only the selected video frames to the Responses API. Microphone permission is requested just in time and typing remains a complete fallback.

The default analysis model is [`gpt-5.6`](https://developers.openai.com/api/docs/models/gpt-5.6-sol), which supports image input and structured outputs through the Responses API. Direct video input is not assumed; the frame extraction boundary is intentional and testable.

## Workflow intermediate representation

Model output never executes directly. It must parse into a versioned Zod schema containing the goal, learned actions, optional schedule proposal, observed evidence, and a declared capability. The user can edit the goal, correct the natural-language description, choose the folder TaskTape may access, and review proposed timing before saving. The executor accepts only schema-valid recipes and known capability types.

The analysis schema separates general product understanding from execution. A task is classified as `organize_files`, with learned extension groups and child-folder destinations, or `computer`, with durable instructions and an optional target application. Both become the same version 3 saved-task lifecycle: review, save, run, schedule, pause or resume, and inspect history.

## Initial capability boundary

The deterministic filesystem adapter supports inspect, classify, create-directory, move, and copy inside one approved folder. The computer adapter uses the OpenAI Responses API computer tool and a native macOS CoreGraphics input harness for application and web tasks.

The file recipe scans regular files at the top level of one user-selected folder. It contains a dynamic list of model-inferred file groups, extension matchers, and child-folder destinations. This supports demonstrated structures such as footage, documents, archives, or project assets without hard-coded video and image fields. It creates only schema-valid child folders and either moves or copies with exclusive destination creation. Unmatched files and collisions stay unchanged. A persisted plan records file size and modification time; execution refuses an action if the source changed after review.

The computer agent activates the saved target application, requests actions from `gpt-5.6`, executes supported mouse and keyboard events through pinned `@nut-tree-fork/nut-js`, and returns a screenshot after each action batch. Running input inside TaskTape gives macOS a stable Accessibility identity. Coordinates, key names, drag paths, typed-text length, 60-second provider requests, and a 25-turn limit are bounded. On-screen text is treated as untrusted content. Any pending model safety check stops execution before its actions run.

## Outcome verification

Computer checks persist a plain-language expected outcome. After replay, TaskTape sends the final screenshot and that condition to a separate schema-bound visual evaluator. The evaluator returns `passed`, `failed`, or `inconclusive`, plus a short summary and evidence list. The run log stores that verdict and final screenshot so completion and history can explain what was observed instead of treating successful mouse clicks as proof that the product worked.

Execution and evaluation remain separate boundaries. A completed interaction can still produce a failed regression check. Missing or ambiguous visual evidence produces an inconclusive result rather than a fabricated pass.

Version 1 and version 2 file recipes are migrated on read into equivalent version 3 tasks. The source-folder permission boundary and deterministic executor remain unchanged during migration.

## Persistence

Recordings, agent evidence sessions, versioned workflow recipes, schedules, approved plans, and activity logs use filesystem-backed local metadata. Workflow and agent-session JSON files are written with mode `0600`. Browser traces and screenshots remain inside the local application-data directory. The history view reads immutable run logs across saved workflows. SQLite remains deferred until history search or larger run volumes require indexed, transactional state.

## Scheduling

Each task can persist one hourly, daily, weekday, or weekly schedule in local time as part of the save flow. A schedule stated in the transcript can prefill these controls, but it is not persisted until the user confirms unattended execution and saves. The main process checks for due schedules every 30 seconds, executes the saved capability, advances the next run time, and writes a normal activity log marked as scheduled. An overdue schedule is checked when the app launches.

The current scheduler runs only while TaskTape is open. Operating-system background launch and catch-up policy controls are intentionally deferred and are stated in the scheduling UI.

## Security

- API credentials remain in the main process and are never exposed back to the renderer. Keys entered in Settings are encrypted through Electron `safeStorage`, persisted with mode `0600`, and take precedence over the development-only environment fallback.
- The main process allows only trusted-renderer display capture and microphone requests. Electron 43 on macOS reports `getDisplayMedia` as a media request with no camera or microphone type, while microphone requests contain only `audio`; camera-bearing requests remain denied.
- Recordings and extracted frames are ignored by Git and local by default.
- The MCP server is loopback-only, validates host and origin boundaries, and limits browser sessions to local development URLs without embedded credentials.
- Manual actions require explicit review and approval. Scheduled actions require separate unattended-run consent. File tasks remain limited to the saved folder and collision-safe executor. Computer tasks stop on model safety checks. Rollback and safety-check resumption are not yet implemented.
- External links are opened through the operating system after the application denies new in-app windows.

## Testing strategy

- Vitest for schema and domain behavior.
- Integration tests for local persistence, media-frame boundaries, and capability adapters.
- Playwright's Electron support for packaged user journeys.
- Manual macOS verification for screen-recording and microphone permission behavior.
- Live OpenAI tests labeled separately from deterministic mocked tests.
- A real SDK MCP client for protocol discovery and tool invocation.
- A packaged-app MCP journey that captures the broken browser fixture and persists a visible Replay check.
