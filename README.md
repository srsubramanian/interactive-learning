# Jayshri Math (voice)

A first-grade math buddy. She **hears** each question (ElevenLabs voice), **sees** it on screen, and **answers out loud**.
Claude (Haiku) checks what she said. The **Explain** tab shows picture lessons (built-in, or custom-drawn by Claude) at four depths that follow her understanding.

## Run it
1. Install Node 18+ (you have it).
2. `npm install`
3. `cp .env.example .env`, then put in `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` (from console.anthropic.com).
4. `npm run dev` and open http://localhost:5173. Allow the microphone when asked.

Everyday use without the dev server: `npm run build`, then `npm start` and open http://localhost:3000.

## Use it on the iPad (home Wi-Fi)
The microphone only works on `https://` pages, so the Mac serves the app over HTTPS with a certificate made by `mkcert`, and the iPad trusts that certificate once. The keys stay on the Mac. A PIN keeps other devices on your Wi-Fi from using the app.

**One time, on the Mac** (in this folder): run `npm run setup:ipad`. It does everything below for you (installs mkcert, makes the certificate, adds the settings and a new PIN to `.env`, builds the app) and prints what to do on the iPad. Or by hand:
```
brew install mkcert
mkcert -install
mkdir -p certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem "$(scutil --get LocalHostName).local" localhost 127.0.0.1
```
Then add to `.env` (pick your own PIN, 6 or more digits):
```
HOST=0.0.0.0
HTTPS_CERT=certs/cert.pem
HTTPS_KEY=certs/key.pem
APP_PIN=123456
```

**One time, on the iPad:** trust the certificate.
1. On the Mac run `open "$(mkcert -CAROOT)"` and AirDrop **only `rootCA.pem`** to the iPad. Never share `rootCA-key.pem`: it can make certificates your devices trust.
2. iPad: **Settings → Profile Downloaded → Install** (also under Settings → General → VPN & Device Management).
3. iPad: **Settings → General → About → Certificate Trust Settings**, turn on the mkcert certificate.

**Each time:**
1. On the Mac: `npm run build` (after any `git pull`), then `npm start`. If macOS asks whether `node` may accept incoming connections, choose **Allow**.
   It prints the address to use, like `https://Subras-MacBook-Pro.local:3000`. Use the `.local` one: the certificate is made for that name.
2. On the iPad (same Wi-Fi), open that address in Safari, type the PIN once, tap **Let us go!**, and allow the microphone.

The Mac must stay awake while she plays; `caffeinate -i npm start` keeps it from sleeping.

If Safari cannot connect: check both are on the same Wi-Fi (not a guest network), the Mac is awake, and `node` is allowed in System Settings → Network → Firewall. If Safari warns about the certificate, step 3 on the iPad was skipped or the Mac's name changed (run the `mkcert` command again).

### Away from home (optional): Tailscale
Tailscale (free for personal use) gives the Mac a private HTTPS address that works from anywhere. Install it on both devices, turn on **MagicDNS** and **HTTPS Certificates** in its admin console, run `npm start` (no `HOST`/`HTTPS_*` needed), then `tailscale serve --bg 3000` and open the printed `https://….ts.net` address on the iPad. Stop with `tailscale serve reset`.

## Manual test checklist
Run through this after changes, on the Mac (`npm run dev`) and on the iPad:
- [ ] Practice → **Let us go!** → allow the mic. You hear "Hi! I am your math buddy" and "Question 1", and the question is on screen.
- [ ] Say the right answer: a cheer, a green pip, the next question.
- [ ] Say a wrong answer: a hint that does not say the answer; the third miss says it and offers **Show me why**.
- [ ] Say nothing: "I did not hear you"; after two, it waits for a tap on the mic.
- [ ] **Type instead** works; typing while she is still listening to the question keeps the text.
- [ ] **Hear it again** repeats the question; tapped during the cheer, it moves on (no double star).
- [ ] **Show me why** opens a picture lesson that plays; **Make it simpler** / **Go deeper** change it.
- [ ] Explain → **✨ Ask Claude to draw one** returns a lesson; **Save** keeps it after a reload.
- [ ] Finish 10 questions: the stars match what happened; progress is still there after restarting the server.

## Notes
- Keys stay in the local server. The browser never sees them.
- Her progress and saved Claude lessons are saved in `data/store.json` on this computer.
- Every sentence the voice speaks is saved in `data/tts` and reused, so ElevenLabs is only asked for each sentence once.
- Audio goes to ElevenLabs (speaking and listening). Only the text of what she said goes to Anthropic. With `STT_PROVIDER=browser`, Chrome sends her audio to Google instead.
- Arithmetic is decided in code; Claude only words the feedback. Custom lessons are checked in code before showing.
- If the voice is not found, set `ELEVENLABS_VOICE_ID` in `.env`. `STT_PROVIDER=browser` listens with Chrome instead of ElevenLabs.
- `npm test` runs the checks.
