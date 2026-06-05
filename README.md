# Jade Finance 💜

App financeiro pessoal — controle de gastos, assistente de compras, OCR de extratos.

## Estrutura

```
jade-finance/
├── backend/          Python FastAPI (deploy: Render.com)
│   ├── main.py
│   ├── requirements.txt
│   └── render.yaml
└── frontend/         React PWA (deploy: GitHub Pages)
    ├── src/
    └── public/
```

## Setup de variáveis de ambiente (Render.com)

| Variável | Descrição |
|---|---|
| ANTHROPIC_API_KEY | Chave da API Anthropic (OCR) |
| SENDGRID_API_KEY | Chave do SendGrid (emails) |
| GOOGLE_CREDENTIALS_JSON | Conteúdo do arquivo JSON da conta de serviço Google |

## Google Sheets ID

`1nIyq8C0LTjztxn-4pmzV67w_Lx_sErirWukTmFobIcw`

## Deploy

1. Backend → Render.com: conectar repositório, setar variáveis de ambiente
2. Frontend → GitHub Pages: `npm run build` → push para branch `gh-pages`
