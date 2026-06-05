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
  search:          (data)   => req('POST', '/api/search', data),
  cnpj:            (cnpj)   => req('GET',  `/api/cnpj/${cnpj}`),
  ocr:             (data)   => req('POST', '/api/ocr', data),
  saveTransactions:(data)   => req('POST', '/api/transactions/save', data),
  dashboard:       ()       => req('GET',  '/api/dashboard'),
  config:          ()       => req('GET',  '/api/config'),
  updateConfig:    (cfg)    => req('POST', '/api/config', { config: cfg }),
  registerPurchase:(data)   => req('POST', '/api/purchase', data),
  createAlert:     (data)   => req('POST', '/api/alerts', data),
  listAlerts:      ()       => req('GET',  '/api/alerts'),
  readSheet:       (sheet)  => req('GET',  `/api/sheets/${sheet}`),
};

// Warm-up silencioso ao iniciar
export function warmup() {
  fetch(`${BASE}/health`).catch(() => {});
}
