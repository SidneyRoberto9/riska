# ADR 0008: Voice dictation via the Web Speech API, no dependency

## Status
Accepted

## Context
Adding tasks by voice helps on a phone. Speech-to-text services or SDKs
would add a dependency, an API key and a privacy question.

## Decision
`VoiceButton` uses the browser's `SpeechRecognition` /
`webkitSpeechRecognition` with `lang = "pt-BR"` and interim results. When
the API is unavailable (e.g. Firefox) the button renders nothing.

## Consequences
- Zero dependencies and zero backend work.
- Availability and quality depend on the browser; where supported,
  Chromium-based browsers may send audio to the vendor's service — outside
  Riska's control.
