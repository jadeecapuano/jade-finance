import { useState, useEffect } from 'react';
import { api } from '../api';

const MASLOW = [
  { nivel:1, icon:'🔴', nome:'Urgência',       cor:'#EF4444', bg:'#FFF1F2',
    analise:'Compra justificada mesmo com o mês apertado.',
    desafio:null },
  { nivel:2, icon:'🟠', nome:'Trabalho/Saúde', cor:'#F97316', bg:'#FFF7ED',
    analise:'Impacto direto na sua renda ou saúde. Vale priorizar.',
    desafio:null },
  { nivel:3, icon:'🟡', nome:'Conexão',        cor:'#EAB308', bg:'#FEFCE8',
    analise:'Compra relacional. Analise se está dentro do confortável.',
    desafio:'Existe uma opção mais acessível com o mesmo efeito?' },
  { nivel:4, icon:'🟢', nome:'Crescimento',    cor:'#22C55E', bg:'#F0FDF4',
    analise:'Investimento em você. Verifique se o momento permite.',
    desafio:'Tem versão mais acessível ou gratuita?' },
  { nivel:5, icon:'🔵', nome:'Prazer/Status',  cor:'#3B82F6', bg:'#EFF6FF',
    analise:'Desejo legítimo. Considerando suas metas, avalie o momento.',
    desafio:'Se esperar 30 dias e ainda quiser, provavelmente vale.' },
];

const LIVELO = [
  {nome:'Mag. Luiza', pts:2.0}, {nome:'Casas Bahia', pts:2.0},
  {nome:'Ponto',      pts:2.0}, {nome:'Amazon',      pts:1.5},
  {nome:'Americanas', pts:1.5}, {nome:'Kabum',       pts:1.0},
  {nome:'ML',         pts:1.0}, {nome:'Shopee',      pts:0.5},
];

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

export default function Compras() {
  const [produto, setProduto]   = useState('');
  const [preco, setPreco]       = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [maslow, setMaslow]     = useState(null);
  const [isRepos, setIsRepos]   = useState(false);
  const [config, setConfig]     = useState(null);
  const [showBuy, setShowBuy]   = useState(false);
  const [buyForm, setBuyForm]   = useState({
    store:'', payment:'pix', installments:1,
    category:'Outros', impulse:false, needLevel:'media', notes:''
  });
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    api.config().then(r => setConfig(r.config)).catch(() => {});
  }, []);

  const cfg     = config || {};
  const renda   = cfg.renda_mensal || 7364;
  const budVar  = cfg.budget_var   || 1000;
  const fixos   = (cfg.limite_inter_bloqueado || 7141) + (cfg.assinaturas_total || 937);
  const dispMes = Math.max(0, renda - fixos - budVar);
  const dispInt = Math.max(0, (cfg.limite_inter_total||11370) - (cfg.limite_inter_bloqueado||7141) - (cfg.assinaturas_total||937));
  const p       = Number(preco) || 0;
  const parcelaMensal = p > 0 && parcelas > 1 ? p / parcelas : p;

  // Análise financeira
  let analise = null;
  if (p > 0) {
    const ratio = p / Math.max(dispMes, 1);
    const pct   = Math.round(ratio * 100);
    let veredicto, cls, cor;
    if (ratio > 0.6) { veredicto='Alto impacto';    cls='bad';   cor='var(--red)';   }
    else if (ratio > 0.3) { veredicto='Impacto moderado'; cls='warn'; cor='var(--amber)'; }
    else { veredicto='Baixo impacto';   cls='go';    cor='var(--green)'; }

    let pagRec, motivo;
    if (parcelas > 6) {
      pagRec='⚠️ Parcelamento longo — verifique juros';
      motivo='Acima de 6× costuma ter juros embutidos. Prefira PIX com desconto.';
    } else if (p <= 80) {
      pagRec='PIX';
      motivo='Valor pequeno — PIX é mais simples e sem usar limite do Inter.';
    } else if (p > dispInt) {
      pagRec='PIX — limite do Inter insuficiente';
      motivo=`Você tem ${fmt(dispInt)} disponível no Inter. Para esta compra, PIX é o melhor caminho.`;
    } else if (parcelas === 1 && p <= 400) {
      pagRec='PIX ou 1× no Inter';
      motivo='Prefira PIX para preservar o limite. Use cartão só se houver benefício.';
    } else {
      pagRec=`${parcelas}× sem juros no Inter`;
      motivo=`Parcela de ${fmt(parcelaMensal)}/mês. Confirme antes que não há juros.`;
    }

    const mObj = maslow ? MASLOW.find(m => m.nivel === maslow) : null;
    analise = { veredicto, cls, cor, pct, pagRec, motivo, mObj };
  }

  function buscarAlternativas() {
    if (!produto.trim()) return;
    const q = encodeURIComponent(`${produto} alternativas mais baratas`);
    window.open(`https://www.google.com/search?q=${q}`, '_blank');
  }

  async function savePurchase() {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
    const mObj = maslow ? MASLOW.find(m => m.nivel === maslow) : null;
    try {
      await api.registerPurchase({
        date: dateStr, item: produto || 'Item',
        value_searched: p, value_paid: Number(buyForm.valuePaid || preco),
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
    <div className="scroll fade-in" style={{ padding:16 }}>

      {/* Cards saúde financeira */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        <div className="card" style={{ padding:'10px 12px' }}>
          <p className="label-sm">disponível mês</p>
          <p className="val-md" style={{ color: dispMes > 500 ? 'var(--green)' : 'var(--amber)' }}>
            {fmt(dispMes)}
          </p>
        </div>
        <div className="card" style={{ padding:'10px 12px' }}>
          <p className="label-sm">limite inter livre</p>
          <p className="val-md" style={{ color: dispInt > 1000 ? 'var(--green)' : 'var(--amber)' }}>
            {fmt(dispInt)}
          </p>
        </div>
      </div>

      {/* Formulário principal */}
      <div className="card" style={{ marginBottom:14 }}>
        <p style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Analisar uma compra</p>

        <div style={{ marginBottom:10 }}>
          <p className="label-sm" style={{ marginBottom:4 }}>Nome do produto</p>
          <input className="input" value={produto}
            onChange={e => setProduto(e.target.value)}
            placeholder="Ex: Kerastase Night Sérum, tênis Nike, iPhone..." />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <p className="label-sm" style={{ marginBottom:4 }}>Preço (R$)</p>
            <input className="input" type="number" value={preco}
              onChange={e => setPreco(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <p className="label-sm" style={{ marginBottom:4 }}>Parcelas</p>
            <select className="input" value={parcelas}
              onChange={e => setParcelas(Number(e.target.value))}>
              {[1,2,3,4,6,10,12].map(n =>
                <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}×`}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Busca Google Shopping — antes da análise */}
      {produto && (
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(produto)}`}
            target="_blank" rel="noreferrer" style={{ flex:1, textDecoration:'none' }}>
            <button className="btn btn-secondary btn-full" style={{ fontSize:13 }}>
              Ver preços no Google Shopping ↗
            </button>
          </a>
          <a href={`https://www.zoom.com.br/busca/?q=${encodeURIComponent(produto)}`}
            target="_blank" rel="noreferrer" style={{ flex:1, textDecoration:'none' }}>
            <button className="btn" style={{
              width:'100%', background:'var(--bg)',
              color:'var(--text-sec)', border:'.5px solid var(--border)', fontSize:13
            }}>
              Ver no Zoom ↗
            </button>
          </a>
        </div>
      )}

      {/* Toggle reposição */}
      <div className="card" style={{
        marginBottom:14, display:'flex', alignItems:'center', gap:12, cursor:'pointer',
        background: isRepos ? '#F5F3FF' : 'var(--card)',
        border: isRepos ? '1.5px solid var(--indigo)' : '.5px solid var(--border)'
      }} onClick={() => setIsRepos(!isRepos)}>
        <span style={{ fontSize:22 }}>🔁</span>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:14, fontWeight:600 }}>É uma reposição de rotina?</p>
          <p className="caption">Shampoo, suplemento, algo que acabou</p>
        </div>
        <div style={{
          width:24, height:24, borderRadius:12,
          background: isRepos ? 'var(--indigo)' : 'var(--border)',
          display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s'
        }}>
          {isRepos && <span style={{ color:'#fff', fontSize:14 }}>✓</span>}
        </div>
      </div>

      {/* Maslow */}
      {!isRepos && (
        <div className="card" style={{ marginBottom:14 }}>
          <p style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Nível de necessidade</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {MASLOW.map(m => (
              <div key={m.nivel}
                onClick={() => setMaslow(maslow === m.nivel ? null : m.nivel)}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                  borderRadius:10, cursor:'pointer', transition:'all .15s',
                  background: maslow === m.nivel ? m.bg : 'var(--bg)',
                  border: `1.5px solid ${maslow === m.nivel ? m.cor : 'transparent'}`,
                }}>
                <span style={{ fontSize:18 }}>{m.icon}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:600,
                    color: maslow === m.nivel ? m.cor : 'var(--text)' }}>{m.nome}</p>
                  {maslow === m.nivel && (
                    <>
                      <p style={{ fontSize:11, color:'var(--text-sec)', marginTop:2 }}>{m.analise}</p>
                      {m.desafio && (
                        <p style={{ fontSize:11, color:'var(--text-ter)', marginTop:3, fontStyle:'italic' }}>
                          💭 {m.desafio}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análise financeira */}
      {analise && (
        <div style={{
          background: analise.cls==='go' ? '#ECFDF5' : analise.cls==='warn' ? '#FFFBEB' : '#FFF1F2',
          borderRadius:14, padding:'16px 18px', marginBottom:14,
          borderLeft: `4px solid ${analise.cor}`
        }}>
          {/* Maslow context */}
          {analise.mObj && (
            <div style={{
              background:'rgba(255,255,255,.6)', borderRadius:10, padding:'8px 12px', marginBottom:10
            }}>
              <p style={{ fontSize:12, fontWeight:600, color: analise.mObj.cor }}>
                {analise.mObj.icon} {analise.mObj.nome}
              </p>
              <p style={{ fontSize:11, color:'var(--text-sec)', marginTop:2 }}>
                {analise.mObj.analise}
              </p>
              {analise.mObj.desafio && (
                <p style={{ fontSize:11, color:'var(--text-ter)', marginTop:4, fontStyle:'italic' }}>
                  💭 {analise.mObj.desafio}
                </p>
              )}
            </div>
          )}

          {/* Veredicto */}
          <p style={{ fontSize:15, fontWeight:700, color: analise.cor, marginBottom:4 }}>
            {analise.veredicto} — {analise.pct}% do disponível
          </p>

          {/* Barra de impacto */}
          <div style={{ background:'rgba(0,0,0,.08)', borderRadius:6, height:7, marginBottom:10, overflow:'hidden' }}>
            <div style={{
              width: Math.min(analise.pct, 100)+'%', height:'100%',
              background: analise.cor, borderRadius:6, transition:'width .5s'
            }} />
          </div>

          {/* Pagamento */}
          <div style={{
            background:'rgba(255,255,255,.65)', borderRadius:10, padding:'10px 12px', marginBottom:10
          }}>
            <p className="label-sm" style={{ marginBottom:3 }}>Melhor forma de pagar</p>
            <p style={{ fontSize:15, fontWeight:700, color: analise.cor }}>{analise.pagRec}</p>
            <p style={{ fontSize:11, color:'var(--text-sec)', marginTop:3 }}>{analise.motivo}</p>
          </div>

          {/* Livelo */}
          {p > 0 && (
            <div>
              <p className="label-sm" style={{ marginBottom:6 }}>Pontos Livelo por loja</p>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {LIVELO.slice(0, 4).map(l => {
                  const pts = Math.round(p * l.pts);
                  return (
                    <div key={l.nome} style={{
                      display:'flex', justifyContent:'space-between',
                      background:'rgba(255,255,255,.5)', borderRadius:8, padding:'6px 10px'
                    }}>
                      <span style={{ fontSize:12 }}>{l.nome}</span>
                      <span style={{ fontSize:12, color:'#F97316', fontWeight:600 }}>
                        {pts} pts ≈ {fmt(pts * 0.01)} de volta
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botões de ação */}
      {produto && p > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {/* Alternativas — só mostra quando impacto é alto OU o produto pode ter similar mais barato */}
          <button className="btn" style={{
            background:'var(--green-light)', color:'var(--green)',
            border:'1.5px solid #6EE7B7', padding:'12px'
          }} onClick={buscarAlternativas}>
            Pesquisar alternativas mais baratas no Google ↗
          </button>

          <button className="btn btn-primary btn-full"
            onClick={() => setShowBuy(true)}>
            Comprei — registrar na planilha
          </button>
        </div>
      )}

      {savedMsg && (
        <div style={{
          background: savedMsg.includes('Erro') ? 'var(--red-light)' : 'var(--green-light)',
          color: savedMsg.includes('Erro') ? 'var(--red)' : 'var(--green)',
          borderRadius:12, padding:'12px 16px', marginBottom:12,
          fontSize:14, fontWeight:600, textAlign:'center'
        }}>{savedMsg}</div>
      )}

      {/* Modal compra */}
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
              {produto || 'Registrar compra'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Valor pago (R$)</p>
                <input className="input" type="number"
                  value={buyForm.valuePaid || preco}
                  onChange={e => setBuyForm({...buyForm, valuePaid:e.target.value})}
                  placeholder={preco || '0,00'} />
              </div>
              <div>
                <p className="label-sm" style={{ marginBottom:4 }}>Loja</p>
                <input className="input" value={buyForm.store}
                  onChange={e => setBuyForm({...buyForm, store:e.target.value})}
                  placeholder="Amazon, Sephora, Beleza na Web..." />
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
                  <p className="label-sm" style={{ marginBottom:4 }}>Parcelas</p>
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
                  {[false, true].map(v => (
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
                        border:`1.5px solid ${buyForm.impulse === v ? (v ? 'var(--red)' : 'var(--green)') : 'transparent'}`
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
                  placeholder="Onde achou, comparações que fez..."
                  style={{ minHeight:56, resize:'vertical' }} />
              </div>
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop:16 }}
              onClick={savePurchase}>
              Salvar na planilha
            </button>
            <button className="btn" style={{
              width:'100%', marginTop:8, background:'var(--bg)', color:'var(--text-sec)'
            }} onClick={() => setShowBuy(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
