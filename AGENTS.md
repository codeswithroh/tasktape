# TaskTape Engineering Rules

These rules apply to all work in this repository.

## Development discipline

- Work milestone by milestone. Do not start the next milestone until the current milestone's acceptance checks have passed or its limitations are documented.
- Keep commits small, coherent, and meaningful. Push completed milestones and important intermediate checkpoints to GitHub.
- Never claim a feature works without recording how it was verified.
- Mark incomplete, unstable, mocked, or untested behavior plainly in code, documentation, and status updates.
- Preserve a runnable main branch. Experimental work belongs on a feature branch when it could destabilize the verified path.

## Dependency policy

- Install and use the proper SDK or tool when the architecture requires it. Do not replace missing capabilities with fragile workarounds.
- Pin direct dependencies and commit the lockfile.
- Document system prerequisites and setup commands in the README.
- Before adding a dependency, confirm that it is maintained, license-compatible, and materially reduces implementation risk.

## Verification policy

- Unit-test deterministic domain logic and workflow validation.
- Integration-test filesystem, persistence, model-boundary, and executor behavior.
- Exercise the desktop user journey end to end before calling a milestone complete.
- Visually inspect important application states and check for console/runtime errors.
- Treat live-model tests separately from mocked tests and label both accurately.
- Record verification evidence in `docs/verification.md` as the project evolves.

## Safety and privacy

- Default to local storage for recordings and workflow data.
- Never commit secrets, recordings, personal files, or generated user data.
- Require explicit review before generated workflows can perform destructive or externally visible actions.
- Provide a dry run and a clear activity log for executable workflows.

## Product scope

TaskTape is a general-purpose desktop product. Users record a workflow, explain their intent through follow-up questions, review an editable automation recipe, and then run or schedule it with safeguards.

The hackathon build must prove one complete workflow deeply. It must not pretend to automate every desktop application.
