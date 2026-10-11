import { useState } from 'react';
import { pinApi } from '../api';

/** Asked once per device when the app is opened from the home network. */
export function PinGate() {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await pinApi(pin.trim());
      window.location.reload(); // load her progress now that the server lets us in
    } catch (x) {
      setErr((x as Error).message);
      setPin('');
      setBusy(false);
    }
  };

  return (
    <section className="card start">
      <div className="big-emoji" aria-hidden>🔒</div>
      <h2>Grown-up PIN</h2>
      <p className="hint">Type the PIN from the .env file on the Mac. This iPad will remember it.</p>
      <form className="row" onSubmit={submit}>
        <input className="num pin" type="password" inputMode="numeric" autoComplete="off" value={pin}
          onChange={(e) => setPin(e.target.value)} aria-label="PIN" autoFocus />
        <button className="btn primary" type="submit" disabled={busy}>OK</button>
      </form>
      {err && <p className="err">{err}</p>}
    </section>
  );
}
