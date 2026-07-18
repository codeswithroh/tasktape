# Agent-operated replay milestone

## Product promise

TaskTape is a debugging instrument that records itself while an agent reproduces a bug. Claude Code, Codex, or another MCP client can operate a headed browser through TaskTape, collect synchronized evidence, and turn the completed reproduction into a saved Replay check.

The first release proves this deeply for browser bugs. General desktop observation remains a later capability.

## Palmier reference

Palmier demonstrates the interaction model TaskTape will follow:

- The desktop application owns the canonical project state.
- A local MCP server exposes native project operations to external agents.
- The server binds only to the loopback interface.
- The same tools and state power both the application and external clients.
- The application shows direct setup instructions for Claude Code and Codex.

TaskTape independently implements these ideas for debugging under its MIT license. Palmier's GPL implementation is an architectural reference only.

## MCP boundary

The embedded server listens on `127.0.0.1` and rejects non-local browser origins. It exposes compact debugging operations instead of unrestricted shell or filesystem access.

Initial tools:

- `start_bug_session`: launch a headed instrumented browser at an HTTP or HTTPS URL and begin trace capture.
- `observe_page`: return the current URL, title, concise accessibility snapshot, and screenshot.
- `click`: click an element selected by accessible role and name, label, text, or CSS.
- `fill`: fill a labeled or CSS-selected input.
- `select_option`: choose an option in a labeled or CSS-selected select.
- `press_key`: send one validated key chord.
- `wait_for`: wait for visible text or a bounded duration.
- `add_note`: attach agent reasoning or issue context without executing it.
- `finish_bug_session`: stop capture, persist evidence, and compile the actions into a saved computer Replay check.
- `run_check`: run a saved check through TaskTape's existing computer-use and visual-verification pipeline.
- `get_run_result`: retrieve a persisted verdict and evidence.
- `list_checks`: list saved computer Replay checks.

## Evidence bundle

Each session remains local and contains:

- Session metadata and expected outcome.
- Ordered agent actions and notes.
- Initial and final screenshots.
- Playwright trace with DOM snapshots, screenshots, sources, and action timing.
- Console messages.
- Failed requests and HTTP error responses.
- Compiled replay instructions and saved workflow identifier.

The model receives compact summaries and resource links. Large recordings and traces are not inserted into the conversation.

## Safety

- Only one active browser session is allowed.
- URLs must use HTTP or HTTPS, cannot contain credentials, and are limited to loopback development servers for this milestone.
- The browser profile is temporary and isolated.
- Tool arguments are schema-validated and text lengths are bounded.
- Browser actions are limited to the TaskTape-created page.
- Finishing a session saves a check but does not run or schedule it.
- Running a saved check remains an explicit separate tool call.
- The server shuts down with TaskTape and is never exposed to the LAN.

## Exit gate

The milestone is complete only when all of the following pass:

1. Unit tests cover schemas, URL restrictions, selectors, action compilation, persistence, and cleanup.
2. An MCP client discovers the server and its tools through the protocol.
3. An end-to-end MCP journey launches the disposable broken browser target, observes it, clicks Save asset, records the Uncategorized result, and finishes the session.
4. The evidence directory contains valid metadata, initial and final screenshots, a non-empty Playwright trace, and the captured console or network records.
5. The compiled workflow persists the expected outcome and replay instructions and appears in TaskTape.
6. Existing unit, Electron, live Replay, and packaging gates remain green, with paid live tests run only once after deterministic checks pass.
