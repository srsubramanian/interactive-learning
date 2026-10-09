import { useEffect, useMemo, useState } from 'react';
import { getConfig } from './api';
import { Speaker } from './audio/speech';
import { Explain } from './components/Explain';
import { Practice } from './components/Practice';
import { useMedia } from './hooks/useMedia';
import { usePractice } from './hooks/usePractice';
import { useAppStore } from './state/useStore';
import type { Config, ExplainRequest, Mode } from './types';

export default function App() {
  const [tab, setTab] = useState<'practice' | 'explain'>('practice');
  const [mode, setMode] = useState<Mode>('mix20');
  const [cfg, setCfg] = useState<Config | null>(null);
  const [cfgErr, setCfgErr] = useState(false);
  const [req, setReq] = useState<ExplainRequest | null>(null);
  const speaker = useMemo(() => new Speaker(), []);
  const media = useMedia();
  const st = useAppStore();

  useEffect(() => { getConfig().then(setCfg).catch(() => setCfgErr(true)); }, []);

  const p = usePractice({
    speaker,
    ensureMedia: media.ensure,
    sttProvider: cfg?.sttProvider ?? 'elevenlabs',
    onAttempt: st.addAttempt,
    getLevel: (op) => st.skill(op).level,
    onExplain: (r) => { setReq({ ...r }); setTab('explain'); },
    active: tab === 'practice'
  });

  const keysOk = !!cfg && cfg.hasElevenLabs && cfg.hasAnthropic;

  return (
    <div className="app">
      <header>
        <h1>Jayshri Math</h1>
        <nav role="tablist">
          <button role="tab" aria-selected={tab === 'practice'} className={tab === 'practice' ? 'on' : ''} onClick={() => setTab('practice')}>🎤 Practice</button>
          <button role="tab" aria-selected={tab === 'explain'} className={tab === 'explain' ? 'on' : ''} onClick={() => setTab('explain')}>🔍 Explain</button>
        </nav>
      </header>
      {cfgErr && <p className="banner err">The helper server is not running. Start the app with “npm run dev”.</p>}
      {st.saveError && <p className="banner err">Progress could not be saved.</p>}
      <main>
        {tab === 'practice' ? (
          <Practice p={p} mode={mode} setMode={setMode} keysOk={keysOk} />
        ) : (
          <Explain
            speaker={speaker}
            store={st.store}
            request={req}
            hasAnthropic={!!cfg?.hasAnthropic}
            skill={st.skill}
            addLesson={st.addLesson}
            removeLesson={st.removeLesson}
          />
        )}
      </main>
    </div>
  );
}
