import { useState } from 'react';
import { api } from '../api';

const KNOWN_SUBS = ['spotify','netflix','disney','amazon prime','youtube','hbo',
  'globoplay','vidya','wellhub','gympass','anthropic','claude','rappi','ifood',
  'nubank','apple','microsoft','adobe','canva','notion'];

const BANCOS = [
  { id:'inter',  label:'Inter',  color:'#EA580C' },
  { id:'nubank', label:'Nubank', color:'#7C3AED' },
  { id:'itau',   label:'Itaú',   color:'#F97316' },
  { id:'outro',  label:'Outro',  color:'#6B7280' },
];

const CATS = ['Alimentação','Transporte','Saúde','Beleza','Roupas','Lazer',
              'Suplementos','Tecnologia','Casa','Assinatura','Parcela','Transferência','Outros'];

export default function Extrato() {
  const [banco, setBanco]               = useState('inter');
  const [images, setImages]             = useState([]);   // [{file, preview, banco}]
  const [loading, setLoading]           = useState(false);
  const [progress, setProgress]         = useState('');
  const [transactions, setTransactions] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [savedMsg, setSavedMsg]         = useState('');
  const [error, setError]               = useState('');

  function handleFiles(files) {
    const novos = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      banco,
      id: Math.random().toString(36).slice(2)
    }));
    setImages(prev => [...prev, ...novos]);
    setTransactions(null);
    setError('');
  }

  function removeImage(id) {
    setImages(prev => prev.filter(img => img.id !== id));
    if (images.length <= 1) setTransactions(null);
  }

  function updateImageBanco(id, novoBanco) {
    setImages(prev => prev.map(img => img.id === id ? {...img, banco: novoBanco} : img));
  }

  async function processAll() {
    if (!images.length) return;
    setLoading(true); setError(''); setTransactions(null);

    const allTransactions = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      setProgress(`Processando imagem ${i + 1} de ${images.length} (${img.banco})...`);

      try {
        const base64 = await toBase64(img.file);
        const media_type = img.file.type || 'image/png';
        const result = await api.ocr({ image_base64: base64, banco: img.banco, media_type });
        const txns = (result.transactions || []).map(t => ({
          ...t,
          _banco: img.banco,
          _imgId: img.id
        }));
        allTransactions.push(...txns);
      } catch (e) {
        setError(`Erro na imagem ${i + 1}. Verifique se a imagem está nítida e tente novamente.`);
      }
    }

    setProgress('');
    if (allTransactions.length > 0) {
      setTransactions(allTransactions);
    } else if (!error) {
      setError('Nenhuma transação encontrada. Tente com imagens mais nítidas ou de melhor qualidade.');
    }
    setLoading(false);
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function updateTxn(i, field, value) {
    setTransactions(prev => prev.map((t, idx) => idx === i ? {...t, [field]: value} : t));
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
      setImages([]);
    } catch {
      setSavedMsg('Erro ao salvar. Tente novamente.');
    }
    setSaving(false);
    setTimeout(() => setSavedMsg(''), 4000);
  }

  return (
    <div className="scroll fade-in" style={{ padding:16 }}>

      <p style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Extrato da semana</p>
      <p className="caption" style={{ marginBottom:16 }}>
        Selecione uma ou várias imagens de extratos. Cada imagem pode ser de um banco diferente.
      </p>

      {/* Banco padrão para novas imagens */}
      <div className="card" style={{ marginBottom:14 }}>
        <p className="label-sm" style={{ marginBottom:8 }}>Banco padrão ao adicionar imagens</p>
        <div style={{ display:'flex', gap:8 }}>
          {BANCOS.map(b => (
            <button key={b.id} onClick={() => setBanco(b.id)} style={{
              flex:1, padding:'8px 4px', borderRadius:10, border:'none',
              background: banco === b.id ? b.color : 'var(--bg)',
              color: banco === b.id ? '#fff' : 'var(--text-sec)',
              fontWeight:600, fontSize:12, cursor:'pointer', transition:'all .15s'
            }}>{b.label}</button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div
        onClick={() => document.getElementById('file-input').click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${images.length ? 'var(--indigo)' : 'var(--border)'}`,
          borderRadius:16, padding: images.length ? '14px' : '28px',
          cursor:'pointer', marginBottom:14, background:'var(--card)',
          textAlign: images.length ? 'left' : 'center', transition:'all .2s'
        }}>
        <input id="file-input" type="file" accept="image/*" multiple
          style={{ display:'none' }}
          onChange={e => handleFiles(e.target.files)} />

        {images.length === 0 ? (
          <>
            <div style={{ fontSize:36, marginBottom:8, opacity:.4 }}>📱</div>
            <p style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>
              Toque para selecionar imagens
            </p>
            <p className="caption">Pode selecionar várias de uma vez — cada uma pode ser de um banco diferente</p>
          </>
        ) : (
          <>
            {/* Grid de previews */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
              {images.map(img => (
                <div key={img.id} style={{ position:'relative', width:80 }}>
                  <img src={img.preview} alt="" style={{
                    width:80, height:80, borderRadius:10, objectFit:'cover', display:'block'
                  }} />
                  {/* Badge banco */}
                  <div style={{
                    position:'absolute', bottom:2, left:2, right:2,
                    background:'rgba(0,0,0,.6)', borderRadius:6, padding:'2px 4px',
                    display:'flex', justifyContent:'space-between', alignItems:'center'
                  }}>
                    <select
                      value={img.banco}
                      onChange={e => { e.stopPropagation(); updateImageBanco(img.id, e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        background:'transparent', border:'none', color:'#fff',
                        fontSize:9, padding:0, flex:1, cursor:'pointer'
                      }}>
                      {BANCOS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                    <span
                      onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                      style={{ color:'#fff', fontSize:12, cursor:'pointer', paddingLeft:2 }}>✕</span>
                  </div>
                </div>
              ))}
              {/* Botão adicionar mais */}
              <div style={{
                width:80, height:80, borderRadius:10, border:'2px dashed var(--border)',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', color:'var(--text-ter)', fontSize:28
              }} onClick={() => document.getElementById('file-input').click()}>+</div>
            </div>
            <p className="caption">{images.length} imagem(ns) selecionada(s) — toque em + para adicionar mais</p>
          </>
        )}
      </div>

      {/* Botão processar */}
      {images.length > 0 && !transactions && (
        <button className="btn btn-primary btn-full" style={{ marginBottom:14 }}
          onClick={processAll} disabled={loading}>
          {loading
            ? <><div className="spinner" style={{ width:16, height:16, margin:'0 6px 0 0' }}/>
                {progress || 'Processando...'}</>
            : `Processar ${images.length} imagem${images.length > 1 ? 'ns' : ''} com IA`}
        </button>
      )}

      {error && (
        <div style={{
          background:'var(--red-light)', color:'var(--red)',
          borderRadius:12, padding:14, fontSize:13, marginBottom:14
        }}>{error}</div>
      )}

      {/* Review das transações */}
      {transactions && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ fontSize:15, fontWeight:700 }}>
              {transactions.length} transações encontradas
            </p>
            <span className="pill pill-indigo">Revise antes de salvar</span>
          </div>

          {/* Agrupar por banco */}
          {BANCOS.filter(b => transactions.some(t => t._banco === b.id)).map(b => {
            const txnsDoBanco = transactions.filter(t => t._banco === b.id);
            return (
              <div key={b.id} style={{ marginBottom:14 }}>
                <p style={{
                  fontSize:12, fontWeight:700, color: b.color,
                  marginBottom:6, paddingLeft:2
                }}>{b.label} — {txnsDoBanco.length} transações</p>
                {txnsDoBanco.map((t, absIdx) => {
                  const realIdx = transactions.indexOf(t);
                  const isSub = KNOWN_SUBS.some(s => t.description?.toLowerCase().includes(s));
                  return (
                    <div key={realIdx} className="card" style={{
                      marginBottom:8,
                      borderLeft: `4px solid ${isSub || t.is_installment ? 'var(--amber)' : t.type === 'credit' ? 'var(--green)' : 'var(--indigo)'}`
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:13, fontWeight:600, wordBreak:'break-word' }}>
                            {t.description_resolved || t.description}
                          </p>
                          {t.date && <p className="caption">{t.date}</p>}
                          <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                            {isSub && <span className="pill pill-amber" style={{ fontSize:10 }}>Assinatura</span>}
                            {t.is_installment && <span className="pill pill-amber" style={{ fontSize:10 }}>Parcela {t.installment_info}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, marginLeft:8 }}>
                          <p style={{
                            fontSize:15, fontWeight:700,
                            color: t.type === 'credit' ? 'var(--green)' : 'var(--text)'
                          }}>
                            {t.type === 'credit' ? '+' : '-'} R$ {Number(t.amount).toFixed(2)}
                          </p>
                          <button onClick={() => removeTxn(realIdx)} style={{
                            background:'transparent', border:'none', cursor:'pointer',
                            color:'var(--text-ter)', fontSize:16
                          }}>✕</button>
                        </div>
                      </div>
                      <select className="input" style={{ fontSize:12, padding:'6px 10px' }}
                        value={t.category || 'Outros'}
                        onChange={e => updateTxn(realIdx, 'category', e.target.value)}>
                        {CATS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{
            background:'var(--indigo-light)', borderRadius:12,
            padding:'10px 14px', marginBottom:12, fontSize:12, color:'var(--indigo)'
          }}>
            Assinaturas e parcelas são marcadas automaticamente para não duplicar no orçamento variável.
          </div>

          <button className="btn btn-primary btn-full"
            onClick={saveAll} disabled={saving} style={{ marginBottom:8 }}>
            {saving
              ? <><div className="spinner" style={{ width:16, height:16, margin:'0 6px 0 0' }}/>Salvando...</>
              : `Confirmar e salvar ${transactions.length} transações`}
          </button>
          <button className="btn btn-full" style={{ background:'var(--bg)', color:'var(--text-sec)' }}
            onClick={() => { setTransactions(null); setImages([]); }}>
            Cancelar e recomeçar
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
