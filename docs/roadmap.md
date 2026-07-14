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
- Record, stop, cancel, and playback flow.
- Local recording metadata and cleanup.
- A test fixture recording path.

Exit gate:

- A packaged development build records and plays back a workflow on macOS, and cancellation leaves no orphaned recording.

## Milestone 2: Intent interview and analysis - Complete July 14

Scope decision: the hackathon build uses bounded visual frames plus the intent interview. Narration capture and audio transcription are deferred because the interview provides explicit, editable context without expanding the permission and processing surface before the deadline.

Deliverables:

- Bounded local frame extraction pipeline.
- Structured recording summary.
- Follow-up questions grounded in ambiguity from the demonstration.
- Explicit separation of inferred and confirmed intent.

Exit gate:

- The reference recording produces a schema-valid analysis and useful follow-up questions in both mocked and live-model test runs.

## Milestone 3: Workflow recipe and dry run - July 17

Deliverables:

- Versioned workflow intermediate representation.
- Editable recipe review UI.
- Capability and approval declarations.
- Deterministic filesystem dry-run engine.

Exit gate:

- The reference recipe previews exact renames and moves without changing the fixture, including collision and unsupported-file cases.

## Milestone 4: Execution, scheduling, and logs - July 18

Deliverables:

- Approved execution with bounded filesystem permissions.
- Scheduler for saved workflows.
- Run history, step results, and actionable failures.
- Idempotency and rollback strategy for the reference workflow.

Exit gate:

- Immediate and scheduled runs both transform disposable fixtures correctly, and reruns do not corrupt prior results.

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
