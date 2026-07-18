# Product brief

## Problem

Developers lose time translating bug reports into reliable reproductions. Screen recordings show symptoms but omit console, network, DOM, environment, and expected-outcome context. Coding agents can investigate, but their successful reproduction often disappears inside one conversation instead of becoming a durable regression check.

## Product thesis

A bug reproduction should become a reusable engineering asset. TaskTape lets a person demonstrate a failure or lets Claude Code or Codex reproduce it through an instrumented local browser. It combines the actions, synchronized evidence, and expected outcome into one reviewable Replay check.

The output is not an opaque agent session. It is a versioned, editable workflow recipe with explicit inputs, capabilities, approvals, and expected outcomes.

## Target user

The first user is a developer or small product team using coding agents to investigate bugs in local web applications. They want richer debugging context and persistent checks without writing a brittle end-to-end test before they understand the failure.

## Core differentiators

- Human demonstration and agent-operated reproduction feed the same check model.
- Video, screenshots, DOM snapshots, console events, network failures, and actions stay synchronized.
- A local MCP server works with Claude Code, Codex, and other compatible clients.
- Replay execution is separate from capture, with editable instructions and an explicit expected outcome.
- Passed, failed, and inconclusive runs preserve visual evidence and history.
- Capture and evidence remain local by default.

## Hackathon proof

The Build Week version proves one browser regression loop against a disposable creator-asset application. A connected agent launches the local target through TaskTape, reproduces the category-loss bug, records the resulting evidence, and compiles a check. The same check fails against the broken state and passes against the fixed state through OpenAI computer use and visual outcome verification.

Human screen recording, voice intent, schedules, file workflows, and run history remain in the product, but the submission story centers on the agent-operated browser reproduction.

## Non-goals for the hackathon

- Universal instrumentation of arbitrary desktop applications.
- Remote production or staging browser sessions.
- Unattended issue ingestion and automatic code modification.
- Bundled CI workers or pull-request status checks.
- Team administration, billing, or enterprise deployment.
- A public workflow marketplace.
- Silent destructive actions.

## Success criteria

- Claude Code, Codex, or a protocol test client can discover TaskTape's MCP tools.
- An agent can reproduce the local reference bug while TaskTape stores a non-empty trace, screenshots, console and network context, and ordered actions.
- Finishing capture creates a visible review-required Replay check without executing it.
- The same check records a failed verdict for the broken target and a passed verdict for the fixed target.
- The desktop app and external agent see the same active session, saved check, and run evidence.
