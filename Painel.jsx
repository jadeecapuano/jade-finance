import { useState, useEffect } from 'react';
import { api } from '../api';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const METAS = [
  { id:'cartao', nome:'Um Cartão Só', prazo:'Jun/2026', feito:true,
    desc:'Inter único cartão ativo' },
  { id:'azul', nome:'Mês no Azul', prazo:'Ago/2026', feito:false,
    tipo:'milestone', desc:'Primeiro mês positivo sem resgatar investimento',
    detalhe:'Projeção julho: +R$ 818' },
  { id:'invest', nome:'Devolver pro Futuro', prazo:'Ago/2027', feito:false,
    tipo:'valor', meta:7500, atual:800,
    desc:'Repor R$ 7.500 resgatados do investimento' },
  { id:'reserva', nome:'Colchão de Segurança', prazo:'Dez/2028', feito:false,
    tipo:'valor', meta:14000, atual:0,
    desc:'Reserva de emergência — 6 meses de gastos fixos' },
];

const PARC_MONTHS = [
  { mes:'Jun/26', total:8452.68 },
  { mes:'Jul/26', total:3661.09 },
  { mes:'Ago/26', total:3204.52 },
  { mes:'Set/26', total:2987.34 },
  { mes:'Out/26', total:2009.06 },
  { mes:'Nov/26', total:86.74   },
  { mes:'Dez/26', total:0       },
];

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

export default function Painel() {
  const [data, setData]     = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');

  useEffect(() => {
    Promise.all([api.dashboard(), api.config()])
      .then(([dash, cfg]) => {
        setData(dash);
        setConfig(cfg.config);
        generateInsight(dash, cfg.config);
      })
      .catch(() => {
        setConfig({
          renda_mensal:7364, budget_var:1000, gasto_var:0,
          limite_inter_total:11370, limite_inter_bloqueado:7141.17,
          assinaturas_total:937.25, meta_reserva:14000, reserva_atual:800
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function generateInsight(dash, cfg) {
    const spent = dash?.total_variable_spending || 0;
    const budget = cfg?.budget_var || 1000;
    const pct = Math.round(spent / budget * 100);
    if (pct === 0) setInsight('Nenhum gasto variável registrado ainda. Bom começo de mês!');
    else if (pct < 50) setInsight(`Você usou ${pct}% do orçamento variável. Está indo muito bem.`);
    else if (pct < 80) setInsight(`Atenção: ${pct}% do orçamento variável utilizado.`);
    else setInsight(`Orçamento variável comprometido (${pct}%). Evite novas compras não essenciais.`);
  }

  if (loading) return (
    <div className="loading"><div className="spinner"/>Carregando...</div>
  );

  const cfg    = config || {};
  const renda  = cfg.renda_mensal || 7364;
  const budVar = cfg.budget_var   || 1000;
  const gastoV = data?.total_variable_spending || cfg.gasto_var || 0;
  const limDisp= (cfg.limite_inter_total || 11370) - (cfg.limite_inter_bloqueado || 7141.17) - (cfg.assinaturas_total || 937.25);
  const pctVar = Math.min(Math.round(gastoV / budVar * 100), 100);
  const barColor = pctVar > 80 ? 'var(--red)' : pctVar > 50 ? 'var(--amber)' : 'var(--indigo)';

  // Financial month name
  const now = new Date();
  const mesNome = now.getDate() >= 5
    ? MESES[now.getMonth()]
    : MESES[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

  return (
    <div className="scroll fade-in" style={{ padding: 16 }}>

      {/* Header */}
      <div style={{
        background: 'var(--indigo)', borderRadius: 20,
        padding: '20px 18px 22px', color: '#fff', marginBottom: 16
      }}>
        <p style={{ fontSize: 13, opacity: .75, marginBottom: 2 }}>
          Boa {now.getHours() < 12 ? 'manhã' : now.getHours() < 18 ? 'tarde' : 'noite'}, Jade
        </p>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -.5 }}>
          {mesNome} 2026
        </div>
        <p style={{ fontSize: 12, opacity: .65, marginTop: 4 }}>
          Ciclo financeiro: dia 5/{now.getMonth() + 1} → dia 4/{now.getMonth() + 2}
        </p>
        {insight && (
          <div style={{
            background: 'rgba(255,255,255,.15)', borderRadius: 10,
            padding: '8px 12px', marginTop: 12, fontSize: 12, lineHeight: 1.5
          }}>
            {insight}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card">
          <p className="label-sm" style={{ marginBottom: 4 }}>Renda mensal</p>
          <p className="val-md indigo">{fmt(renda)}</p>
          <p className="caption">Salário + Caju</p>
        </div>
        <div className="card">
          <p className="label-sm" style={{ marginBottom: 4 }}>Limite Inter livre</p>
          <p className="val-md" style={{ color: limDisp > 1500 ? 'var(--green)' : 'var(--amber)' }}>
            {fmt(Math.max(0, limDisp))}
          </p>
          <p className="caption">após assinaturas</p>
        </div>
      </div>

      {/* Variable spending bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Gastos variáveis</p>
          <span className="pill" style={{
            background: pctVar > 80 ? 'var(--red-light)' : pctVar > 50 ? 'var(--amber-light)' : 'var(--indigo-light)',
            color: pctVar > 80 ? 'var(--red)' : pctVar > 50 ? 'var(--amber)' : 'var(--indigo)'
          }}>{pctVar}%</span>
        </div>
        <div className="progress-track" style={{ marginBottom: 6 }}>
          <div className="progress-fill" style={{ width: pctVar+'%', background: barColor }} />
        </div>
        <p className="caption">
          {fmt(gastoV)} de {fmt(budVar)} — sobram {fmt(Math.max(0, budVar - gastoV))}
        </p>
      </div>

      {/* Metas */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <p className="section-title">Suas metas</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {METAS.map(meta => (
          <MetaCard key={meta.id} meta={meta} />
        ))}
      </div>

      {/* Parcelamentos */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <p className="section-title">Parcelas mês a mês</p>
        <span className="pill pill-green">Livre em dez/26</span>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        {PARC_MONTHS.map((p, i) => {
          const max = PARC_MONTHS[0].total;
          const pct = max > 0 ? Math.round(p.total / max * 100) : 0;
          const isCurrent = i === 0;
          return (
            <div key={p.mes} style={{
              display:'flex', alignItems:'center', gap: 10,
              padding: '8px 0',
              borderBottom: i < PARC_MONTHS.length - 1 ? '0.5px solid var(--border)' : 'none'
            }}>
              <p style={{
                width: 44, fontSize: 12, fontWeight: isCurrent ? 700 : 400,
                color: isCurrent ? 'var(--indigo)' : 'var(--text)'
              }}>{p.mes}</p>
              <div style={{ flex: 1, background:'var(--bg)', borderRadius:4, height:6, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:4,
                  width: pct+'%',
                  background: p.total === 0 ? 'var(--green)' : isCurrent ? 'var(--indigo)' : '#A5B4FC',
                  transition: 'width .5s'
                }} />
              </div>
              <p style={{
                width: 90, fontSize: 12, textAlign:'right', fontWeight: isCurrent ? 700 : 400,
                color: p.total === 0 ? 'var(--green)' : 'var(--text)'
              }}>
                {p.total === 0 ? 'Livre! 🎉' : fmt(p.total)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetaCard({ meta }) {
  const pct = meta.tipo === 'valor'
    ? Math.min(Math.round((meta.atual / meta.meta) * 100), 100)
    : meta.feito ? 100 : 15;

  const barColor = meta.feito
    ? 'var(--green)'
    : meta.tipo === 'milestone' ? 'var(--indigo)' : 'var(--indigo)';

  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{meta.nome}</p>
          <p className="caption">{meta.desc}</p>
        </div>
        {meta.feito
          ? <span className="pill pill-green">Concluída</span>
          : <span className="caption" style={{ whiteSpace:'nowrap', marginLeft:8 }}>{meta.prazo}</span>
        }
      </div>
      {!meta.feito && (
        <>
          <div className="progress-track" style={{ marginBottom: 4 }}>
            <div className="progress-fill" style={{ width: pct+'%', background: barColor }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            {meta.tipo === 'valor'
              ? <><span className="caption">{fmt(meta.atual)}</span>
                  <span className="caption">{fmt(meta.meta)}</span></>
              : <><span className="caption">{meta.detalhe}</span>
                  <span className="caption">{pct}%</span></>
            }
          </div>
        </>
      )}
    </div>
  );
}
