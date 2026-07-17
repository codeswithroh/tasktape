# Voice and scheduling research

## Product decision

TaskTape uses a bounded voice note after screen recording instead of always-on narration or Realtime transcription. The user can review and edit the transcript before analysis. This gives the model an explicit outcome, keeps the permission moment understandable, and preserves typing as a complete fallback.

The resulting transcript and selected video frames are analyzed together once. Folder rules and any stated timing become editable proposals. A schedule is activated only when the user saves the workflow.

## Evidence

- [OpenAI speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text) documents completed-file transcription, supported WebM input, and the 25 MB upload limit. This fits a short push-to-talk note without a Realtime session.
- [Loom screen and audio recorder](https://www.loom.com/products/screen-audio-recorder) establishes the expectation that screen capture includes a clear audio path and produces a transcript users can work from.
- [Wispr Flow overview](https://docs.wisprflow.ai/articles/2772472373-what-is-flow) shows that fast, natural dictation across desktop workflows is now a familiar interaction rather than a specialist accessibility feature.
- [Zapier scheduling guide](https://help.zapier.com/hc/en-us/articles/8496288648461-Schedule-Zap-workflows-to-run-at-specific-intervals) reinforces the expected daily and weekly controls: frequency, day, and time should be explicit and reviewable.
- [Codex automations](https://learn.chatgpt.com/docs/automations.md) uses a saved task with instructions, a project context, cadence, a Scheduled inbox, run history, Run now, and pause controls.
- [Claude recurring tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork) uses the same Cowork capabilities for manual and recurring tasks, with hourly, daily, weekday, weekly, pause, edit, and run-on-demand controls.
- [OpenAI computer use](https://developers.openai.com/api/docs/guides/tools-computer-use) defines the screenshot and action loop plus pending safety checks used by TaskTape's computer adapter.

## Deliberate limits

- Voice is optional. Typed intent must always work.
- TaskTape does not upload the complete screen recording for analysis. It sends selected frames and the transcript.
- Dictated timing is a proposal, not permission to create a background job.
- Local scheduled runs require TaskTape to remain open and the Mac to be awake.
- Realtime transcription is deferred until live partial text creates a clear user benefit.
