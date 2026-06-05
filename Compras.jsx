import { useState, useEffect } from 'react';
import { api } from '../api';

const MASLOW = [
  { nivel:1, icon:'🔴', nome:'Urgência',      cor:'#EF4444', bg:'#FFF1F2',
    analise:'Compra justificada mesmo com orçamento apertado.',
    desafio: null },
  { nivel:2, icon:'🟠', nome:'Trabalho/Saúde', cor:'#F97316', bg:'#FFF7ED',
    analise:'Impacto direto na sua renda ou saúde. Vale priorizar.',
    desafio: null },
  { nivel:3, icon:'🟡', nome:'Conexão',        cor:'#EAB308', bg:'#FEFCE8',
    analise:'Compra relacional. Analise se o valor está dentro do confortável.',
    desafio:'Existe uma opção mais acessível com o mesmo valor afetivo?' },
  { nivel:4, icon:'🟢', nome:'Crescimento',    cor:'#22C55E', bg:'#F0FDF4',
    analise:'Investimento em você. Ótimo — mas verifique o momento financeiro.',
    desafio:'Tem versão mais acessível ou gratuita?' },
  { nivel:5, icon:'🔵', nome:'Prazer/Status',  cor:'#3B82F6', bg:'#EFF6FF',
    analise:'Desejo legítimo. Considerando suas metas, avalie o momento.',
    desafio:'Se esperar 30 dias e ainda quiser, provavelmente vale.' },
];

const LIVELO = [
  { nome:'Mag. Luiza',  pts:2.0 }, { nome:'Casas Bahia', pts:2.0 },
  { nome:'Ponto',       pts:2.0 }, { nome:'Amazon',      pts:1.5 },
  { nome:'Americanas',  pts:1.5 }, { nome:'Kabum',       pts:1.0 },
  { nome:'ML',          pts:1.0 }, { nome:'Shopee',      pts:0.5 },
];

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

export default function Compras() {
  const [query, setQuery]         = useState('');
  const [preco, setPreco]         = useState('');
  const [parcelas, setParcelas]   = useState(1);
  const [maslow, setMaslow]       = useState(null);
  const [isRepos, setIsRepos]     = useState(false);
  const [results, setResults]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [config, setConfig]       = useState(null);
  const [showBuy, setShowBuy]     = useState(false);
  const [buyForm, setBuyForm]     = useState({
    store:'', valuePaid:'', payment:'pix', installments:1,
    category:'Outros', impulse:false, needLevel:'media', notes:''
  });
  const [savedMsg, setSavedMsg]   = useState('');

  useEffect(() => { api.config().then(r => setConfig(r.config)).catch(() => {}); }, []);

  function search() {
    if (!query.trim()) return;
    // Abre busca em sites externos em novas abas
    const q = encodeURIComponent(query);
    window.open(`https://www.zoom.com.br/busca/?q=${q}`, '_blank');
    window.open(`https://www.google.com/search?tbm=shop&q=${q}`, '_blank');
    setResults({ external: true, query });
  }

  const cfg     = config || {};
  const dispMes = (cfg.renda_mensal||7364) - 4000 - (cfg.budget_var||1000); // simplified
  const dispInt = Math.max(0, (cfg.limite_inter_total||11370) - (cfg.limite_inter_bloqueado||7141) - (cfg.assinaturas_total||937));
  const p       = Number(preco) || 0;
  const parcelaMensal = p > 0 && parcelas > 1 ? p / parcelas : p;

  let viabilidade = null, pagRec = null;
  if (p > 0) {
    const ratio = p / Math.max(dispMes, 1);
    if (ratio > 0.6) viabilidade = { label:'Alto impacto', color:'var(--red)', bg:'var(--red-light)' };
    else if (ratio > 0.3) viabilidade = { label:'Impacto moderado', color:'var(--amber)', bg:'var(--amber-light)' };
    else viabilidade = { label:'Baixo impacto', color:'var(--green)', bg:'var(--green-light)' };

    if (parcelas > 6) pagRec = { label:`⚠️ ${parcelas}× — verifique juros`, color:'var(--amber)' };
    else if (p <= 80) pagRec = { label:'PIX — mais simples', color:'var(--green)' };
    else if (p > dispInt) pagRec = { label:'PIX — limite Inter insuficiente', color:'var(--amber)' };
    else if (parcelas === 1 && p <= 400) pagRec = { label:'PIX ou 1× no Inter', color:'var(--green)' };
    else pagRec = { label:`${parcelas}× sem juros no Inter`, color:'var(--green)' };
  }

  async function savePurchase() {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
    const mObj = maslow ? MASLOW.find(m => m.nivel === maslow) : null;
    try {
      await api.registerPurchase({
        date: dateStr, item: query,
        value_searched: Number(results?.results?.[0]?.price || preco),
        value_paid: Number(buyForm.valuePaid || preco),
        store: buyForm.store, payment: buyForm.payment,
        installments: Number(buyForm.installments),
        category: buyForm.category,
        maslow_level: maslow, maslow_name: mObj?.nome,
        impulse: buyForm.impulse, need_level: buyForm.needLevel,
        notes: buyForm.notes
      });
      setSavedMsg('Compra registrada na planilha!');
      setShowBuy(false);
      setTimeout(() => setSavedMsg(''), 3000);
    } catch {
      setSavedMsg('Erro ao salvar. Tente novamente.');
    }
  }

  return (
    <div className="scroll fade-in" style={{ padding: 16 }}>

      {/* Financial health mini */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        <div className="card" style={{ padding:'10px 12px' }}>
          <p className="label-sm">disponível mês</p>
          <p className="val-md indigo">{fmt(Math.max(0, dispMes))}</p>
        </div>
        <div className="card" style={{ padding:'10px 12px' }}>
          <p className="label-sm">limite inter livre</p>
          <p className="val-md" style={{ color: dispInt > 1000 ? 'var(--green)' : 'var(--amber)' }}>
            {fmt(dispInt)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 14 }}>
        <p style={{ fontSize:15, fontWeight:700, marginBottom:10 }}>O que você quer comprar?</p>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input className="input" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Nome do produto..."
          />
          <button className="btn btn-primary" onClick={search}
            style={{ whiteSpace:'nowrap', padding:'10px 14px' }}>
            Buscar
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <p className="label-sm" style={{ marginBottom:4 }}>Preço estimado</p>
            <input className="input" type="number" value={preco}
              onChange={e => setPreco(e.target.value)} placeholder="R$ 0,00" />
          </div>
          <div>
            <p className="label-sm" style={{ marginBottom:4 }}>Parcelas</p>
            <select className="input" value={parcelas} onChange={e => setParcelas(Number(e.target.value))}>
              {[1,2,3,4,6,10,12].map(n => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}×`}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Reposição toggle */}
      <div className="card" style={{
        marginBottom:14, display:'flex', alignItems:'center', gap:12,
        background: isRepos ? '#F5F3FF' : 'var(--card)',
        border: isRepos ? '1.5px solid var(--indigo)' : '0.5px solid var(--border)'
      }} onClick={() => setIsRepos(!isRepos)}>
        <span style={{ fontSize:22 }}>🔁</span>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:14, fontWeight:600 }}>É uma reposição de rotina?</p>
          <p className="caption">Shampoo, suplemento, algo que acabou e precisa repor</p>
        </div>
        <div style={{
          width:24, height:24, borderRadius:12,
          background: isRepos ? 'var(--indigo)' : 'var(--border)',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'background .2s'
        }}>
          {isRepos && <span style={{ color:'#fff', fontSize:14 }}>✓</span>}
        </div>
      </div>

      {/* Maslow selector */}
      {!isRepos && (
        <div className="card" style={{ marginBottom:14 }}>
          <p style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>
            Nível de necessidade
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {MASLOW.map(m => (
              <div key={m.nivel}
                onClick={() => setMaslow(maslow === m.nivel ? null : m.nivel)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 12px', borderRadius:10,
                  background: maslow === m.nivel ? m.bg : 'var(--bg)',
                  border: `1.5px solid ${maslow === m.nivel ? m.cor : 'transparent'}`,
                  cursor:'pointer', transition:'all .15s'
                }}>
                <span style={{ fontSize:18 }}>{m.icon}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:600, color: maslow === m.nivel ? m.cor : 'var(--text)' }}>
                    {m.nome}
                  </p>
                  {maslow === m.nivel && (
                    <p style={{ fontSize:11, color:'var(--text-sec)', marginTop:2 }}>{m.analise}</p>
                  )}
                  {maslow === m.nivel && m.desafio && (
                    <p style={{ fontSize:11, color:'var(--text-ter)', marginTop:3, fontStyle:'italic' }}>
                      💭 {m.desafio}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis */}
      {p > 0 && viabilidade && (
        <div style={{
          background: viabilidade.bg, borderRadius:14,
          padding:'14px 16px', marginBottom:14,
          borderLeft: `4px solid ${viabilidade.color}`
        }}>
          <p style={{ fontSize:14, fontWeight:700, color: viabilidade.color, marginBottom:4 }}>
            {viabilidade.label}
          </p>
          <p className="caption" style={{ marginBottom:10 }}>
            {fmt(p)} representa {Math.round(p/Math.max(dispMes,1)*100)}% do disponível este mês
          </p>
          {pagRec && (
            <div style={{
              background:'rgba(255,255,255,.65)', borderRadius:10, padding:'10px 12px'
            }}>
              <p className="label-sm" style={{ marginBottom:3 }}>Melhor forma de pagar</p>
              <p style={{ fontSize:15, fontWeight:700, color: pagRec.color }}>{pagRec.label}</p>
              {parcelas > 1 && (
                <p className="caption" style={{ marginTop:2 }}>
                  {fmt(parcelaMensal)}/mês por {parcelas} meses
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Livelo */}
      {p > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <p style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>
            🟠 Pontos Livelo por loja
          </p>
          {LIVELO.map(l => {
            const pts = Math.round(p * l.pts);
            const efetivo = p - pts * 0.01;
            return (
              <div key={l.nome} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'7px 0', borderBottom:'0.5px solid var(--border)'
              }}>
                <p style={{ flex:1, fontSize:13, fontWeight:500 }}>{l.nome}</p>
                <p style={{ fontSize:12, color:'#F97316', fontWeight:600 }}>{pts} pts</p>
                <p style={{ fontSize:11, color:'var(--green)' }}>≈ {fmt(efetivo)}</p>
              </div>
            );
          })}
          <p className="caption" style={{ marginTop:8 }}>
            1 ponto = R$0,01 em resgate básico. Verifique campanhas ativas no app Livelo.
          </p>
        </div>
      )}

      {/* Search results */}
      {results?.external && (
        <div className="card" style={{ marginBottom:14, borderLeft:'4px solid var(--indigo)' }}>
          <p style={{ fontSize:14, fontWeight:700, marginBottom:6, color:'var(--indigo)' }}>
            Abrindo comparativo de preços...
          </p>
          <p className="caption" style={{ marginBottom:10 }}>
            Verifique as abas que abriram com os resultados do <strong>Zoom</strong> (histórico de preços) e do <strong>Google Shopping</strong> (todos os sites).
          </p>
          <p style={{ fontSize:13, color:'var(--text-sec)' }}>
            Encontrou o melhor preço? Digite o valor abaixo e veja a análise financeira.
          </p>
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            <a href={`https://www.zoom.com.br/busca/?q=${encodeURIComponent(query)}`}
               target="_blank" rel="noreferrer"
               style={{ textDecoration:'none' }}>
              <div className="pill pill-indigo" style={{ cursor:'pointer', padding:'6px 14px', fontSize:12 }}>
                Zoom — histórico de preços ↗
              </div>
            </a>
            <a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`}
               target="_blank" rel="noreferrer"
               style={{ textDecoration:'none' }}>
              <div className="pill pill-gray" style={{ cursor:'pointer', padding:'6px 14px', fontSize:12 }}>
                Google Shopping ↗
              </div>
            </a>
          </div>
        </div>
      )}

      {/* Buy button */}
      {query && (
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-full"
            onClick={() => setShowBuy(true)}>
            Comprei — registrar na planilha
          </button>
        </div>
      )}

      {savedMsg && (
        <div style={{
          background:'var(--green-light)', color:'var(--green)',
          borderRadius:12, padding:'12px 16px', marginTop:12,
          fontSize:14, fontWeight:500, textAlign:'center'
        }}>{savedMsg}</div>
      )}

      {/* Buy form modal */}
      {showBuy && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
          zIndex:200, display:'flex', alignItems:'flex-end'
        }} onClick={e => e.target === e.currentTarget && setShowBuy(false)}>
          <div style={{
            background:'var(--card)', borderRadius:'20px 20px 0 0',
            padding:20, width:'100%', maxHeight:'80vh', overflowY:'auto'
          }}>
            <div style={{
              width:40, height:4, borderRadius:2,
              background:'var(--border)', margin:'0 auto 16px'
            }} />
            <p style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>
              Registrar compra
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Valor pago</p>
                <input className="input" type="number"
                  value={buyForm.valuePaid}
                  onChange={e => setBuyForm({...buyForm, valuePaid:e.target.value})}
                  placeholder={preco || '0,00'} />
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Loja</p>
                <input className="input" value={buyForm.store}
                  onChange={e => setBuyForm({...buyForm, store:e.target.value})}
                  placeholder="Amazon, Magazine Luiza..." />
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Pagamento</p>
                <select className="input" value={buyForm.payment}
                  onChange={e => setBuyForm({...buyForm, payment:e.target.value})}>
                  <option value="pix">PIX</option>
                  <option value="credito">1× no Inter</option>
                  <option value="parcelado">Parcelado no Inter</option>
                </select>
              </div>
              {buyForm.payment === 'parcelado' && (
                <div>
                  <p className="label-sm" style={{ marginBottom:4 }}>Número de parcelas</p>
                  <input className="input" type="number"
                    value={buyForm.installments}
                    onChange={e => setBuyForm({...buyForm, installments:Number(e.target.value)})}
                    min={2} max={24} />
                </div>
              )}
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Categoria</p>
                <select className="input" value={buyForm.category}
                  onChange={e => setBuyForm({...buyForm, category:e.target.value})}>
                  {['Alimentação','Transporte','Saúde','Beleza','Roupas','Lazer',
                    'Suplementos','Tecnologia','Casa','Livros','Presentes','Outros']
                    .map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:6 }}>Foi por impulso?</p>
                <div style={{ display:'flex', gap:8 }}>
                  {[false,true].map(v => (
                    <button key={String(v)}
                      onClick={() => setBuyForm({...buyForm, impulse:v})}
                      className="btn"
                      style={{
                        flex:1, padding:'10px',
                        background: buyForm.impulse === v
                          ? (v ? 'var(--red-light)' : 'var(--green-light)')
                          : 'var(--bg)',
                        color: buyForm.impulse === v
                          ? (v ? 'var(--red)' : 'var(--green)')
                          : 'var(--text-sec)',
                        border: `1.5px solid ${buyForm.impulse === v ? (v ? 'var(--red)' : 'var(--green)') : 'transparent'}`
                      }}>
                      {v ? 'Sim' : 'Não'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Notas</p>
                <textarea className="input"
                  value={buyForm.notes}
                  onChange={e => setBuyForm({...buyForm, notes:e.target.value})}
                  placeholder="Onde achou, quanto economizou..."
                  style={{ minHeight:60, resize:'vertical' }} />
              </div>
            </div>

            <button className="btn btn-primary btn-full" style={{ marginTop:16 }}
              onClick={savePurchase}>
              Salvar na planilha
            </button>
            <button className="btn btn-ghost btn-full" style={{ marginTop:8 }}
              onClick={() => setShowBuy(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
