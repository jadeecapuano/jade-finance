import { useState, useEffect } from 'react';
import { warmup } from './api';
import PIN from './components/PIN';
import Painel from './components/Painel';
import Compras from './components/Compras';
import Extrato from './components/Extrato';
import Historico from './components/Historico';
import Configuracoes from './components/Configuracoes';

const TABS = [
  { id: 'painel',   label: 'Painel',   icon: '⌂' },
  { id: 'compras',  label: 'Compras',  icon: '🛍' },
  { id: 'extrato',  label: 'Extrato',  icon: '↑' },
  { id: 'historico',label: 'Histórico',icon: '◷' },
  { id: 'config',   label: 'Config',   icon: '⚙' },
];

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState('painel');

  useEffect(() => { warmup(); }, []);

  if (!unlocked) return <PIN onSuccess={() => setUnlocked(true)} />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll">
        {tab === 'painel'    && <Painel />}
        {tab === 'compras'   && <Compras />}
        {tab === 'extrato'   && <Extrato />}
        {tab === 'historico' && <Historico />}
        {tab === 'config'    && <Configuracoes />}
      </div>

      <nav className="bottom-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-item${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
