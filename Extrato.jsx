import { useState } from 'react';
import { api } from '../api';

const KNOWN_SUBS = ['spotify','netflix','disney','amazon prime','youtube','hbo',
  'globoplay','vidya','wellhub','gympass','anthropic','claude','rappi','ifood',
  'nubank','apple','microsoft','adobe','canva','notion'];

export default function Extrato() {
  const [banco, setBanco]           = useState('inter');
  const [image, setImage]           = useState(null);
  const [preview, setPreview]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [savedMsg, setSavedMsg]     = useState('');
  const [error, setError]           = useState('');

  function handleFile(file) {
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);
    setTransactions(null);
    setError('');
  }

  async function processOCR() {
    if (!image) return;
    setLoading(true); setError('');
    try {
      const reader = new FileReader();
      reader.onload = async e => {
        const base64 = e.target.result.split(',')[1];
        try {
          const result = await api.ocr({ image_base64: base64, banco });
          setTransactions(result.transactions || []);
        } catch {
          setError('Erro ao processar a imagem. Tente novamente com uma foto mais nítida.');
        }
        setLoading(false);
      };
      reader.readAsDataURL(image);
    } catch {
      setError('Erro ao ler o arquivo.');
      setLoading(false);
    }
  }

  function updateTxn(i, field, value) {
    setTransactions(prev => prev.map((t, idx) =>
      idx === i ? { ...t, [field]: value } : t
    ));
  }

  function removeTxn(i) {
    setTransactions(prev => prev.filter((_, idx) => idx !== i));
  }

  async function saveAll() {
    setSaving(true);
    try {
      await api.saveTransactions({ transactions, banco });
      setSavedMsg(`${transactions.length} transações salvas na planilha!`);
      setTransactions(null);
      setImage(null);
      setPreview(null);
    } catch {
      setSavedMsg('Erro ao salvar. Tente novamente.');
    }
    setSaving(false);
    setTimeout(() => setSavedMsg(''), 4000);
  }

  const BANCOS = [
    { id:'inter', label:'Inter', color:'#EA580C' },
    { id:'nubank', label:'Nubank', color:'#7C3AED' },
    { id:'itau', label:'Itaú', color:'#F97316' },
    { id:'outro', label:'Outro', color:'#6B7280' },
  ];

  const CATS = ['Alimentação','Transporte','Saúde','Beleza','Roupas','Lazer',
                'Suplementos','Tecnologia','Casa','Assinatura','Parcela','Transferência','Outros'];

  return (
    <div className="scroll fade-in" style={{ padding:16 }}>

      <p style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>
        Extrato da semana
      </p>
      <p className="caption" style={{ marginBottom:16 }}>
        Fotografe ou faça upload do extrato bancário. A IA lê e categoriza automaticamente.
      </p>

      {/* Banco selector */}
      <div className="card" style={{ marginBottom:14 }}>
        <p className="label-sm" style={{ marginBottom:8 }}>Qual banco?</p>
        <div style={{ display:'flex', gap:8 }}>
          {BANCOS.map(b => (
            <button key={b.id}
              onClick={() => setBanco(b.id)}
              style={{
                flex:1, padding:'10px 6px', borderRadius:10, border:'none',
                background: banco === b.id ? b.color : 'var(--bg)',
                color: banco === b.id ? '#fff' : 'var(--text-sec)',
                fontWeight: 600, fontSize:13, cursor:'pointer',
                transition:'all .15s'
              }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div
        onClick={() => document.getElementById('file-input').click()}
        style={{
          border: `2px dashed ${preview ? 'var(--indigo)' : 'var(--border)'}`,
          borderRadius:16, padding:24, textAlign:'center',
          cursor:'pointer', marginBottom:14, background:'var(--card)',
          transition:'border-color .2s'
        }}>
        <input id="file-input" type="file" accept="image/*"
          style={{ display:'none' }}
          onChange={e => handleFile(e.target.files[0])} />
        {preview ? (
          <img src={preview} alt="extrato" style={{
            maxWidth:'100%', maxHeight:200, borderRadius:10, objectFit:'contain'
          }} />
        ) : (
          <>
            <div style={{ fontSize:40, marginBottom:8, opacity:.4 }}>📱</div>
            <p style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>
              Toque para selecionar a imagem
            </p>
            <p className="caption">
              Screenshot do extrato ou foto da tela do banco
            </p>
          </>
        )}
      </div>

      {image && !transactions && (
        <button className="btn btn-primary btn-full"
          onClick={processOCR} disabled={loading}
          style={{ marginBottom:14 }}>
          {loading
            ? <><div className="spinner" style={{ width:16, height:16, margin:'0 6px 0 0' }}/>
                Lendo o extrato...</>
            : 'Processar com IA'}
        </button>
      )}

      {error && (
        <div style={{
          background:'var(--red-light)', color:'var(--red)',
          borderRadius:12, padding:14, fontSize:13, marginBottom:14
        }}>{error}</div>
      )}

      {/* Transactions review */}
      {transactions && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ fontSize:15, fontWeight:700 }}>
              {transactions.length} transações encontradas
            </p>
            <span className="pill pill-indigo">Revise antes de salvar</span>
          </div>

          {transactions.map((t, i) => {
            const isSub = KNOWN_SUBS.some(s => t.description?.toLowerCase().includes(s));
            const isParc = t.is_installment;
            return (
              <div key={i} className="card" style={{
                marginBottom:8,
                borderLeft: `4px solid ${isSub||isParc ? 'var(--amber)' : t.type==='credit' ? 'var(--green)' : 'var(--indigo)'}`
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, wordBreak:'break-word' }}>
                      {t.description_resolved || t.description}
                    </p>
                    {t.date && <p className="caption">{t.date}</p>}
                    {(isSub||isParc) && (
                      <span className="pill pill-amber" style={{ marginTop:4 }}>
                        {isParc ? `Parcela ${t.installment_info}` : 'Assinatura'}
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, marginLeft:8 }}>
                    <p style={{
                      fontSize:15, fontWeight:700,
                      color: t.type === 'credit' ? 'var(--green)' : 'var(--text)'
                    }}>
                      {t.type === 'credit' ? '+' : '-'} R$ {Number(t.amount).toFixed(2)}
                    </p>
                    <button onClick={() => removeTxn(i)} style={{
                      background:'transparent', border:'none', cursor:'pointer',
                      color:'var(--text-ter)', fontSize:18
                    }}>✕</button>
                  </div>
                </div>
                <select className="input" style={{ fontSize:12, padding:'6px 10px' }}
                  value={t.category || 'Outros'}
                  onChange={e => updateTxn(i, 'category', e.target.value)}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            );
          })}

          <div style={{
            background:'var(--indigo-light)', borderRadius:12,
            padding:'12px 14px', marginBottom:12, fontSize:12,
            color:'var(--indigo)'
          }}>
            Assinaturas e parcelas conhecidas são marcadas para não duplicar no orçamento variável.
          </div>

          <button className="btn btn-primary btn-full"
            onClick={saveAll} disabled={saving}>
            {saving
              ? <><div className="spinner" style={{ width:16, height:16, margin:'0 6px 0 0' }}/>
                  Salvando...</>
              : `Confirmar e salvar ${transactions.length} transações`}
          </button>
          <button className="btn btn-ghost btn-full" style={{ marginTop:8 }}
            onClick={() => { setTransactions(null); setImage(null); setPreview(null); }}>
            Cancelar
          </button>
        </div>
      )}

      {savedMsg && (
        <div style={{
          background:'var(--green-light)', color:'var(--green)',
          borderRadius:12, padding:'14px 16px', marginTop:12,
          fontSize:14, fontWeight:600, textAlign:'center'
        }}>{savedMsg}</div>
      )}
    </div>
  );
}
