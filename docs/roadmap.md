# Milestone roadmap

The submission deadline is July 21, 2026 at 5:00 PM Pacific Time. The internal target is July 20 so the final day remains a submission buffer.

## Milestone 0: Foundation and architecture - Complete July 14

Deliverables:

- Product name and public GitHub repository.
- Durable engineering, privacy, and verification rules.
- Architecture decision and dependency audit.
- Reproducible development setup.
- Initial CI checks.

Exit gate:

- A fresh checkout can install dependencies and run all foundation checks from documented commands.

## Milestone 1: Desktop shell and recorder - Complete July 14

Deliverables:

- Desktop application shell with clear permission states.
- Grouped full-display and application-window source gallery.
- Record, stop, cancel, and playback flow.
- Local recording metadata and cleanup.
- A test fixture recording path.

Exit gate:

- A packaged development build records and plays back a workflow on macOS, and cancellation leaves no orphaned recording.

## Milestone 2: Dictated intent and analysis - Complete July 17

Deliverables:

- Bounded local frame extraction pipeline.
- Microphone-only voice note capture with typed fallback.
- Live transcription through `gpt-4o-mini-transcribe`.
- Structured learned-workflow proposal and optional schedule grounded in the transcript and frames.
- Editable goal, natural-language correction path, and inferred actions before anything is saved.

Exit gate:

- The reference recording and transcript produce a schema-valid recipe in deterministic and live-model tests, and a real WAV reaches the production transcription provider.

## Milestone 2.5: User-managed credentials - Complete July 14

Deliverables:

- In-app API-key status, save, replace, and clear controls.
- Operating-system-backed encryption with no plaintext read-back path.
- Main-process credential resolution with app-key precedence and a development environment fallback.

Exit gate:

- A real Electron test saves an app key, proves the persisted file excludes its plaintext, resolves app-key status, and removes it successfully.

## Milestone 3: Workflow recipe and change review - Complete July 15

Deliverables:

- Versioned workflow intermediate representation.
- Editable recipe review UI.
- Capability and approval declarations.
- Deterministic filesystem dry-run engine.

Exit gate:

- The reference recipe previews exact renames and moves without changing the fixture, including collision and unsupported-file cases.

Verified result:

- The editable recipe persists locally and previews exact top-level moves or copies from dynamic learned file groups. Version 1 recipes migrate safely. Automated filesystem tests cover unmatched files, collisions, path traversal, changed sources, and late destination collisions.

## Milestone 4A: Immediate execution and logs - Complete July 15

Deliverables:

- Explicit approval of a persisted change plan.
- Real move and copy execution with exclusive destination creation.
- Durable local activity log with per-file outcomes.
- Honest completed, partial, and failed result states.

Exit gate:

- The Electron journey moves disposable footage, visual assets, and project packages into inferred folders, leaves unmatched files unchanged, and verifies the persisted activity log.

## Milestone 4B: Scheduling and history - Complete July 17

Deliverables:

- Scheduler for saved workflows.
- Run history with manual and scheduled results.
- Collision-safe reruns for the reference workflow.

Exit gate:

- Scheduled runs transform disposable fixtures correctly, and reruns do not corrupt prior results.

Verified result:

- Daily and weekly schedules persist locally and resume checking when TaskTape opens.
- Scheduling is reviewed and saved with the workflow; spoken timing prefills the controls.
- A packaged Electron test forces a schedule due, moves a new asset fixture, and shows separate manual and scheduled history entries.
- Fresh plans, exclusive destination creation, and collision skipping protect reruns from overwriting prior results.

Schedule pause or removal controls, rollback, and history search remain post-hackathon enhancements.

## Milestone 5: Product polish and submission - July 19-20

Deliverables:

- Complete onboarding and empty/error states.
- Automated and manual regression pass.
- Signed or clearly documented local build.
- Public README, architecture notes, demo script, and sub-three-minute video.
- Codex session feedback and submission materials.

Exit gate:

- A clean-machine rehearsal follows the README, the demo succeeds twice consecutively, and every submission requirement is present.

## Buffer: July 21

Only submission fixes, reliability fixes, and final upload verification. No new product scope.
