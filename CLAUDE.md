# Jayshri Math (voice)

First-grade math buddy for Subra's daughter. She hears each question (ElevenLabs TTS), sees it on screen, answers by voice; Claude Haiku words the feedback; an Explain tab shows picture lessons.

## Layout
- `server/` Node ESM API (no server deps), 127.0.0.1:3000. `index.js` routes, `eleven.js` TTS/STT (spoken clips are kept in `data/tts` and reused), `claude.js` judge + custom lessons, `schema.js` sanitizing/validation, `store.js` saves `data/store.json`.
- `src/` Vite + React + TS client. `hooks/usePractice.ts` is the practice state machine (mutable `core` ref + generation token for cancellation). `audio/` speech + VAD listening. `lessons/builders.ts` built-in picture lessons (4 depth levels). `state/level.ts` understanding level.
- `tests/` vitest (`npm test`). Dev: `npm run dev` -> http://localhost:5173 (proxies /api). Prod: `npm run build && npm start`.

## Rules to keep
- API keys only in `.env`, only used by the server. Never send them to the client.
- Arithmetic correctness is decided in code, never by the model. Lessons from Claude are data-only and must pass `cleanLesson` + `lessonConsistent`.
- Treat transcripts, topics and saved lessons as untrusted text.
- Voice only through ElevenLabs; answer review through Claude (default `claude-haiku-5-5`).

## Not yet verified
Real ElevenLabs and Anthropic calls work (checked 2026-10-09 through the API: speaking, listening, answer review, custom lessons). The live microphone flow with a real child has not been tried in either listening mode (`STT_PROVIDER=elevenlabs` or `browser`); it may need small fixes (VAD thresholds, browser listening). The Claude app's built-in browser pane blocks the microphone, so test voice in real Chrome.

## Ideas next
iPad: installable PWA over HTTPS (Tailscale or small host with a PIN), later Capacitor wrapper. Adaptive question difficulty from progress. Voice "show me a picture".
