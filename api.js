// URL do backend — atualizar após deploy no Render.com
const BASE = process.env.REACT_APP_API_URL || 'https://jade-finance-backend.onrender.com';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  health:          ()       => req('GET',  '/health'),
  search: async ({query, limit=12}) => {
    const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ML API error ${res.status}`);
    const data = await res.json();
    const results = (data.results || []).map(item => ({
      id: item.id, title: item.title, price: item.price,
      currency: item.currency_id || 'BRL', condition: item.condition,
      thumbnail: item.thumbnail, link: item.permalink,
      seller: item.seller?.nickname, sold: item.sold_quantity || 0,
      rating: item.reviews?.rating_average || 0,
    }));
    const sorted = [...results].sort((a, b) => a.price - b.price);
    return { results, alternatives: sorted.slice(0, 4),
             total: data.paging?.total || 0, query };
  },
  cnpj:            (cnpj)   => req('GET',  `/api/cnpj/${cnpj}`),
  ocr:             (data)   => req('POST', '/api/ocr', data),
  saveTransactions:(data)   => req('POST', '/api/transactions/save', data),
  dashboard:       ()       => req('GET',  '/api/dashboard'),
  config:          ()       => req('GET',  '/api/config'),
  updateConfig:    (cfg)    => req('POST', '/api/config', { config: cfg }),
  registerPurchase:(data)   => req('POST', '/api/purchase', data),
  createAlert:     (data)   => req('POST', '/api/alerts', data),
  listAlerts:      ()             => req('GET',  '/api/alerts'),
  readSheet:       (sheet)        => req('GET',  `/api/sheets/${sheet}`),
  writeSheet:      (sheet, data)  => req('POST', `/api/sheets/${sheet}`, data),
};

// Warm-up silencioso ao iniciar
export function warmup() {
  fetch(`${BASE}/health`).catch(() => {});
}
