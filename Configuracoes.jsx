import { useState, useEffect } from 'react';
import { api } from '../api';

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2 });
}

export default function Configuracoes() {
  const [cfg, setCfg]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin]   = useState('');
  const [pinStep, setPinStep] = useState(1);
  const [pinConfirm, setPinConfirm] = useState('');

  useEffect(() => {
    api.config().then(r => setCfg(r.config)).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.updateConfig(cfg);
      setSavedMsg('Configurações salvas!');
    } catch {
      setSavedMsg('Erro ao salvar. Tente novamente.');
    }
    setSaving(false);
    setTimeout(() => setSavedMsg(''), 3000);
  }

  function changePin() {
    if (pinStep === 1) {
      setNewPin(newPin);
      setPinStep(2);
    } else {
      if (newPin === pinConfirm) {
        localStorage.setItem('jf_pin', newPin);
        setSavedMsg('PIN alterado com sucesso!');
        setShowPin(false);
        setPinStep(1); setNewPin(''); setPinConfirm('');
        setTimeout(() => setSavedMsg(''), 3000);
      } else {
        setSavedMsg('PINs diferentes. Tente novamente.');
        setPinStep(1); setNewPin(''); setPinConfirm('');
      }
    }
  }

  if (!cfg) return <div className="loading"><div className="spinner"/>Carregando...</div>;

  function field(key, label, unit='') {
    return (
      <div style={{ marginBottom:14 }}>
        <p className="label-sm" style={{ marginBottom:5 }}>{label}</p>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {unit && <span style={{ fontSize:13, color:'var(--text-sec)' }}>R$</span>}
          <input className="input"
            type="number"
            value={cfg[key] || ''}
            onChange={e => setCfg({ ...cfg, [key]: Number(e.target.value) })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="scroll fade-in" style={{ padding:16 }}>

      <p style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Configurações</p>
      <p className="caption" style={{ marginBottom:16 }}>
        Atualize no começo de cada mês com os valores reais.
      </p>

      {/* Financial */}
      <div className="card" style={{ marginBottom:14 }}>
        <p style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Dados financeiros</p>
        {field('renda_mensal', 'Renda mensal (salário + Caju)', 'R$')}
        {field('budget_var', 'Orçamento variável do mês', 'R$')}
        {field('gasto_var', 'Quanto já gastei em variáveis', 'R$')}
        {field('limite_inter_total', 'Limite total do Inter', 'R$')}
        {field('limite_inter_bloqueado', 'Comprometido em parcelamentos', 'R$')}
        {field('assinaturas_total', 'Total de assinaturas mensais', 'R$')}
        {field('reserva_atual', 'Reserva de emergência atual', 'R$')}
      </div>

      {/* Livelo rates */}
      <div className="card" style={{ marginBottom:14 }}>
        <p style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Taxas Livelo</p>
        <p className="caption" style={{ marginBottom:12 }}>
          Pontos por real gasto. Atualize quando ver campanhas ativas.
        </p>
        {[
          ['livelo_magalu','Magazine Luiza'],
          ['livelo_casasbahia','Casas Bahia'],
          ['livelo_amazon','Amazon'],
          ['livelo_americanas','Americanas'],
          ['livelo_kabum','Kabum'],
          ['livelo_ml','Mercado Livre'],
          ['livelo_shopee','Shopee'],
        ].map(([key, label]) => (
          <div key={key} style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'8px 0', borderBottom:'0.5px solid var(--border)'
          }}>
            <p style={{ fontSize:13 }}>{label}</p>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="number" step="0.5" min="0" max="10"
                value={cfg[key] || 1}
                onChange={e => setCfg({ ...cfg, [key]: Number(e.target.value) })}
                style={{
                  width:64, border:'1px solid var(--border)', borderRadius:8,
                  padding:'4px 8px', fontSize:13, textAlign:'center',
                  background:'var(--bg)', color:'var(--text)'
                }}
              />
              <span style={{ fontSize:12, color:'var(--text-ter)' }}>pts/R$</span>
            </div>
          </div>
        ))}
      </div>

      {/* PIN */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <p style={{ fontSize:15, fontWeight:700 }}>PIN de acesso</p>
            <p className="caption">4 dígitos para desbloquear o app</p>
          </div>
          <button className="btn btn-secondary"
            onClick={() => setShowPin(!showPin)}
            style={{ padding:'8px 14px', fontSize:13 }}>
            Alterar
          </button>
        </div>
        {showPin && (
          <div style={{ marginTop:14 }}>
            <p className="label-sm" style={{ marginBottom:5 }}>
              {pinStep === 1 ? 'Novo PIN (4 dígitos)' : 'Confirme o PIN'}
            </p>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" type="password"
                maxLength={4} inputMode="numeric"
                value={pinStep === 1 ? newPin : pinConfirm}
                onChange={e => pinStep === 1 ? setNewPin(e.target.value) : setPinConfirm(e.target.value)}
                placeholder="••••"
              />
              <button className="btn btn-primary"
                onClick={changePin}
                disabled={(pinStep === 1 ? newPin : pinConfirm).length !== 4}
                style={{ padding:'10px 16px', whiteSpace:'nowrap' }}>
                {pinStep === 1 ? 'Próximo' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <button className="btn btn-primary btn-full"
        onClick={save} disabled={saving}
        style={{ marginBottom:12 }}>
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </button>

      {savedMsg && (
        <div style={{
          background: savedMsg.includes('Erro') ? 'var(--red-light)' : 'var(--green-light)',
          color: savedMsg.includes('Erro') ? 'var(--red)' : 'var(--green)',
          borderRadius:12, padding:'12px 16px', fontSize:14,
          fontWeight:600, textAlign:'center'
        }}>{savedMsg}</div>
      )}

      {/* App info */}
      <div style={{
        textAlign:'center', marginTop:24, color:'var(--text-ter)', fontSize:12
      }}>
        <p style={{ marginBottom:4 }}>💜 Jade Finance v1.0</p>
        <p>Desenvolvido especialmente para a Jade Capuano</p>
      </div>
    </div>
  );
}
