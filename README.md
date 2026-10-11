# Jayshri Math (voice)

A first-grade math buddy. She **hears** each question (ElevenLabs voice), **sees** it on screen, and **answers out loud**.
Claude (Haiku) checks what she said. The **Explain** tab shows picture lessons (built-in, or custom-drawn by Claude) at four depths that follow her understanding.

## Run it
1. Install Node 18+ (you have it).
2. `npm install`
3. `cp .env.example .env`, then put in `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` (from console.anthropic.com).
4. `npm run dev` and open http://localhost:5173. Allow the microphone when asked.

Everyday use without the dev server: `npm run build`, then `npm start` and open http://localhost:3000.

## Use it on the iPad (Tailscale)
The microphone only works on `https://` (or localhost), so the iPad reaches the Mac through Tailscale, which gives the Mac a private HTTPS address. The keys stay on the Mac.

1. Install Tailscale on the Mac and the iPad (App Store) and sign in to the same account on both.
2. In the Tailscale admin console, under **DNS**, turn on **MagicDNS** and **HTTPS Certificates**.
3. On the Mac, in this folder:
   ```
   git pull
   npm install
   npm run build
   npm start
   ```
   Leave it running (it serves the app on http://localhost:3000).
4. In a second Terminal window: `tailscale serve --bg 3000`. It prints an address like `https://your-mac.your-tailnet.ts.net`.
   If `tailscale` is not found, use `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3000`.
5. On the iPad, open that address in Safari, tap **Let us go!**, and allow the microphone.

Run `npm run build` again after every `git pull`. To stop sharing: `tailscale serve reset`.

## Notes
- Keys stay in the local server. The browser never sees them.
- Her progress and saved Claude lessons are saved in `data/store.json` on this computer.
- Audio goes to ElevenLabs (speaking and listening). Only the text of what she said goes to Anthropic. With `STT_PROVIDER=browser`, Chrome sends her audio to Google instead.
- Arithmetic is decided in code; Claude only words the feedback. Custom lessons are checked in code before showing.
- If the voice is not found, set `ELEVENLABS_VOICE_ID` in `.env`. `STT_PROVIDER=browser` listens with Chrome instead of ElevenLabs.
- `npm test` runs the checks.
