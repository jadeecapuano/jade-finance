from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os, json, base64, uuid, requests
from datetime import datetime, date
import gspread
from google.oauth2.service_account import Credentials
import anthropic

app = FastAPI(title="Jade Finance API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════
# CONFIG — variáveis de ambiente no Render.com
# ═══════════════════════════════════════════
SHEETS_ID          = "1nIyq8C0LTjztxn-4pmzV67w_Lx_sErirWukTmFobIcw"
ANTHROPIC_KEY      = os.environ.get("ANTHROPIC_API_KEY", "")
SENDGRID_KEY       = os.environ.get("SENDGRID_API_KEY", "")
GOOGLE_CREDS_JSON  = os.environ.get("GOOGLE_CREDENTIALS_JSON", "")
FROM_EMAIL         = "jadecapuanofotografia@gmail.com"
SALARY_DAY         = 5   # dia em que o salário cai

# ═══════════════════════════════════════════
# GOOGLE SHEETS
# ═══════════════════════════════════════════
def sheets():
    if not GOOGLE_CREDS_JSON:
        raise HTTPException(500, "Google credentials não configuradas")
    creds = Credentials.from_service_account_info(
        json.loads(GOOGLE_CREDS_JSON),
        scopes=[
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive"
        ]
    )
    gc = gspread.authorize(creds)
    return gc.open_by_key(SHEETS_ID)

def get_or_create_sheet(sh, name: str, headers: list = None):
    try:
        ws = sh.worksheet(name)
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=name, rows=1000, cols=25)
        if headers:
            ws.append_row(headers)
    return ws

def financial_month_name() -> str:
    """Retorna o nome da aba do mês financeiro atual (ciclo começa dia 5)."""
    now = datetime.now()
    meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
    if now.day >= SALARY_DAY:
        return f"{meses[now.month-1]}{now.year}"
    else:
        m = now.month - 1 if now.month > 1 else 12
        y = now.year if now.month > 1 else now.year - 1
        return f"{meses[m-1]}{y}"

# ═══════════════════════════════════════════
# HEALTH CHECK (warm-up silencioso do frontend)
# ═══════════════════════════════════════════
@app.get("/health")
def health():
    return {"status": "ok", "ts": datetime.now().isoformat()}

# ═══════════════════════════════════════════
# BUSCA DE PRODUTOS — Mercado Livre
# ═══════════════════════════════════════════
class SearchReq(BaseModel):
    query: str
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    condition: Optional[str] = "new"
    limit: int = 12

@app.post("/api/search")
def search_products(req: SearchReq):
    params = {"q": req.query, "limit": req.limit}
    if req.condition: params["condition"] = req.condition
    if req.min_price:  params["price_min"] = req.min_price
    if req.max_price:  params["price_max"] = req.max_price

    r = requests.get("https://api.mercadolibre.com/sites/MLB/search",
                     params=params, timeout=10)
    if r.status_code != 200:
        raise HTTPException(502, "Erro na API do Mercado Livre")

    data = r.json()
    results = []
    for item in data.get("results", []):
        rep = item.get("seller", {}).get("seller_reputation", {})
        results.append({
            "id":           item["id"],
            "title":        item["title"],
            "price":        item["price"],
            "currency":     item.get("currency_id", "BRL"),
            "condition":    item.get("condition"),
            "thumbnail":    item.get("thumbnail"),
            "link":         item.get("permalink"),
            "seller":       item.get("seller", {}).get("nickname"),
            "sold":         item.get("sold_quantity", 0),
            "rating":       item.get("reviews", {}).get("rating_average", 0),
            "rep_level":    rep.get("level_id", ""),
        })

    # Alternativas mais baratas (primeiros 4 resultados mais baratos)
    sorted_results = sorted(results, key=lambda x: x["price"])
    return {
        "results":      results,
        "alternatives": sorted_results[:4],
        "total":        data.get("paging", {}).get("total", 0),
        "query":        req.query
    }

# ═══════════════════════════════════════════
# CNPJ LOOKUP — Receita Federal (Brasil API)
# ═══════════════════════════════════════════
@app.get("/api/cnpj/{cnpj}")
def cnpj_lookup(cnpj: str):
    clean = "".join(filter(str.isdigit, cnpj))
    if len(clean) != 14:
        return {"name": None}
    try:
        r = requests.get(f"https://brasilapi.com.br/api/cnpj/v1/{clean}", timeout=5)
        if r.status_code == 200:
            d = r.json()
            return {
                "name":         d.get("razao_social"),
                "fantasy_name": d.get("nome_fantasia"),
                "cnpj":         clean
            }
    except Exception:
        pass
    return {"name": None, "cnpj": clean}

# ═══════════════════════════════════════════
# OCR — Extrato bancário via Claude Vision
# ═══════════════════════════════════════════
KNOWN_SUBSCRIPTIONS = [
    "spotify","netflix","disney","amazon prime","youtube","hbo","globoplay",
    "nubank","vidya","wellhub","gympass","anthropic","claude","rappi","ifood",
    "apple","microsoft","adobe","canva","notion","slack","zoom"
]

KNOWN_INSTALLMENTS_KEYWORDS = ["parcela", "parc.", "/12","/10","/9","/8","/7","/6","/5","/4","/3","/2"]

class OCRReq(BaseModel):
    image_base64: str
    banco: str   # "inter" | "nubank" | "itau" | "outro"

@app.post("/api/ocr")
def process_statement(req: OCRReq):
    if not ANTHROPIC_KEY:
        raise HTTPException(500, "Anthropic API não configurada")

    bank_map = {
        "inter":  "extrato do Banco Inter (banco digital laranja)",
        "nubank": "extrato do Nubank PF ou PJ (banco digital roxo)",
        "itau":   "extrato do Itaú (banco tradicional)",
        "outro":  "extrato bancário"
    }

    prompt = f"""Este é um {bank_map.get(req.banco, 'extrato bancário')} brasileiro.

Extraia TODAS as transações visíveis e retorne SOMENTE um JSON válido neste formato exato:
{{
  "transactions": [
    {{
      "date": "DD/MM/YYYY",
      "description": "nome do estabelecimento ou descrição original",
      "amount": 0.00,
      "type": "debit",
      "cnpj": null,
      "category": "Alimentação",
      "is_subscription": false,
      "is_installment": false,
      "installment_info": null
    }}
  ]
}}

Regras obrigatórias:
- type = "debit" para saídas (negativo para quem paga), "credit" para entradas
- amount sempre positivo (o type indica direção)
- Se houver CPF/CNPJ na descrição, coloque em cnpj
- Categorias: Alimentação | Transporte | Saúde | Beleza | Roupas | Lazer | Suplementos | Tecnologia | Casa | Assinatura | Parcela | Transferência | Outros
- is_subscription = true para serviços recorrentes (Spotify, Netflix, academias, etc)
- is_installment = true se houver padrão X/Y na descrição
- installment_info = "3/6" se for parcela 3 de 6, caso contrário null
- Retorne SOMENTE o JSON, sem markdown, sem explicações"""

    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": req.image_base64
                    }
                },
                {"type": "text", "text": prompt}
            ]
        }]
    )

    raw = msg.content[0].text.strip()
    # Remove markdown code blocks if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(500, "Não foi possível interpretar a resposta do OCR")

    # Enrich: CNPJ lookup for unknown descriptions
    for txn in result.get("transactions", []):
        if txn.get("cnpj") and not txn.get("description_resolved"):
            info = cnpj_lookup(txn["cnpj"])
            if info.get("name"):
                txn["description_resolved"] = info["name"]

    return result

# ═══════════════════════════════════════════
# SALVAR TRANSAÇÕES DO EXTRATO
# ═══════════════════════════════════════════
class SaveTransactionsReq(BaseModel):
    transactions: List[dict]
    banco: str
    date_range: Optional[str] = ""

@app.post("/api/transactions/save")
def save_transactions(req: SaveTransactionsReq):
    sh = sheets()
    month_name = financial_month_name()
    headers = ["data","descricao","valor","tipo","categoria","assinatura","parcela","info_parcela","banco","cnpj","descricao_resolvida"]
    ws = get_or_create_sheet(sh, month_name, headers)

    rows = []
    for t in req.transactions:
        rows.append([
            t.get("date", ""),
            t.get("description", ""),
            t.get("amount", 0),
            t.get("type", "debit"),
            t.get("category", "Outros"),
            "Sim" if t.get("is_subscription") else "Não",
            "Sim" if t.get("is_installment") else "Não",
            t.get("installment_info", ""),
            req.banco,
            t.get("cnpj", ""),
            t.get("description_resolved", "")
        ])

    ws.append_rows(rows)
    return {"success": True, "saved": len(rows), "sheet": month_name}

# ═══════════════════════════════════════════
# HISTÓRICO DE COMPRAS (assistente de compras)
# ═══════════════════════════════════════════
COMPRAS_HEADERS = ["data","item","valor_pesquisado","valor_pago","loja","pagamento",
                   "parcelas","categoria","maslow_nivel","maslow_nome","impulso","necessidade","notas"]

class PurchaseReq(BaseModel):
    date: str
    item: str
    value_searched: float
    value_paid: float
    store: str
    payment: str
    installments: int = 1
    category: str
    maslow_level: Optional[int] = None
    maslow_name: Optional[str] = None
    impulse: bool = False
    need_level: str = "media"
    notes: Optional[str] = ""
    is_reposicao: bool = False

@app.post("/api/purchase")
def register_purchase(req: PurchaseReq):
    sh = sheets()

    # 1. Salvar em Compras
    ws_compras = get_or_create_sheet(sh, "Compras", COMPRAS_HEADERS)
    ws_compras.append_row([
        req.date, req.item, req.value_searched, req.value_paid,
        req.store, req.payment, req.installments, req.category,
        req.maslow_level or "", req.maslow_name or "",
        "Sim" if req.impulse else "Não", req.need_level, req.notes or ""
    ])

    # 2. Se parcelado, criar entradas futuras em Parcelamentos
    future_installments = []
    if req.installments > 1 and req.payment == "parcelado":
        future_installments = _create_installments(sh, req)

    return {
        "success": True,
        "message": "Compra registrada",
        "future_installments": future_installments
    }

def _create_installments(sh, req: PurchaseReq):
    PARC_HEADERS = ["id","produto","data_compra","valor_parcela","total_parcelas",
                    "numero_parcela","mes_vencimento","status","cartao"]
    ws = get_or_create_sheet(sh, "Parcelamentos", PARC_HEADERS)

    purchase_id = str(uuid.uuid4())[:8].upper()
    valor_parc = round(req.value_paid / req.installments, 2)
    purchase_date = datetime.strptime(req.date, "%d/%m/%Y")
    meses_pt = ["Jan","Fev","Mar","Abr","Mai","Jun",
                "Jul","Ago","Set","Out","Nov","Dez"]

    rows = []
    for i in range(req.installments):
        month = purchase_date.month + i + 1
        year = purchase_date.year
        while month > 12:
            month -= 12
            year += 1
        mes_venc = f"{meses_pt[month-1]}/{year}"
        rows.append([
            purchase_id,
            f"{req.item} ({i+1}/{req.installments})",
            req.date, valor_parc, req.installments, i+1,
            mes_venc, "pendente", "Inter"
        ])

    ws.append_rows(rows)
    return [r[6] for r in rows]  # lista de meses de vencimento

# ═══════════════════════════════════════════
# ALERTAS DE PREÇO
# ═══════════════════════════════════════════
ALERTS_HEADERS = ["id","produto","preco_alvo","preco_atual","ml_id","data_criacao","status"]

class AlertReq(BaseModel):
    product_name: str
    target_price: float
    current_price: float
    ml_id: Optional[str] = None

@app.post("/api/alerts")
def create_alert(req: AlertReq):
    sh = sheets()
    ws = get_or_create_sheet(sh, "AlertasPreco", ALERTS_HEADERS)
    alert_id = str(uuid.uuid4())[:8].upper()
    ws.append_row([
        alert_id, req.product_name, req.target_price,
        req.current_price, req.ml_id or "",
        datetime.now().strftime("%d/%m/%Y"), "ativo"
    ])
    return {"success": True, "alert_id": alert_id}

@app.get("/api/alerts")
def list_alerts():
    sh = sheets()
    try:
        ws = sh.worksheet("AlertasPreco")
        return {"alerts": ws.get_all_records()}
    except gspread.WorksheetNotFound:
        return {"alerts": []}

@app.post("/api/alerts/check")
def check_price_alerts():
    """Verificar se algum produto baixou de preço (chamado pelo scheduler)"""
    sh = sheets()
    try:
        ws = sh.worksheet("AlertasPreco")
    except gspread.WorksheetNotFound:
        return {"checked": 0, "triggered": 0}

    records = ws.get_all_records()
    triggered = []

    for i, alert in enumerate(records):
        if alert.get("status") != "ativo" or not alert.get("ml_id"):
            continue
        try:
            r = requests.get(f"https://api.mercadolibre.com/items/{alert['ml_id']}", timeout=5)
            if r.status_code == 200:
                current = r.json().get("price", 0)
                if current <= float(alert["preco_alvo"]):
                    triggered.append({
                        "product": alert["produto"],
                        "target": alert["preco_alvo"],
                        "current": current,
                        "ml_id": alert["ml_id"]
                    })
                    ws.update_cell(i + 2, 7, "disparado")
                else:
                    ws.update_cell(i + 2, 4, current)
        except Exception:
            pass

    if triggered and SENDGRID_KEY:
        _send_price_alert_email(triggered)

    return {"checked": len(records), "triggered": len(triggered)}

def _send_price_alert_email(alerts: list):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    items_html = "".join([
        f"<li><strong>{a['product']}</strong> — agora R$ {a['current']:.2f} "
        f"(sua meta era R$ {a['target']:.2f})</li>"
        for a in alerts
    ])
    msg = Mail(
        from_email=FROM_EMAIL,
        to_emails=FROM_EMAIL,
        subject=f"🎯 Jade Finance — {len(alerts)} produto(s) baixaram de preço!",
        html_content=f"""
        <h2>Alerta de preço ativado!</h2>
        <p>Os seguintes produtos atingiram o preço que você definiu:</p>
        <ul>{items_html}</ul>
        <p><a href="https://jade-finance.vercel.app">Abrir Jade Finance</a></p>
        """
    )
    try:
        sg = SendGridAPIClient(SENDGRID_KEY)
        sg.send(msg)
    except Exception as e:
        print(f"SendGrid error: {e}")

# ═══════════════════════════════════════════
# CONFIGURAÇÕES
# ═══════════════════════════════════════════
DEFAULT_CONFIG = {
    "renda_mensal": 7364,
    "budget_var": 1000,
    "gasto_var": 0,
    "limite_inter_total": 11370,
    "limite_inter_bloqueado": 7141.17,
    "assinaturas_total": 937.25,
    "meta_reserva": 14000,
    "reserva_atual": 800,
    "mes_financeiro_dia": 5,
    "livelo_amazon": 1.5,
    "livelo_magalu": 2.0,
    "livelo_americanas": 1.5,
    "livelo_casasbahia": 2.0,
    "livelo_ponto": 2.0,
    "livelo_shopee": 0.5,
    "livelo_kabum": 1.0,
    "livelo_ml": 1.0,
}

@app.get("/api/config")
def get_config():
    try:
        sh = sheets()
        try:
            ws = sh.worksheet("Configuracoes")
            records = ws.get_all_records()
            if records:
                return {"config": records[0]}
        except gspread.WorksheetNotFound:
            pass
    except Exception:
        pass
    return {"config": DEFAULT_CONFIG}

class ConfigUpdateReq(BaseModel):
    config: dict

@app.post("/api/config")
def update_config(req: ConfigUpdateReq):
    sh = sheets()
    try:
        ws = sh.worksheet("Configuracoes")
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title="Configuracoes", rows=5, cols=30)
    ws.append_row(list(req.config.keys()))
    ws.append_row(list(req.config.values()))
    return {"success": True}

# ═══════════════════════════════════════════
# LEITURA DO PAINEL (dados do mês atual)
# ═══════════════════════════════════════════
@app.get("/api/dashboard")
def get_dashboard():
    sh = sheets()
    month_name = financial_month_name()

    # Transações do mês
    transactions = []
    try:
        ws = sh.worksheet(month_name)
        transactions = ws.get_all_records()
    except gspread.WorksheetNotFound:
        pass

    # Parcelamentos
    parcelamentos = []
    try:
        ws_p = sh.worksheet("Parcelamentos")
        parcelamentos = ws_p.get_all_records()
    except gspread.WorksheetNotFound:
        pass

    # Config
    config_data = get_config()["config"]

    # Cálculos
    debits = [t for t in transactions if t.get("tipo") == "debit"
              and t.get("assinatura") != "Sim" and t.get("parcela") != "Sim"]
    total_var = sum(float(t.get("valor", 0)) for t in debits)

    spending_by_category = {}
    for t in debits:
        cat = t.get("categoria", "Outros")
        spending_by_category[cat] = spending_by_category.get(cat, 0) + float(t.get("valor", 0))

    return {
        "month": month_name,
        "config": config_data,
        "total_variable_spending": round(total_var, 2),
        "spending_by_category": spending_by_category,
        "transactions_count": len(transactions),
        "parcelamentos": parcelamentos,
    }

# ═══════════════════════════════════════════
# RELATÓRIO MENSAL — disparado no dia 6
# ═══════════════════════════════════════════
@app.post("/api/report/monthly")
def generate_monthly_report():
    dashboard = get_dashboard()
    config = dashboard["config"]

    spent = dashboard["total_variable_spending"]
    budget = float(config.get("budget_var", 1000))
    income = float(config.get("renda_mensal", 7364))
    saved = income - spent

    html = f"""
    <h1 style="color:#4F46E5">Jade Finance — Relatório {dashboard['month']}</h1>
    <hr>
    <h2>Resumo financeiro</h2>
    <ul>
      <li><strong>Renda:</strong> R$ {income:,.2f}</li>
      <li><strong>Gastos variáveis:</strong> R$ {spent:,.2f} de R$ {budget:,.2f} ({spent/budget*100:.0f}%)</li>
      <li><strong>Resultado:</strong> R$ {saved:,.2f}</li>
    </ul>
    <h2>Gastos por categoria</h2>
    <ul>
      {''.join(f"<li>{cat}: R$ {val:,.2f}</li>" for cat,val in dashboard['spending_by_category'].items())}
    </ul>
    <p style="color:#6B7280;font-size:12px">Gerado automaticamente pelo Jade Finance</p>
    """

    if SENDGRID_KEY:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        msg = Mail(
            from_email=FROM_EMAIL,
            to_emails=FROM_EMAIL,
            subject=f"📊 Jade Finance — Relatório de {dashboard['month']}",
            html_content=html
        )
        try:
            sg = SendGridAPIClient(SENDGRID_KEY)
            sg.send(msg)
        except Exception as e:
            print(f"Email error: {e}")

    return {"success": True, "month": dashboard["month"]}

# ═══════════════════════════════════════════
# SCHEDULER — rodar no Render.com com startup event
# ═══════════════════════════════════════════
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = BackgroundScheduler()

# Toda segunda às 8h: verificar alertas de preço
scheduler.add_job(check_price_alerts, CronTrigger(day_of_week="mon", hour=8))

# Todo dia 6 às 9h: relatório mensal
scheduler.add_job(generate_monthly_report, CronTrigger(day=6, hour=9))

@app.on_event("startup")
def start_scheduler():
    scheduler.start()

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()
