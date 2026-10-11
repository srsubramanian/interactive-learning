#!/usr/bin/env bash
# One-time Mac setup so the iPad can use the app on the home Wi-Fi ("Use it on the iPad" in README.md):
# makes an HTTPS certificate with mkcert, turns on HOST/HTTPS/APP_PIN in .env, and builds the app.
# Safe to run again. It never prints or changes your API keys.
set -euo pipefail
cd "$(dirname "$0")/.."

[ "$(uname)" = Darwin ] || { echo "Run this on the Mac."; exit 1; }
[ -f .env ] || { echo "No .env yet. Run: cp .env.example .env   then add your two API keys, and run this again."; exit 1; }

if ! command -v mkcert >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 || { echo "Homebrew is needed to install mkcert: see https://brew.sh"; exit 1; }
  echo "Installing mkcert..."
  brew install mkcert
fi

echo "Trusting mkcert on this Mac (it may ask for your Mac password)..."
mkcert -install

NAME="$(scutil --get LocalHostName).local"
mkdir -p certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem "$NAME" localhost 127.0.0.1

# .env: add each setting unless it is already there (an empty "KEY=" line counts as missing).
[ -z "$(tail -c1 .env)" ] || echo >> .env
has() { grep -qE "^[[:space:]]*$1[[:space:]]*=[[:space:]]*[^[:space:]#]" .env; }
add() {
  if has "$1"; then return; fi
  sed -i '' -E "/^[[:space:]]*$1[[:space:]]*=[[:space:]]*(#.*)?$/d" .env
  printf '%s=%s\n' "$1" "$2" >> .env
}
add HOST 0.0.0.0
add HTTPS_CERT certs/cert.pem
add HTTPS_KEY certs/key.pem
PIN_MSG="APP_PIN was already set in .env; use that PIN."
if ! has APP_PIN; then
  n=$(od -An -N4 -tu4 /dev/urandom | tr -d ' \n')
  PIN=$(printf '%06d' $((n % 1000000)))
  add APP_PIN "$PIN"
  PIN_MSG="Your PIN (also saved in .env as APP_PIN): $PIN"
fi
if grep -qE '^[[:space:]]*HOST[[:space:]]*=[[:space:]]*(127\.0\.0\.1|localhost)' .env; then
  echo "Note: .env has HOST=127.0.0.1, so the iPad cannot reach the Mac. Change it to HOST=0.0.0.0."
fi

echo "Installing and building the app..."
npm install --no-audit --no-fund
npm run build

PORT=$(grep -E '^[[:space:]]*PORT[[:space:]]*=' .env | tail -1 | sed -E 's/^[^=]*=[[:space:]]*([0-9]+).*/\1/' || true)
open "$(mkcert -CAROOT)" || true

cat <<EOF

Done on the Mac.
$PIN_MSG

On the iPad, once:
  1. A Finder window just opened. AirDrop ONLY "rootCA.pem" to the iPad.
     (Never share "rootCA-key.pem".)
  2. iPad: Settings > Profile Downloaded > Install.
  3. iPad: Settings > General > About > Certificate Trust Settings > turn on mkcert.

Then, each time:
  On the Mac:  npm start          (or: caffeinate -i npm start  to keep the Mac awake)
  On the iPad: open https://$NAME:${PORT:-3000} in Safari, type the PIN once, tap "Let us go!".
EOF
