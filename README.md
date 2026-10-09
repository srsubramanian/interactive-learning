# Jayshri Math (voice)

A first-grade math buddy. She **hears** each question (ElevenLabs voice), **sees** it on screen, and **answers out loud**.
Claude (Haiku) checks what she said. The **Explain** tab shows picture lessons (built-in, or custom-drawn by Claude) at four depths that follow her understanding.

## Run it
1. Install Node 18+ (you have it).
2. `npm install`
3. `cp .env.example .env`, then put in `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` (from console.anthropic.com).
4. `npm run dev` and open http://localhost:5173. Allow the microphone when asked.

Everyday use without the dev server: `npm run build`, then `npm start` and open http://localhost:3000.

## Notes
- Keys stay in the local server. The browser never sees them.
- Her progress and saved Claude lessons are saved in `data/store.json` on this computer.
- Every sentence the voice speaks is saved in `data/tts` and reused, so ElevenLabs is only asked for each sentence once.
- Audio goes to ElevenLabs (speaking and listening). Only the text of what she said goes to Anthropic.
- Arithmetic is decided in code; Claude only words the feedback. Custom lessons are checked in code before showing.
- If the voice is not found, set `ELEVENLABS_VOICE_ID` in `.env`. `STT_PROVIDER=browser` listens with Chrome instead of ElevenLabs.
- `npm test` runs the checks.
