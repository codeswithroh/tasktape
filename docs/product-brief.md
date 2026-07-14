# Product brief

## Problem

People repeat small computer workflows every day, but conventional automation tools ask them to describe those workflows as triggers, selectors, APIs, or scripts. Screen-recording tools capture what happened but stop at documentation. General-purpose computer-use agents can act, but often hide the plan and make repeated execution difficult to inspect or trust.

## Product thesis

A demonstration contains useful procedural evidence, but it does not fully reveal intent. TaskTape combines a native recording with a short post-recording interview so the system can distinguish constants from variables, meaningful steps from incidental clicks, and safe defaults from actions that need approval.

The output is not an opaque agent session. It is a versioned, editable workflow recipe with explicit inputs, capabilities, approvals, and expected outcomes.

## Target user

The first user is an individual knowledge worker, creator, operator, or freelancer who repeats multi-step work across local files and browser tools but does not want to maintain scripts or enterprise RPA infrastructure.

## Core differentiators

- Demonstration plus intent interview, instead of demonstration alone.
- Editable workflow recipes, instead of black-box replay.
- Dry runs, scoped capabilities, approvals, and logs for repeated execution.
- Local-first capture and storage, with selective model uploads.
- Consumer-grade setup and language rather than enterprise process tooling.

## Hackathon proof

The Build Week version will prove the complete product loop using a deterministic local-file workflow: a user records a messy-folder cleanup, explains naming and grouping intent, reviews the generated recipe, previews the proposed changes, and executes or schedules the approved workflow.

This workflow is a test fixture, not the product boundary. The recipe model and product interaction are designed to support additional capability adapters later.

## Non-goals for the hackathon

- Universal control of arbitrary desktop applications.
- Pixel-coordinate macro replay as the primary execution method.
- Team administration, billing, or enterprise deployment.
- A public workflow marketplace.
- Silent destructive actions.

## Success criteria

- A new user can record, explain, generate, review, dry-run, and execute the reference workflow without editing code.
- The generated recipe separates inferred values from user-confirmed values.
- The dry run accurately previews filesystem changes without mutating the fixture.
- The approved run produces the expected result and an auditable log.
- Failure and ambiguity are visible to the user rather than silently ignored.
