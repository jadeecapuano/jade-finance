import { useState, useEffect } from 'react';

const PIN_KEY = 'jf_pin';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30000;

export default function PIN({ onSuccess }) {
  const [input, setInput]       = useState('');
  const [mode, setMode]         = useState('enter'); // 'enter' | 'create' | 'confirm'
  const [newPin, setNewPin]     = useState('');
  const [error, setError]       = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked]     = useState(false);
  const [lockEnd, setLockEnd]   = useState(0);

  const savedPin = localStorage.getItem(PIN_KEY);

  useEffect(() => {
    if (!savedPin) setMode('create');
  }, [savedPin]);

  useEffect(() => {
    if (locked) {
      const remaining = Math.ceil((lockEnd - Date.now()) / 1000);
      if (remaining <= 0) { setLocked(false); setAttempts(0); return; }
      const timer = setTimeout(() => { setLocked(false); setAttempts(0); }, lockEnd - Date.now());
      return () => clearTimeout(timer);
    }
  }, [locked, lockEnd]);

  function press(digit) {
    if (locked) return;
    if (input.length >= 4) return;
    const next = input + digit;
    setInput(next);
    setError('');

    if (next.length === 4) {
      setTimeout(() => handleComplete(next), 100);
    }
  }

  function del() { setInput(p => p.slice(0, -1)); setError(''); }

  function handleComplete(pin) {
    if (mode === 'create') {
      setNewPin(pin);
      setInput('');
      setMode('confirm');
      return;
    }
    if (mode === 'confirm') {
      if (pin === newPin) {
        localStorage.setItem(PIN_KEY, pin);
        onSuccess();
      } else {
        setError('PINs diferentes. Tente novamente.');
        setInput('');
        setNewPin('');
        setMode('create');
      }
      return;
    }
    // mode === 'enter'
    if (pin === savedPin) {
      onSuccess();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setInput('');
      if (next >= MAX_ATTEMPTS) {
        setLocked(true);
        setLockEnd(Date.now() + LOCKOUT_MS);
        setError('Bloqueado por 30 segundos.');
      } else {
        setError(`PIN incorreto. ${MAX_ATTEMPTS - next} tentativa(s) restante(s).`);
      }
    }
  }

  const titles = {
    create:  'Crie seu PIN',
    confirm: 'Confirme o PIN',
    enter:   'Jade Finance',
  };
  const subtitles = {
    create:  'Escolha 4 dígitos para proteger o app',
    confirm: 'Digite novamente para confirmar',
    enter:   'Digite seu PIN para continuar',
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px'
    }}>
      {/* Logo */}
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'var(--indigo)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 36, marginBottom: 24,
        boxShadow: '0 8px 24px rgba(79,70,229,.35)'
      }}>💜</div>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
        {titles[mode]}
      </h1>
      <p className="caption" style={{ marginBottom: 32, textAlign: 'center' }}>
        {subtitles[mode]}
      </p>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < input.length ? 'var(--indigo)' : 'var(--border)',
            border: `2px solid ${i < input.length ? 'var(--indigo)' : 'var(--text-ter)'}`,
            transition: 'all .15s'
          }} />
        ))}
      </div>

      {error && (
        <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
          {error}
        </p>
      )}

      {/* Keypad */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 12, width: '100%', maxWidth: 280, marginTop: 8
      }}>
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
          <button key={i}
            onClick={() => d === '⌫' ? del() : d !== '' ? press(String(d)) : null}
            disabled={locked || d === ''}
            style={{
              height: 72, borderRadius: 16,
              background: d === '' ? 'transparent' : 'var(--card)',
              border: 'none', cursor: d === '' ? 'default' : 'pointer',
              fontSize: d === '⌫' ? 20 : 26, fontWeight: 500,
              color: 'var(--text)',
              boxShadow: d === '' ? 'none' : 'var(--shadow)',
              opacity: locked ? .5 : 1,
              transition: 'transform .1s, opacity .15s',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(.93)'}
            onMouseUp={e => e.currentTarget.style.transform = ''}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(.93)'}
            onTouchEnd={e => e.currentTarget.style.transform = ''}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
