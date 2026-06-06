import { useState, useEffect } from 'react';
import { api } from '../api';

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function calcStatus(item, availBudget) {
  const preco    = Number(item.preco) || 0;
  const added    = new Date(item.data_adicionado);
  const dias     = Math.max(0, Math.floor((Date.now() - added) / 86400000));
  const ratio    = preco / Math.max(availBudget, 1);
  const aguarda30 = dias < 30;

  if (ratio > 0.5)       return { icon:'🔴', label:'Momento difícil',        cor:'var(--red)',   bg:'var(--red-light)',   pct: Math.round(ratio*100) };
  if (ratio > 0.2 || aguarda30) {
    const motivo = aguarda30 ? `Aguarde ${30-dias} dia${30-dias>1?'s':''}` : 'Impacto moderado';
    return { icon:'🟡', label: motivo, cor:'var(--amber)', bg:'var(--amber-light)', pct: Math.round(ratio*100) };
  }
  return { icon:'🟢', label:'Momento ideal!', cor:'var(--green)', bg:'var(--green-light)', pct: Math.round(ratio*100) };
}

const EMPTY_FORM = { produto:'', preco:'', loja:'', link:'', notas:'' };

export default function Wishlist() {
  const [items, setItems]       = useState([]);
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');

  const WISHLIST_HEADERS = ['id','produto','preco','loja','link','data_adicionado','notas','comprado'];

  useEffect(() => {
    Promise.all([
      api.readSheet('Wishlist').catch(() => ({ data:[] })),
      api.config().catch(() => ({ config:{} }))
    ]).then(([ws, cfg]) => {
      setItems((ws.data || []).filter(i => i.comprado !== 'sim'));
      setConfig(cfg.config);
    }).finally(() => setLoading(false));
  }, []);

  const cfg         = config || {};
  const renda       = cfg.renda_mensal || 7364;
  const fixosTotal  = (cfg.limite_inter_bloqueado || 7141) + (cfg.assinaturas_total || 937);
  const availBudget = Math.max(0, renda - fixosTotal - (cfg.budget_var || 1000));

  async function addItem() {
    if (!form.produto.trim() || !form.preco) return;
    setSaving(true);
    const id = Date.now().toString();
    const today = new Date().toISOString().split('T')[0];
    const row = [id, form.produto, Number(form.preco), form.loja, form.link, today, form.notas, 'nao'];

    try {
      // Garante que a aba existe com cabeçalhos
      const existing = await api.readSheet('Wishlist').catch(() => null);
      if (!existing || !existing.data || existing.data.length === 0) {
        await api.writeSheet('Wishlist', { rows:[WISHLIST_HEADERS, row], append:false });
      } else {
        await api.writeSheet('Wishlist', { rows:[row], append:true });
      }
      setItems(prev => [...prev, {
        id, produto:form.produto, preco:form.preco, loja:form.loja,
        link:form.link, data_adicionado:today, notas:form.notas, comprado:'nao'
      }]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setMsg('Adicionado à Wishlist!');
    } catch {
      setMsg('Erro ao salvar. Tente novamente.');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  }

  async function marcarComprado(item) {
    // Move para histórico de compras e marca como comprado
    try {
      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
      await api.registerPurchase({
        date: dateStr, item: item.produto,
        value_searched: Number(item.preco), value_paid: Number(item.preco),
        store: item.loja || '—', payment: 'pix',
        installments: 1, category: 'Outros',
        notes: `Da Wishlist. Adicionado em ${item.data_adicionado}.`
      });
      setItems(prev => prev.filter(i => i.id !== item.id));
      setMsg('Compra registrada e removida da Wishlist!');
    } catch {
      setMsg('Erro ao registrar compra.');
    }
    setTimeout(() => setMsg(''), 3000);
  }

  function remover(id) {
    setItems(prev => prev.filter(i => i.id !== id));
    setMsg('Item removido.');
    setTimeout(() => setMsg(''), 2000);
  }

  const prontos   = items.filter(i => calcStatus(i, availBudget).icon === '🟢');
  const moderados = items.filter(i => calcStatus(i, availBudget).icon === '🟡');
  const dificeis  = items.filter(i => calcStatus(i, availBudget).icon === '🔴');

  if (loading) return <div className="loading"><div className="spinner"/>Carregando...</div>;

  return (
    <div className="scroll fade-in" style={{ padding:16 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <p style={{ fontSize:20, fontWeight:700 }}>Wishlist</p>
          <p className="caption">Produtos que você quer comprar no futuro</p>
        </div>
        <button className="btn btn-primary" style={{ padding:'9px 16px', fontSize:13 }}
          onClick={() => setShowForm(true)}>
          + Adicionar
        </button>
      </div>

      {/* Resumo */}
      {items.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
          <div className="card" style={{ padding:'10px 12px', textAlign:'center',
            background:'var(--green-light)', border:'1px solid var(--green)' }}>
            <p style={{ fontSize:22, fontWeight:700, color:'var(--green)' }}>{prontos.length}</p>
            <p style={{ fontSize:11, color:'var(--green)' }}>Prontos para comprar</p>
          </div>
          <div className="card" style={{ padding:'10px 12px', textAlign:'center',
            background:'var(--amber-light)', border:'1px solid var(--amber)' }}>
            <p style={{ fontSize:22, fontWeight:700, color:'var(--amber)' }}>{moderados.length}</p>
            <p style={{ fontSize:11, color:'var(--amber)' }}>Em breve</p>
          </div>
          <div className="card" style={{ padding:'10px 12px', textAlign:'center',
            background:'var(--red-light)', border:'1px solid var(--red)' }}>
            <p style={{ fontSize:22, fontWeight:700, color:'var(--red)' }}>{dificeis.length}</p>
            <p style={{ fontSize:11, color:'var(--red)' }}>Aguardar</p>
          </div>
        </div>
      )}

      {/* Lista vazia */}
      {items.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">⭐</div>
          <p style={{ fontWeight:600, color:'var(--text)' }}>Sua Wishlist está vazia</p>
          <p className="empty-text">Adicione produtos que você quer comprar e o app te avisa quando for o momento certo.</p>
        </div>
      )}

      {/* Items — ordenados: verde primeiro */}
      {[...prontos, ...moderados, ...dificeis].map(item => {
        const status = calcStatus(item, availBudget);
        const dias   = Math.max(0, Math.floor((Date.now() - new Date(item.data_adicionado)) / 86400000));
        return (
          <div key={item.id} className="card" style={{
            marginBottom:10,
            borderLeft: `4px solid ${status.cor}`,
            background: status.icon === '🟢'
              ? 'linear-gradient(to right, rgba(5,150,105,.04), transparent)'
              : 'var(--card)'
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <span style={{ fontSize:18 }}>{status.icon}</span>
                  <p style={{ fontSize:15, fontWeight:700, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.produto}</p>
                </div>
                <p style={{ fontSize:20, fontWeight:700, color: status.cor, marginBottom:4 }}>
                  {fmt(item.preco)}
                </p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {item.loja && (
                    <span className="pill pill-gray" style={{ fontSize:11 }}>{item.loja}</span>
                  )}
                  <span className="pill" style={{
                    background: status.bg, color: status.cor, fontSize:11
                  }}>{status.label}</span>
                  <span className="pill pill-gray" style={{ fontSize:11 }}>
                    {dias === 0 ? 'Adicionado hoje' : `${dias} dia${dias>1?'s':''} na lista`}
                  </span>
                </div>
                {item.notas && (
                  <p className="caption" style={{ marginTop:6, fontStyle:'italic' }}>"{item.notas}"</p>
                )}
              </div>
            </div>

            {/* Barra de impacto */}
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <p style={{ fontSize:11, color:'var(--text-sec)' }}>Impacto no orçamento</p>
                <p style={{ fontSize:11, fontWeight:600, color: status.cor }}>{status.pct}% do disponível</p>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{
                  width: Math.min(status.pct, 100)+'%', background: status.cor
                }} />
              </div>
            </div>

            {/* Ações */}
            <div style={{ display:'flex', gap:8 }}>
              {item.link && (
                <a href={item.link} target="_blank" rel="noreferrer" style={{ flex:1, textDecoration:'none' }}>
                  <button className="btn" style={{
                    width:'100%', background:'var(--indigo-light)',
                    color:'var(--indigo)', fontSize:12, padding:'8px'
                  }}>Ver produto ↗</button>
                </a>
              )}
              {status.icon === '🟢' && (
                <button className="btn btn-primary" style={{ flex:1, fontSize:12, padding:'8px' }}
                  onClick={() => marcarComprado(item)}>
                  Comprei!
                </button>
              )}
              <button onClick={() => remover(item.id)} style={{
                background:'transparent', border:'.5px solid var(--border)',
                borderRadius:8, padding:'8px 12px', cursor:'pointer',
                color:'var(--text-ter)', fontSize:13
              }}>✕</button>
            </div>
          </div>
        );
      })}

      {/* Mensagem feedback */}
      {msg && (
        <div style={{
          background: msg.includes('Erro') ? 'var(--red-light)' : 'var(--green-light)',
          color: msg.includes('Erro') ? 'var(--red)' : 'var(--green)',
          borderRadius:12, padding:'12px 16px', marginTop:8,
          fontSize:14, fontWeight:600, textAlign:'center'
        }}>{msg}</div>
      )}

      {/* Form modal — Adicionar */}
      {showForm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
          zIndex:200, display:'flex', alignItems:'flex-end'
        }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{
            background:'var(--card)', borderRadius:'20px 20px 0 0',
            padding:20, width:'100%', maxHeight:'85vh', overflowY:'auto'
          }}>
            <div style={{
              width:40, height:4, borderRadius:2,
              background:'var(--border)', margin:'0 auto 16px'
            }} />
            <p style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>
              Adicionar à Wishlist
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Nome do produto *</p>
                <input className="input" value={form.produto}
                  onChange={e => setForm({...form, produto:e.target.value})}
                  placeholder="Ex: Kerastase Night Sérum 90ml" />
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Preço que você viu (R$) *</p>
                <input className="input" type="number" value={form.preco}
                  onChange={e => setForm({...form, preco:e.target.value})}
                  placeholder="0,00" />
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Loja / site</p>
                <input className="input" value={form.loja}
                  onChange={e => setForm({...form, loja:e.target.value})}
                  placeholder="Sephora, Beleza na Web, Amazon..." />
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Link do produto</p>
                <input className="input" value={form.link}
                  onChange={e => setForm({...form, link:e.target.value})}
                  placeholder="https://..." />
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Notas</p>
                <textarea className="input"
                  value={form.notas}
                  onChange={e => setForm({...form, notas:e.target.value})}
                  placeholder="Por que quer, onde achou, comparações..."
                  style={{ minHeight:56, resize:'vertical' }} />
              </div>

              <div style={{
                background:'var(--indigo-light)', borderRadius:10,
                padding:'10px 14px', fontSize:12, color:'var(--indigo)'
              }}>
                💡 O app vai calcular automaticamente quando será o melhor momento para comprar, baseado no seu orçamento mensal e nos 30 dias na lista.
              </div>
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop:16 }}
              onClick={addItem} disabled={saving || !form.produto || !form.preco}>
              {saving ? 'Salvando...' : 'Adicionar à Wishlist'}
            </button>
            <button className="btn btn-full" style={{
              marginTop:8, background:'var(--bg)', color:'var(--text-sec)'
            }} onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
