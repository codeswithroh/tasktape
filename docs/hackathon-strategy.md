# OpenAI Build Week strategy

Research snapshot: 2026-07-18 08:14 IST

## Strategic verdict

**Decision: PIVOT the hackathon story, not the underlying engine.**

Do not submit TaskTape as a general desktop automation builder. Microsoft Power Automate already offers an AI recorder that captures screen, narration, mouse, keyboard, and UI metadata, then creates an editable desktop flow. Claude Cowork and ChatGPT Work already perform and schedule broad computer work. In that frame, TaskTape looks polished but derivative.

Submit TaskTape in **Developer Tools** as:

> Turn a narrated bug reproduction into a living regression check.

The strongest existing primitive is not file organization. It is the verified loop that records a desktop task, combines visual evidence with spoken intent, produces a bounded recipe, replays the task through GPT-5.6 computer use, schedules reruns, and preserves run evidence.

The hackathon version should narrow that primitive to one painful event: a product team receives a screen recording of a bug, fixes it, but the behavior returns because the recording never became a test.

**Confidence: 82/100.** The technical foundation and product experience are unusually complete. The unresolved risk is that the current runner reports task completion but does not yet evaluate an explicit expected outcome as pass or fail.

## July 18 implementation update

The outcome-verification risk above is resolved, and the submission interaction is stronger than the original recommendation. TaskTape now exposes a loopback-only MCP server so Claude Code or Codex can operate an instrumented local browser, reproduce the bug, and create the regression check directly. The agent capture includes ordered actions, screenshots, DOM snapshots, console events, network failures, and a Playwright trace.

This follows Palmier's proven product pattern: the desktop application owns canonical local state while external agents operate native product tools through MCP. TaskTape applies that interaction to debugging rather than video editing. The packaged reference path has been verified through a real MCP client and should become the opening demo, while human narration remains the second input path.

Current verified baseline: 61 unit and integration tests, 10 Electron journeys, a packaged MCP capture, 10 consecutive live visual evaluations, and one paired live computer replay against broken and fixed targets.

## Hackathon intelligence brief

### Confirmed facts

| Area                | Confirmed fact                                                                 | Winning implication                                                                | Risk                                                                                   |
| ------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Organizer           | OpenAI, administered by Devpost                                                | Codex and GPT-5.6 must be central and inspectable                                  | A generic OpenAI API call fails the viability screen                                   |
| Build period        | July 13 to July 21, 2026 at 5:00 PM PDT                                        | Existing work is eligible only when meaningful Build Week additions are documented | Separate earlier work from Build Week commits                                          |
| Local deadline      | July 22, 2026 at 5:30 AM IST                                                   | Submit a complete draft by July 20 IST                                             | Last-minute uploads are an avoidable disqualification risk                             |
| Tracks              | Apps for Your Life, Work and Productivity, Developer Tools, Education          | TaskTape Replay belongs in Developer Tools                                         | A project can enter only one category                                                  |
| Required technology | Codex and GPT-5.6                                                              | Show GPT-5.6 analysis, computer use, and outcome evaluation                        | The current transcription model is supporting infrastructure, not the main integration |
| Stage one           | Pass or fail on theme fit and reasonable use of required APIs or SDKs          | Name the exact GPT-5.6 calls and show them working                                 | Ambiguous model use can eliminate the project before scoring                           |
| Stage two           | Four equally weighted criteria                                                 | Optimize evenly, not just for technical depth                                      | Novelty remains the weakest current score                                              |
| Tie break           | Technological Implementation is considered first                               | Tests, commit history, architecture, and live proof matter heavily                 | Claims without inspectable evidence will hurt                                          |
| Demo                | Public YouTube video under 3 minutes, with audio                               | Build the submission around one complete before-and-after loop                     | Judges need not watch after 3:00                                                       |
| Demo content        | Explain what was built and how Codex and GPT-5.6 were used                     | Codex collaboration belongs in the narrative, not only the README                  | A pure product demo is non-compliant                                                   |
| Repository          | Public with relevant licensing, or shared privately with two judging addresses | The current public MIT repository is ready                                         | Judge setup must not require rebuilding from scratch                                   |
| Testing access      | Free working app, demo, or test build through judging                          | Provide an arm64 build and a disposable local test page                            | Unsigned macOS permissions create friction                                             |
| Session proof       | Provide `/feedback` Codex Session ID for the core build thread                 | Capture this before the final day                                                  | Missing ID is a submission defect                                                      |
| IP                  | Entrant retains IP; all submitted work must be owned or properly licensed      | Current MIT project and pinned dependencies are compatible                         | Demo media must avoid unlicensed trademarks and music                                  |
| Prizes              | $15,000 first and $10,000 second in each category                              | There is no sponsor-track stacking strategy                                        | Each project is eligible for one prize                                                 |

### Judging map

| Criterion                    | Weight | TaskTape today | Required proof for the pivot                                                                           |
| ---------------------------- | -----: | -------------: | ------------------------------------------------------------------------------------------------------ |
| Technological Implementation |    25% |           9/10 | Narrated frames to schema, GPT-5.6 computer replay, explicit outcome assertion, action evidence, tests |
| Design                       |    25% |         8.5/10 | One coherent record, review, run, pass or fail journey in the packaged app                             |
| Potential Impact             |    25% |         6.5/10 | A specific developer losing time to recurring bugs, not broad productivity claims                      |
| Quality of Idea              |    25% |         5.5/10 | Reframe from automation recorder to bug-recording-to-regression-check                                  |

### Unknown or inferred

- **Unknown:** named judges. The rules allow judges to remain unlisted or change.
- **Unknown:** exact number of submissions per category. The gallery is not published.
- **Inferred:** Developer Tools will be crowded with code review, test generation, and agent orchestration products.
- **Inferred:** record-to-automation will be especially weak because it overlaps directly with newly launched OpenAI and established Microsoft capabilities.
- **Confirmed absent:** sponsor-specific prize tracks. OpenAI is the only sponsor named in the current rules.
- **Unknown:** post-hackathon grant program. No official grant or accelerator commitment is published.

## Sponsor intelligence

GPT-5.6 is the event's technical center. OpenAI positions it around coding, design, professional work, stronger computer use, and end-to-end tool use. The API supports structured outputs, function calling, computer use, MCP, hosted shell, and skills.

TaskTape should visibly use three capabilities:

1. **Multimodal structured analysis:** narrated intent plus selected recording frames become a typed test recipe and expected outcome.
2. **Computer use:** GPT-5.6 performs the learned workflow on a real desktop or browser.
3. **Visual outcome evaluation:** GPT-5.6 compares the final state with the expected outcome and returns a schema-bound pass, fail, and evidence explanation.

Removing GPT-5.6 should remove the product's ability to understand an unstructured demonstration, adapt replay to the current interface, and evaluate a visual outcome. That is a substantive dependency rather than branding.

## Competitive audit

| Product                            | Strength                                                        | Missing relative to proposed demo                                                                                          |
| ---------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Power Automate Record with Copilot | Near-exact screen, voice, input metadata to editable automation | Windows and Power Automate centered; the output is an automation, not a bug-specific evidence-producing regression check   |
| ChatGPT Work                       | Broad desktop and connected-app action with scheduled tasks     | Prompt-first delegation; no demonstrated workflow-to-regression artifact in the published product story                    |
| Claude Cowork                      | Broad connected work and remote scheduled execution             | Prompt-first tasks; local-folder scheduled work has platform constraints; no bug replay artifact                           |
| UiPath Task Mining                 | Mature trace capture and export to automation assets            | Enterprise-heavy discovery workflow; slower setup and weak three-minute personal demo                                      |
| Momentic                           | Natural-language agent tests with caching and self-healing      | Users author tests as steps; a narrated cross-app bug recording is not the primary input                                   |
| BugBug                             | Recorder, scheduled tests, screenshots, alerts                  | Browser-only recorder and conventional test model; limited cross-app story                                                 |
| QA Wolf                            | Deep managed web, mobile, and Electron test lifecycle           | Expensive and team-scale; not a lightweight local capture-to-check loop                                                    |
| Jam                                | Excellent bug recording context, logs, and reproduction steps   | The recording becomes a ticket or context, not an executable recurring regression check                                    |
| SkillForge                         | Recording or live capture to SOP and AI skill                   | Very close to the original TaskTape story; public claims exceed what TaskTape should compete against during this hackathon |

### Genuine gap

The market gap is not “record a workflow and automate it.” That category exists.

The narrower gap is:

> A non-QA teammate records a bug exactly as they experienced it, states what should happen, and receives a local, replayable regression check with visible pass or fail evidence without writing selectors or test code.

This is still competitive. Momentic, BugBug, QA Wolf, and Jam cover adjacent pieces. The differentiation must be demonstrated through cross-app visual replay, narration-derived expected outcomes, and inspectable local evidence. It cannot rest on marketing language.

## Builder advantage audit

### Unfair advantages

- A working macOS Electron recorder with full-display and window selection.
- GPT-5.6 structured visual analysis already verified live.
- A native GPT-5.6 computer-use action loop already verified against a real disposable browser task.
- Persisted recipes, manual runs, recurring schedules, and run history.
- Strong process isolation, encrypted API-key storage, validation, and safety boundaries.
- A public Build Week commit history with green CI and meaningful incremental commits.
- Current local verification: 49 unit and integration tests plus 8 Electron journeys pass.

### Dangerous weaknesses

- No explicit assertion or pass or fail oracle exists yet.
- The recording pipeline samples up to eight frames and does not capture a full timestamped mouse and keyboard trace.
- The packaged app is unsigned, so macOS permissions create judge friction.
- Voice permission in a fresh packaged bundle is only partially verified.
- Scheduled runs require the app to remain open and the Mac awake.
- No external user validation is recorded.
- “Learns from video” can be challenged because narration currently carries much of the procedural meaning.

### Territory to avoid

- Universal desktop automation.
- Cloud scheduling or remote Mac execution before the deadline.
- A workflow marketplace.
- Enterprise process mining.
- Claims of deterministic reliability across arbitrary applications.
- New authentication, collaboration, billing, or team administration.

## Existing project score

| Dimension            | Current | Pivoted | Reason                                                            |
| -------------------- | ------: | ------: | ----------------------------------------------------------------- |
| Problem clarity      |       6 |       9 | Recurring bug is more concrete than repetitive work               |
| User specificity     |       5 |       8 | Product engineer or support engineer replacing a Loom-only report |
| Urgency              |       6 |       8 | Regressions block releases and consume engineering time           |
| GPT-5.6 depth        |       8 |       9 | Adds visual outcome evaluation to analysis and computer use       |
| Originality          |       5 |       8 | Avoids direct Power Automate and Cowork comparison                |
| Technical depth      |       9 |       9 | Preserves the same verified native engine                         |
| Demo clarity         |       7 |       9 | Bug shown, replayed, and visibly passed or failed                 |
| Visual payoff        |       7 |       9 | Final screenshot plus pass or fail evidence                       |
| Feasibility          |       9 |       8 | One assertion layer and one purpose-built demo remain             |
| Reliability          |       8 |       8 | Existing execution is bounded, but visual assertions need testing |
| Submission readiness |       6 |       8 | Story, demo, build artifact, and session proof remain             |
| Grant potential      |       5 |       7 | Could become an open computer-use evaluation capture format       |

Classification: **REFRAME and rebuild the demo.** Keep the engine, remove file organization from the judged path, and add a test oracle.

## Candidate field

Scores use the four official criteria equally. Feasibility is reflected inside implementation and design. Scores are deliberately not compressed.

| Rank | Direction                                          | Tech | Design | Impact | Idea | Total | Decision                           |
| ---: | -------------------------------------------------- | ---: | -----: | -----: | ---: | ----: | ---------------------------------- |
|    1 | Bug recording to living regression check           |    9 |      9 |      8 |    8 |    85 | Build                              |
|    2 | Human-demo generator for computer-use agent evals  |    9 |      7 |      7 |    9 |    80 | Grant-oriented fallback            |
|    3 | Demonstrated safety policy for computer-use agents |    9 |      7 |      8 |    8 |    80 | High upside, higher risk           |
|    4 | Support recording to reproducible issue runner     |    8 |      8 |      8 |    7 |    78 | Strong alternate framing           |
|    5 | Accessibility routine replay for cognitive load    |    8 |      8 |      9 |    6 |    78 | Needs user validation              |
|    6 | Local compliance procedure verifier                |    8 |      7 |      8 |    7 |    75 | Too much domain proof required     |
|    7 | Cross-app onboarding certification from a demo     |    8 |      8 |      7 |    7 |    75 | Outcome is less urgent             |
|    8 | Creator asset intake automation                    |    9 |      8 |      6 |    5 |    70 | Safe demo, weak novelty            |
|    9 | Narrated desktop workflow to executable skill      |    9 |      8 |      7 |    4 |    70 | Directly crowded                   |
|   10 | Personal recurring desktop task agent              |    9 |      8 |      6 |    4 |    68 | ChatGPT Work and Cowork clone risk |
|   11 | Screen recording to SOP and training guide         |    7 |      8 |      6 |    3 |    60 | Commodity category                 |
|   12 | General no-code automation platform                |    7 |      5 |      6 |    3 |    53 | Reject for scope and duplication   |

### Top three

**Safest finalist:** Bug recording to living regression check. It needs the smallest real extension and has the clearest before-and-after proof.

**Highest upside:** Demonstrated safety policy for computer-use agents. A visible blocked deviation would be memorable, but reliably provoking and classifying a policy violation before the deadline is risky.

**Best continuation:** Human-demo generator for computer-use agent evals. It could become useful open-source infrastructure, but the judge needs more explanation before the value lands.

## Winning concept

### Name

TaskTape Replay

### Tagline

Turn a bug recording into a living regression check.

### Fifteen-second pitch

When a product engineer receives a screen recording of a bug, TaskTape Replay uses GPT-5.6 to understand the demonstrated steps and expected outcome, replay the flow on the real interface, and return a scheduled pass or fail result with visual evidence.

### Core loop

**Reproduce -> capture context -> compile -> replay -> verify**

### Why now

Screen recordings are a common bug-report artifact, while computer-use models can now operate real interfaces and reason about visual outcomes. GPT-5.6 specifically improves computer use and design understanding, making the recording useful as executable evidence rather than passive documentation.

## Headline demo

Use a disposable local web app with a seeded regression. Do not demo Downloads organization.

| Time      | Demonstration                                                                                                                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00-0:15 | Show the bug: submitting a creator asset form loses the selected category. Say, “A video shows the symptom, but the engineer still has to reproduce everything.”                                                            |
| 0:15-0:35 | Open TaskTape Settings and show the Codex MCP connection. Ask Codex: “Reproduce this local category bug and turn it into a Replay check. The saved item must retain Video.”                                                 |
| 0:35-1:10 | Codex starts a TaskTape bug session and clicks Save. Show the live session in TaskTape, then the captured `Uncategorized` state. Briefly reveal the trace evidence: actions, screenshot, DOM, console, and network context. |
| 1:10-1:35 | Codex finishes the session. The check appears immediately in TaskTape with editable expected outcome and explicit run control.                                                                                              |
| 1:35-2:10 | Run the check against the broken version. GPT-5.6 computer use replays it and returns **Failed**, with final screenshot and mismatch evidence.                                                                              |
| 2:10-2:35 | Switch the disposable app to the fixed state and run again. The same expected outcome returns **Passed**. Show both runs in history.                                                                                        |
| 2:35-3:00 | Show scheduling, then the public repo, 61 tests, 10 desktop journeys, packaged MCP proof, and the Codex commit trail. Close with the one sentence below.                                                                    |

One sentence to remember:

> The agent's bug reproduction is no longer context that disappears. It is the regression check.

The 10-second clip: the same learned check changes from red **Failed** to green **Passed**, with two final-state screenshots.

Proof: the local app's persisted run record, final screenshot, explicit assertion result, and deterministic DOM state in the disposable target app.

Fallback: record the entire final demo twice and use the cleaner take. Keep a prerecorded successful agent replay available only as video fallback, never as a claim that the live state ran when it did not.

## Minimal architecture change

| Capability                                   | Product role                                      | Visible proof                          | Location                                 |
| -------------------------------------------- | ------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| MCP and Playwright instrumentation           | Let Codex reproduce and capture the bug           | Live session, trace, and created check | `src/main/agent-mcp.ts`                  |
| GPT-5.6 computer use                         | Replay the saved workflow against the current UI  | Live cursor actions and action log     | `src/main/computer-agent.ts`             |
| GPT-5.6 image understanding and typed output | Evaluate the final screen against the expectation | Pass or fail with screenshot evidence  | `src/main/outcome-evaluator.ts`          |
| GPT-5.6 multimodal structured analysis       | Support the human-recorded alternative path       | Editable recipe and expected result    | `src/main/analysis.ts` and shared schema |

### Must be real

- GPT-5.6 analysis request.
- GPT-5.6 computer-use replay.
- Final screenshot assertion.
- Persisted pass or fail run.
- One scheduled check lifecycle.

### Can be controlled

- The target is a disposable local app with a deterministic broken and fixed mode.
- Test data can be seeded.
- Email and Slack alerts are omitted.

### Remove under time pressure

- Voice in the packaged judge path. Keep typed intent as a complete fallback.
- Weekly scheduling from the video. Show one daily schedule only.
- Any second target application.
- File-organization capability from the demo and Devpost screenshots.

## Build and freeze plan

### July 18

1. Add `expectedOutcome` and an assertion result schema.
2. Add a disposable broken and fixed local target.
3. Run one live GPT-5.6 replay and final-state evaluation.
4. Stop condition: if the outcome evaluator cannot distinguish broken from fixed in five consecutive runs, keep the current app and submit the safer general workflow demo.

### July 19

1. Persist pass, fail, evidence, and final screenshot in run history.
2. Build the one-page completion state.
3. Add deterministic provider tests and two Electron journeys.
4. Perform five broken and five fixed runs.

### July 20

1. **Feature freeze at 12:00 IST.**
2. Complete README opening, Build Week change log, architecture diagram, and testing instructions.
3. Produce unsigned arm64 DMG and ZIP with explicit macOS permission steps.
4. Record the demo twice before 20:00 IST.
5. Create and submit a Devpost draft with repository, video placeholder, category, and team details.

### July 21

Only fix submission defects and critical demo failures. Upload the final public YouTube video and verify every link from a logged-out browser. Submit no later than July 21 at 20:00 IST, leaving more than nine hours of buffer.

## README opening

```markdown
# TaskTape Replay

**Turn a bug recording into a living regression check.**

TaskTape Replay is a macOS desktop tool for product and support teams. Record a bug, say what should have happened, and GPT-5.6 turns that evidence into a reviewable check. It replays the workflow on the real interface, evaluates the final state, and saves a visual pass or fail result that can run again on a schedule.

Built for OpenAI Build Week with Codex and GPT-5.6.

- Demo: [YouTube link]
- Category: Developer Tools
- Test build: [release link]
- Verification: `docs/verification.md`
```

The README must then show: what changed during Build Week, exact GPT-5.6 integration, architecture, what is real, setup, judge test path, tests, permissions, limitations, security, Codex collaboration, and `/feedback` session evidence.

## Submission package

**Title:** TaskTape Replay

**Short description:** Record a bug once. GPT-5.6 turns it into a replayable, scheduled regression check with visual pass or fail evidence.

**Category:** Developer Tools

**Do not enter:** Work and Productivity. The broader automation framing creates a direct comparison with Power Automate, ChatGPT Work, and Claude Cowork.

**Thumbnail:** Split evidence view with the original bug frame on the left, the replay result on the right, and a large red Failed changing to green Passed. No architecture diagram in the thumbnail.

**Required screenshots:** recorder, learned assertion review, failed run evidence, passed run evidence, run history, and scheduled check.

**Technology list:** Electron, TypeScript, React, Vite, OpenAI Responses API, GPT-5.6 structured outputs, GPT-5.6 computer use, Zod, nut.js, Vitest, Playwright.

**Honest limitations:** macOS-first, unsigned build, app must remain open for schedules, one target workflow demonstrated, sampled frames instead of complete video upload, and visual assertions are bounded rather than a guarantee across arbitrary software.

## Pitch scripts

### 15 seconds

“Ask Codex to reproduce a bug through TaskTape. It captures the actions, screen, DOM, console, and network context, then GPT-5.6 replays that reproduction as a permanent visual regression check.”

### 30 seconds

“A bug video still leaves an engineer to reproduce the failure, inspect the console and network, and write a test. TaskTape gives Codex and Claude an instrumented browser through MCP. The agent reproduces the issue once, TaskTape saves the complete evidence and creates a reviewable check, then GPT-5.6 replays it and reports a visual pass or fail result.”

### 90 seconds

“This form loses the selected category after Save. I ask Codex to reproduce it through TaskTape's local MCP server. TaskTape launches an instrumented browser, and while Codex investigates it records every action with screenshots, DOM snapshots, console messages, and network failures. When Codex finishes, that reproduction appears in TaskTape as a reviewable check with one explicit expected result. GPT-5.6 computer use performs the saved task against the real app. On the broken build, visual evaluation fails and stores the final screenshot. On the fixed build, the same expected result passes. The check can run again on a schedule, and every result stays in local history. The repository has 61 unit and integration tests, 10 Electron journeys, packaged MCP proof, and separately verified live GPT-5.6 replay and evaluation gates. TaskTape turns an agent's temporary debugging context into a check that keeps protecting the product.”

## Hard judge questions

1. **Is this just Power Automate?** No. Power Automate generates a workflow. This demo generates an expected outcome, replays the bug, and produces pass or fail evidence.
2. **Is this just BugBug or Momentic?** They are strong browser-test products. TaskTape lets the developer's existing coding agent reproduce the issue through MCP, captures the investigation context, and then uses GPT-5.6 for adaptive visual replay and judgment.
3. **Is video still required?** No. A person can record and narrate the bug, or an external agent can create a richer browser evidence session. Both produce the same check model.
4. **Why is GPT-5.6 necessary?** It performs multimodal interpretation, adaptive computer replay, and visual outcome evaluation.
5. **Could a smaller model do it?** Possibly for simpler pieces, but the submitted path uses GPT-5.6 because computer use and visual judgment are central.
6. **What is deterministic?** Schemas, persistence, scheduling, filesystem boundaries, action validation, and the target app state.
7. **What is probabilistic?** Workflow inference, computer actions, and visual assertion wording.
8. **How do you prevent destructive actions?** Typed capability schemas, user review, bounded actions, turn limits, target app activation, pending safety-check stopping, and separate unattended-run consent.
9. **Can it test any application?** No. The hackathon proves one complete browser workflow and a bounded macOS execution path.
10. **What happens when the UI changes?** GPT-5.6 reasons over the current screen instead of replaying fixed coordinates, but major changes can still fail and are reported.
11. **Does it capture passwords?** Agent sessions reject password-field fills, accept only local development URLs, and remain local. API keys use operating-system encryption. Human recordings still require the user to avoid exposing secrets.
12. **Why not generate Playwright?** TaskTape already uses Playwright for rich capture, but GPT-5.6 replay adapts to the current visual interface and can later extend beyond DOM-only targets. Exportable Playwright tests are future work.
13. **Does scheduling run while the Mac sleeps?** No. The app must be open and the Mac awake.
14. **What happens on a model safety check?** The run stops before the flagged action executes.
15. **What did Codex build?** The repo documents the iterative native recorder, schemas, execution adapters, scheduler, tests, and design revisions in dated commits.
16. **What existed before Build Week?** Nothing in this repository. The first planning commit is dated July 14, inside the submission period.
17. **What is mocked?** Automated Electron tests mock model responses. The separate live tests use the real OpenAI API and are labeled.
18. **How reliable is it?** All 61 unit and integration tests and 10 Electron journeys pass. The visual evaluator classified five consecutive broken and fixed pairs correctly, and the paired live replay produced the expected fail and pass results.
19. **What is the business wedge?** Product and support teams that collect bug videos but lack time to convert every issue into regression coverage.
20. **What comes next?** Exportable test artifacts, CI triggers, richer event traces, signed builds, and an open evaluation format for computer-use agents.

## Red-team conclusion

The project misses the finals if it keeps the broad automation pitch, hides the GPT-5.6 calls, claims to understand every video action, or makes judges fight macOS permissions. It also loses if the result is merely “agent completed” rather than a visible assertion.

Corrections:

- Replace broad automation with one bug-regression event.
- Add an explicit expected outcome and pass or fail evaluator.
- Use one disposable target with broken and fixed states.
- Put limitations beside claims.
- Provide a direct test build and a prerecorded fallback.
- Submit the Devpost draft before final polish.

## Final decision

**PIVOT**

- Strongest reason: the existing engine can produce a complete, technically deep, visible regression demo with one focused addition.
- Biggest unresolved risk: reliable final-state assertion.
- First experiment: run the same learned check against deterministic broken and fixed states five times each.
- First documentation page: [GPT-5.6 model reference](https://developers.openai.com/api/docs/models/gpt-5.6-sol).
- Feature freeze: July 20, 2026 at 12:00 IST.
- Abandon pivot threshold: the evaluator fails to classify broken versus fixed in five consecutive paired runs by July 18 end of day.
- Primary category: Developer Tools.
- Backup framing: support recording to reproducible issue runner, still in Developer Tools.
- Final pitch: “TaskTape Replay turns a narrated bug recording into a GPT-5.6-powered regression check that replays the real interface and returns visual pass or fail proof.”

## Official and competitive sources

- [OpenAI Build Week rules](https://openai.devpost.com/rules)
- [OpenAI Build Week resources](https://openai.devpost.com/resources)
- [OpenAI Build Week schedule](https://openai.devpost.com/details/dates)
- [GPT-5.6 launch](https://openai.com/index/gpt-5-6/)
- [GPT-5.6 API model](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [ChatGPT Work](https://openai.com/index/chatgpt-for-your-most-ambitious-work/)
- [Power Automate Record with Copilot](https://learn.microsoft.com/en-us/power-automate/desktop-flows/create-flow-using-ai-recorder)
- [UiPath Task Mining](https://docs.uipath.com/task-mining/automation-cloud/latest/user-guide/assisted-task-mining-introduction)
- [Claude Cowork scheduled tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork)
- [Momentic agent tests](https://momentic.ai/docs/get-started/how-momentic-works)
- [BugBug recorded tests](https://docs.bugbug.io/quick-start/create-and-run-the-tests)
- [QA Wolf](https://www.qawolf.com/)
- [Jam integration](https://openai.com/business/apps/jam-dev/)
