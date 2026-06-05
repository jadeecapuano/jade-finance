import { useState, useEffect } from 'react';
import { api } from '../api';

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

const MASLOW_MAP = { 1:'🔴', 2:'🟠', 3:'🟡', 4:'🟢', 5:'🔵' };

export default function Historico() {
  const [purchases, setPurchases] = useState([]);
  const [filter, setFilter]       = useState('all');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.readSheet('Compras')
      .then(r => setPurchases(r.data || []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = purchases.filter(p => {
    if (filter === 'impulso') return p.impulso === 'Sim';
    if (filter === 'parcelado') return Number(p.parcelas) > 1;
    return true;
  });

  const total     = filtered.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const impulsos  = purchases.filter(p => p.impulso === 'Sim').length;
  const avgTicket = purchases.length > 0 ? total / purchases.length : 0;

  // Spending by category
  const byCat = {};
  purchases.forEach(p => {
    const c = p.categoria || 'Outros';
    byCat[c] = (byCat[c] || 0) + Number(p.valor_pago || 0);
  });
  const sortedCats = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  const maxCat = sortedCats[0]?.[1] || 1;

  const CAT_COLORS = {
    'Tecnologia':'#3B82F6','Roupas':'#EC4899','Saúde':'#10B981','Beleza':'#F59E0B',
    'Alimentação':'#8B5CF6','Lazer':'#6366F1','Suplementos':'#14B8A6','Casa':'#84CC16',
    'Livros':'#F97316','Presentes':'#EF4444','Outros':'#9CA3AF'
  };

  if (loading) return <div className="loading"><div className="spinner"/>Carregando...</div>;

  return (
    <div className="scroll fade-in" style={{ padding:16 }}>

      <p style={{ fontSize:20, fontWeight:700, marginBottom:16 }}>Histórico de compras</p>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
        <div className="card" style={{ padding:'10px 12px', textAlign:'center' }}>
          <p className="label-sm">total</p>
          <p style={{ fontSize:16, fontWeight:700 }}>{fmt(total)}</p>
          <p className="caption">{purchases.length} compras</p>
        </div>
        <div className="card" style={{ padding:'10px 12px', textAlign:'center' }}>
          <p className="label-sm">ticket médio</p>
          <p style={{ fontSize:16, fontWeight:700 }}>{fmt(avgTicket)}</p>
        </div>
        <div className="card" style={{ padding:'10px 12px', textAlign:'center' }}>
          <p className="label-sm">por impulso</p>
          <p style={{
            fontSize:16, fontWeight:700,
            color: impulsos > 0 ? 'var(--red)' : 'var(--green)'
          }}>
            {purchases.length > 0 ? Math.round(impulsos/purchases.length*100) : 0}%
          </p>
          <p className="caption">{impulsos} compras</p>
        </div>
      </div>

      {/* Category breakdown */}
      {sortedCats.length > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <p style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>Por categoria</p>
          {sortedCats.map(([cat, val]) => (
            <div key={cat} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:13 }}>{cat}</span>
                <span style={{ fontSize:13, fontWeight:600 }}>{fmt(val)}</span>
              </div>
              <div style={{ background:'var(--bg)', borderRadius:4, height:5, overflow:'hidden' }}>
                <div style={{
                  width: Math.round(val/maxCat*100)+'%', height:'100%',
                  background: CAT_COLORS[cat] || '#9CA3AF', borderRadius:4
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {[['all','Todas'],['impulso','Impulso'],['parcelado','Parceladas']].map(([id, label]) => (
          <button key={id}
            onClick={() => setFilter(id)}
            className={`pill ${filter === id ? 'pill-indigo' : 'pill-gray'}`}
            style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛍️</div>
          <p className="empty-text">Nenhuma compra registrada ainda.</p>
        </div>
      ) : (
        filtered.map((p, i) => (
          <div key={i} className="card" style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{
                  fontSize:14, fontWeight:600, overflow:'hidden',
                  whiteSpace:'nowrap', textOverflow:'ellipsis'
                }}>{p.item}</p>
                <p className="caption">
                  {p.data} · {p.loja}
                  {p.maslow_nivel && <span style={{ marginLeft:6 }}>{MASLOW_MAP[p.maslow_nivel]}</span>}
                </p>
              </div>
              <div style={{ textAlign:'right', marginLeft:12 }}>
                <p style={{ fontSize:15, fontWeight:700 }}>{fmt(p.valor_pago)}</p>
                <p className="caption">
                  {p.pagamento === 'pix' ? 'PIX' :
                   p.pagamento === 'credito' ? '1× Inter' :
                   `${p.parcelas}× Inter`}
                </p>
              </div>
            </div>
            <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
              {p.categoria && (
                <span className="pill pill-gray" style={{ fontSize:11 }}>{p.categoria}</span>
              )}
              {p.impulso === 'Sim' && (
                <span className="pill pill-red" style={{ fontSize:11 }}>Impulso</span>
              )}
              {Number(p.parcelas) > 1 && (
                <span className="pill pill-amber" style={{ fontSize:11 }}>
                  {p.parcelas}× parcelado
                </span>
              )}
            </div>
            {p.notas && (
              <p className="caption" style={{ marginTop:6, fontStyle:'italic' }}>"{p.notas}"</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
