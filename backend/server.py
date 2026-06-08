"""
StudyLoop Backend - FastAPI + MongoDB
Active learning app with AI-generated quizzes & flashcards.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, json, re, base64, io
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import requests as http_requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

# ---------- Setup ----------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"

app = FastAPI(title="StudyLoop API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("studyloop")


# ---------- Models ----------
def now_utc():
    return datetime.now(timezone.utc)

def new_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    nivel_ensino: Optional[str] = None
    horas_diarias: Optional[int] = 1

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    auth_provider: str
    nivel_ensino: Optional[str] = None
    horas_diarias: Optional[int] = 1
    streak_atual: int = 0
    streak_maximo: int = 0
    plano: str = "free"
    picture: Optional[str] = None
    onboarding_done: bool = False


class MateriaIn(BaseModel):
    nome: str
    cor: str = "#F5A623"
    icone: str = "book"

class MateriaUpdate(BaseModel):
    nome: Optional[str] = None
    cor: Optional[str] = None
    icone: Optional[str] = None
    arquivada: Optional[bool] = None


class FonteCreateText(BaseModel):
    materia_id: str
    titulo: str
    conteudo: str

class FonteCreateLink(BaseModel):
    materia_id: str
    titulo: Optional[str] = None
    url: str


class SessaoCreate(BaseModel):
    materia_id: Optional[str] = None
    fonte_id: Optional[str] = None
    tipo: Literal["quiz", "flashcard", "5min"]
    total_questoes: int
    acertos: int
    duracao_segundos: int

class FlashcardReview(BaseModel):
    grade: int  # 0=Errei, 1=Difícil, 2=Bom, 3=Fácil


class AvaliacaoIn(BaseModel):
    nota: int  # 1..5
    materia_id: Optional[str] = None
    fonte_id: Optional[str] = None
    sessao_id: Optional[str] = None
    comentario: Optional[str] = None


class NpsIn(BaseModel):
    nota: int  # 0..10
    comentario: Optional[str] = None


# ---------- Auth helpers ----------
def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def make_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_user_from_token(token: str) -> Optional[dict]:
    # Try JWT first
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get("user_id")
        if uid:
            u = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
            if u:
                return u
    except Exception:
        pass
    # Try session_token (Emergent Google Auth)
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        expires_at = sess.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < datetime.now(timezone.utc):
            return None
        u = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
        return u
    return None


async def current_user(request: Request) -> dict:
    # Check cookie first
    token = request.cookies.get("session_token")
    if not token:
        # Authorization header fallback
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    return user


# ---------- AUTH endpoints ----------
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user_id = new_id("user")
    user = {
        "user_id": user_id,
        "email": body.email,
        "name": body.name,
        "password_hash": hash_pw(body.password),
        "auth_provider": "email",
        "nivel_ensino": body.nivel_ensino,
        "horas_diarias": body.horas_diarias or 1,
        "streak_atual": 0,
        "streak_maximo": 0,
        "plano": "free",
        "onboarding_done": False,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    token = make_jwt(user_id)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email})
    if not u or u.get("auth_provider") != "email":
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    if not verify_pw(body.password, u.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = make_jwt(u["user_id"])
    u.pop("password_hash", None)
    u.pop("_id", None)
    return {"token": token, "user": u}


# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@api.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id obrigatório")
    # Call Emergent Auth
    try:
        r = http_requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Sessão Google inválida")
        data = r.json()
    except http_requests.RequestException:
        raise HTTPException(status_code=502, detail="Erro ao validar sessão Google")

    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data.get("session_token")

    # Find or create user
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = new_id("user")
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "auth_provider": "google",
            "picture": picture,
            "nivel_ensino": None,
            "horas_diarias": 1,
            "streak_atual": 0,
            "streak_maximo": 0,
            "plano": "free",
            "onboarding_done": False,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"picture": picture or user.get("picture"), "name": user.get("name") or name}}
        )

    # Store session
    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": now_utc().isoformat(),
    })

    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user, "session_token": session_token}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.post("/auth/onboarding")
async def complete_onboarding(body: dict, user: dict = Depends(current_user)):
    update = {"onboarding_done": True}
    for f in ("nivel_ensino", "horas_diarias"):
        if f in body and body[f] is not None:
            update[f] = body[f]
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"ok": True}


# ---------- PLAN LIMITS & UPGRADE ----------
FREE_FONTES_MAX = 3
FREE_SESSOES_MENSAIS_MAX = 5
PRO_PRICE_BRL = 29.0


def _month_start_iso():
    n = now_utc()
    return n.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


async def _plan_status(user: dict) -> dict:
    is_pro = user.get("plano") == "pro"
    fontes_used = await db.fontes.count_documents({"user_id": user["user_id"]})
    month_start = _month_start_iso()
    sessoes_used = await db.sessoes.count_documents({
        "user_id": user["user_id"],
        "tipo": {"$in": ["quiz", "5min"]},
        "created_at": {"$gte": month_start},
    })
    return {
        "plano": user.get("plano", "free"),
        "is_pro": is_pro,
        "fontes_used": fontes_used,
        "fontes_max": None if is_pro else FREE_FONTES_MAX,
        "sessoes_mes_used": sessoes_used,
        "sessoes_mes_max": None if is_pro else FREE_SESSOES_MENSAIS_MAX,
        "can_use_foto_pdf": is_pro,
        "pro_price_brl": PRO_PRICE_BRL,
    }


@api.get("/plan/status")
async def plan_status(user: dict = Depends(current_user)):
    return await _plan_status(user)


def _paywall_response(motivo: str, **extra):
    return HTTPException(
        status_code=402,
        detail={"code": "free_limit", "motivo": motivo, **extra},
    )


async def _enforce_fonte_limit(user: dict, tipo: str):
    if user.get("plano") == "pro":
        return
    if tipo in ("pdf", "foto"):
        raise _paywall_response("foto_pdf", tipo=tipo)
    used = await db.fontes.count_documents({"user_id": user["user_id"]})
    if used >= FREE_FONTES_MAX:
        raise _paywall_response("fonte_limite", used=used, max=FREE_FONTES_MAX)


async def _enforce_sessao_limit(user: dict, tipo: str):
    if user.get("plano") == "pro":
        return
    if tipo not in ("quiz", "5min"):
        return
    month_start = _month_start_iso()
    used = await db.sessoes.count_documents({
        "user_id": user["user_id"],
        "tipo": {"$in": ["quiz", "5min"]},
        "created_at": {"$gte": month_start},
    })
    if used >= FREE_SESSOES_MENSAIS_MAX:
        raise _paywall_response("sessao_limite", used=used, max=FREE_SESSOES_MENSAIS_MAX)


@api.post("/plan/upgrade")
async def plan_upgrade(user: dict = Depends(current_user)):
    """MOCKED upgrade — sets plano=pro and records a payment. Replace with Stripe later."""
    if user.get("plano") == "pro":
        return {"ok": True, "already_pro": True}
    payment_id = new_id("pay")
    await db.payments.insert_one({
        "payment_id": payment_id,
        "user_id": user["user_id"],
        "amount": PRO_PRICE_BRL,
        "currency": "BRL",
        "status": "success",
        "method": "mock",
        "created_at": now_utc().isoformat(),
    })
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"plano": "pro", "pro_since": now_utc().isoformat()}},
    )
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "user": fresh, "payment_id": payment_id, "amount": PRO_PRICE_BRL}


# ---------- ANALYTICS ----------
class AnalyticsIn(BaseModel):
    name: str
    props: Optional[dict] = None


@api.post("/analytics/event")
async def track_event(body: AnalyticsIn, user: dict = Depends(current_user)):
    doc = {
        "event_id": new_id("evt"),
        "user_id": user["user_id"],
        "name": body.name[:120],
        "props": body.props or {},
        "created_at": now_utc().isoformat(),
    }
    await db.analytics_events.insert_one(doc)
    return {"ok": True, "event_id": doc["event_id"]}


# ---------- ADMIN ----------
ADMIN_EMAIL = "jeffinc88@gmail.com"


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if (user.get("email") or "").lower() != ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="Acesso restrito")
    return user


@api.get("/admin/metrics")
async def admin_metrics(_: dict = Depends(require_admin)):
    now = now_utc()
    iso_7d = (now - timedelta(days=7)).isoformat()
    iso_30d = (now - timedelta(days=30)).isoformat()

    # Users
    total_users = await db.users.count_documents({})
    ativos_7d_ids = await db.sessoes.distinct("user_id", {"created_at": {"$gte": iso_7d}})
    ativos_7d = len(ativos_7d_ids)

    # Ativação D7: users created >=7 days ago, of whom how many did at least 1 sessao in first 7 days
    cohort_d7 = await db.users.find({"created_at": {"$lte": iso_7d}}, {"user_id": 1, "created_at": 1, "_id": 0}).to_list(100000)
    activated_d7 = 0
    for u in cohort_d7:
        c = u.get("created_at")
        if not c:
            continue
        c_dt = datetime.fromisoformat(c) if isinstance(c, str) else c
        if c_dt.tzinfo is None:
            c_dt = c_dt.replace(tzinfo=timezone.utc)
        end_dt = c_dt + timedelta(days=7)
        s = await db.sessoes.find_one({
            "user_id": u["user_id"],
            "created_at": {"$gte": c_dt.isoformat(), "$lte": end_dt.isoformat()},
        })
        if s:
            activated_d7 += 1
    ativacao_d7_pct = round((activated_d7 / len(cohort_d7) * 100), 1) if cohort_d7 else 0.0

    # Retenção D30: users registered >=30 days ago who had >=1 sessao in last 7 days
    cohort_d30 = await db.users.count_documents({"created_at": {"$lte": iso_30d}})
    if cohort_d30 > 0:
        retained_ids = await db.sessoes.distinct("user_id", {"created_at": {"$gte": iso_7d}})
        retained_d30 = await db.users.count_documents({
            "user_id": {"$in": retained_ids},
            "created_at": {"$lte": iso_30d},
        })
        retencao_d30_pct = round((retained_d30 / cohort_d30 * 100), 1)
    else:
        retained_d30 = 0
        retencao_d30_pct = 0.0

    # Avaliações IA (stars 1-5)
    avals = await db.avaliacoes.find({}, {"nota": 1, "_id": 0}).to_list(100000)
    total_avaliacoes = len(avals)
    avaliacao_media = round(sum(a.get("nota", 0) for a in avals) / total_avaliacoes, 2) if total_avaliacoes else 0.0

    # NPS
    nps_recs = await db.nps_surveys.find({"status": "answered"}, {"nota": 1, "_id": 0}).to_list(100000)
    total_nps = len(nps_recs)
    promotores = sum(1 for r in nps_recs if r.get("nota", -1) >= 9)
    detratores = sum(1 for r in nps_recs if 0 <= r.get("nota", -1) <= 6)
    neutros = sum(1 for r in nps_recs if 7 <= r.get("nota", -1) <= 8)
    if total_nps > 0:
        nps_score = round((promotores / total_nps * 100) - (detratores / total_nps * 100), 1)
    else:
        nps_score = 0.0

    # Monetização
    pro_users = await db.users.find(
        {"plano": "pro"},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "pro_since": 1, "created_at": 1, "picture": 1},
    ).sort("pro_since", -1).to_list(1000)
    total_pro = len(pro_users)
    paywall_shown_count = await db.analytics_events.count_documents({"name": "paywall_shown"})
    shown_user_ids = await db.analytics_events.distinct("user_id", {"name": "paywall_shown"})
    tapped_user_ids = await db.analytics_events.distinct("user_id", {"name": "paywall_cta_tapped"})
    unique_shown = len(shown_user_ids)
    unique_tapped = len([u for u in tapped_user_ids if u in shown_user_ids])
    paywall_ctr = round((unique_tapped / unique_shown * 100), 1) if unique_shown else 0.0

    return {
        "generated_at": now.isoformat(),
        "users": {
            "total": total_users,
            "ativos_7d": ativos_7d,
        },
        "ativacao_retencao": {
            "ativacao_d7_pct": ativacao_d7_pct,
            "ativacao_d7_cohort": len(cohort_d7),
            "ativacao_d7_activated": activated_d7,
            "retencao_d30_pct": retencao_d30_pct,
            "retencao_d30_cohort": cohort_d30,
            "retencao_d30_retained": retained_d30,
        },
        "ia_qualidade": {
            "media_estrelas": avaliacao_media,
            "total_avaliacoes": total_avaliacoes,
        },
        "nps": {
            "score": nps_score,
            "total_respostas": total_nps,
            "promotores": promotores,
            "neutros": neutros,
            "detratores": detratores,
        },
        "monetizacao": {
            "total_pro": total_pro,
            "paywall_shown_count": paywall_shown_count,
            "paywall_unique_shown_users": unique_shown,
            "paywall_unique_tapped_users": unique_tapped,
            "paywall_ctr_pct": paywall_ctr,
            "pro_users": pro_users,
        },
    }


# ---------- MATERIAS ----------
@api.post("/materias")
async def create_materia(body: MateriaIn, user: dict = Depends(current_user)):
    m = {
        "materia_id": new_id("mat"),
        "user_id": user["user_id"],
        "nome": body.nome,
        "cor": body.cor,
        "icone": body.icone,
        "arquivada": False,
        "created_at": now_utc().isoformat(),
    }
    await db.materias.insert_one(m)
    m.pop("_id", None)
    return m


@api.get("/materias")
async def list_materias(user: dict = Depends(current_user)):
    items = await db.materias.find(
        {"user_id": user["user_id"], "arquivada": {"$ne": True}}, {"_id": 0}
    ).to_list(500)
    # add counters
    for m in items:
        m["total_fontes"] = await db.fontes.count_documents({"materia_id": m["materia_id"]})
        m["total_questoes"] = await db.questoes.count_documents({"materia_id": m["materia_id"]})
        m["total_flashcards"] = await db.flashcards.count_documents({"materia_id": m["materia_id"]})
    return items


@api.patch("/materias/{materia_id}")
async def update_materia(materia_id: str, body: MateriaUpdate, user: dict = Depends(current_user)):
    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not upd:
        return {"ok": True}
    res = await db.materias.update_one({"materia_id": materia_id, "user_id": user["user_id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Matéria não encontrada")
    return {"ok": True}


@api.delete("/materias/{materia_id}")
async def delete_materia(materia_id: str, user: dict = Depends(current_user)):
    await db.materias.delete_one({"materia_id": materia_id, "user_id": user["user_id"]})
    await db.fontes.delete_many({"materia_id": materia_id, "user_id": user["user_id"]})
    await db.questoes.delete_many({"materia_id": materia_id, "user_id": user["user_id"]})
    await db.flashcards.delete_many({"materia_id": materia_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------- CONTENT INGESTION ----------
async def _check_materia(materia_id: str, user_id: str):
    m = await db.materias.find_one({"materia_id": materia_id, "user_id": user_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Matéria não encontrada")
    return m


def _scrape_url(url: str) -> tuple[str, str]:
    """Returns (title, text)"""
    try:
        r = http_requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(r.text, "lxml")
        title = soup.title.string.strip() if soup.title and soup.title.string else url
        # Remove scripts/styles
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return title[:200], text[:20000]
    except Exception as e:
        raise HTTPException(400, f"Erro ao buscar URL: {e}")


def _extract_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages[:50]:  # cap 50 pages
            text += page.extract_text() or ""
            text += "\n\n"
        return text[:30000]
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler PDF: {e}")


async def _ocr_with_claude(image_bytes: bytes) -> str:
    """Use Claude vision to OCR a study material image."""
    b64 = base64.b64encode(image_bytes).decode()
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ocr-{uuid.uuid4().hex[:8]}",
        system_message="Você é um especialista em OCR (reconhecimento óptico de caracteres). Extraia todo o texto legível da imagem fornecida, mantendo a estrutura (parágrafos, listas, títulos). Retorne apenas o texto extraído, sem comentários adicionais."
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    msg = UserMessage(
        text="Extraia todo o texto desta imagem (página de livro, caderno ou material de estudo). Mantenha parágrafos e estrutura.",
        file_contents=[ImageContent(image_base64=b64)]
    )
    text = await chat.send_message(msg)
    return text[:20000]


async def _generate_questions_and_flashcards(content: str, count_questions: int = 6, count_flashcards: int = 6) -> dict:
    """Use Claude to generate quiz questions and flashcards from content."""
    system = (
        "Você é um professor especialista em criar materiais de estudo eficazes para estudantes brasileiros. "
        "A partir de um conteúdo de estudo, você gera questões de múltipla escolha (com 4 opções, apenas 1 correta) "
        "e flashcards (pergunta na frente, resposta concisa no verso). "
        "Use linguagem clara, em português brasileiro. As questões devem testar compreensão real, não memorização superficial. "
        "Retorne APENAS um JSON válido no formato exato abaixo, sem texto antes ou depois, sem markdown:\n"
        "{\n"
        '  "resumo": "<resumo de 2-3 frases do conteúdo>",\n'
        '  "questoes": [\n'
        '    {"enunciado": "...", "opcoes": ["A", "B", "C", "D"], "resposta_correta": 0, "explicacao": "...", "dificuldade": "facil|medio|dificil"}\n'
        "  ],\n"
        '  "flashcards": [\n'
        '    {"frente": "...", "verso": "..."}\n'
        "  ]\n"
        "}"
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"gen-{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    prompt = (
        f"Gere {count_questions} questões de múltipla escolha e {count_flashcards} flashcards "
        f"a partir do seguinte conteúdo de estudo:\n\n---\n{content[:12000]}\n---\n\nRetorne apenas o JSON."
    )
    raw = await chat.send_message(UserMessage(text=prompt))
    # Extract JSON from response (sometimes wrapped in ```json)
    raw = raw.strip()
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        raise HTTPException(500, "IA retornou formato inválido")
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Erro ao parsear JSON da IA: {e}")
    return data


async def _create_fonte_and_generate(user_id: str, materia_id: str, titulo: str, tipo: str, conteudo: str):
    fonte_id = new_id("fonte")
    fonte_doc = {
        "fonte_id": fonte_id,
        "materia_id": materia_id,
        "user_id": user_id,
        "titulo": titulo[:200],
        "tipo": tipo,
        "status": "processing",
        "conteudo_raw": conteudo[:30000],
        "resumo_ia": "",
        "total_questoes": 0,
        "total_flashcards": 0,
        "created_at": now_utc().isoformat(),
    }
    await db.fontes.insert_one(fonte_doc)

    try:
        gen = await _generate_questions_and_flashcards(conteudo)
    except Exception as e:
        await db.fontes.update_one({"fonte_id": fonte_id}, {"$set": {"status": "error", "error": str(e)}})
        raise

    # Save questions
    questoes = []
    for q in gen.get("questoes", []):
        questoes.append({
            "questao_id": new_id("q"),
            "fonte_id": fonte_id,
            "materia_id": materia_id,
            "user_id": user_id,
            "tipo": "multipla_escolha",
            "enunciado": q.get("enunciado", ""),
            "opcoes": q.get("opcoes", []),
            "resposta_correta": q.get("resposta_correta", 0),
            "explicacao": q.get("explicacao", ""),
            "dificuldade": q.get("dificuldade", "medio"),
            "created_at": now_utc().isoformat(),
        })
    if questoes:
        await db.questoes.insert_many(questoes)

    # Save flashcards
    flashcards = []
    for f in gen.get("flashcards", []):
        flashcards.append({
            "flashcard_id": new_id("fc"),
            "fonte_id": fonte_id,
            "materia_id": materia_id,
            "user_id": user_id,
            "frente": f.get("frente", ""),
            "verso": f.get("verso", ""),
            "fator_facilidade": 2.5,
            "intervalo_dias": 0,
            "repeticoes": 0,
            "proxima_revisao": now_utc().isoformat(),
            "created_at": now_utc().isoformat(),
        })
    if flashcards:
        await db.flashcards.insert_many(flashcards)

    await db.fontes.update_one(
        {"fonte_id": fonte_id},
        {"$set": {
            "status": "ready",
            "resumo_ia": gen.get("resumo", ""),
            "total_questoes": len(questoes),
            "total_flashcards": len(flashcards),
        }}
    )
    out = await db.fontes.find_one({"fonte_id": fonte_id}, {"_id": 0})
    return out


@api.post("/fontes/text")
async def add_text_source(body: FonteCreateText, user: dict = Depends(current_user)):
    await _check_materia(body.materia_id, user["user_id"])
    await _enforce_fonte_limit(user, "texto")
    return await _create_fonte_and_generate(user["user_id"], body.materia_id, body.titulo, "texto", body.conteudo)


@api.post("/fontes/link")
async def add_link_source(body: FonteCreateLink, user: dict = Depends(current_user)):
    await _check_materia(body.materia_id, user["user_id"])
    await _enforce_fonte_limit(user, "link")
    title, text = _scrape_url(body.url)
    return await _create_fonte_and_generate(user["user_id"], body.materia_id, body.titulo or title, "link", text)


@api.post("/fontes/pdf")
async def add_pdf_source(
    materia_id: str = Form(...),
    titulo: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    await _check_materia(materia_id, user["user_id"])
    await _enforce_fonte_limit(user, "pdf")
    content = await file.read()
    text = _extract_pdf(content)
    if not text.strip():
        raise HTTPException(400, "PDF sem texto extraível")
    return await _create_fonte_and_generate(user["user_id"], materia_id, titulo, "pdf", text)


@api.post("/fontes/photo")
async def add_photo_source(
    materia_id: str = Form(...),
    titulo: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    await _check_materia(materia_id, user["user_id"])
    await _enforce_fonte_limit(user, "foto")
    img = await file.read()
    text = await _ocr_with_claude(img)
    if not text.strip():
        raise HTTPException(400, "Não foi possível extrair texto da imagem")
    return await _create_fonte_and_generate(user["user_id"], materia_id, titulo, "foto", text)


@api.get("/fontes/{materia_id}")
async def list_fontes(materia_id: str, user: dict = Depends(current_user)):
    items = await db.fontes.find(
        {"user_id": user["user_id"], "materia_id": materia_id}, {"_id": 0, "conteudo_raw": 0}
    ).sort("created_at", -1).to_list(200)
    return items


@api.delete("/fontes/{fonte_id}")
async def delete_fonte(fonte_id: str, user: dict = Depends(current_user)):
    await db.fontes.delete_one({"fonte_id": fonte_id, "user_id": user["user_id"]})
    await db.questoes.delete_many({"fonte_id": fonte_id, "user_id": user["user_id"]})
    await db.flashcards.delete_many({"fonte_id": fonte_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------- QUIZ / FLASHCARDS ----------
@api.get("/questoes")
async def get_questoes(materia_id: Optional[str] = None, fonte_id: Optional[str] = None, limit: int = 10,
                       user: dict = Depends(current_user)):
    q = {"user_id": user["user_id"]}
    if materia_id:
        q["materia_id"] = materia_id
    if fonte_id:
        q["fonte_id"] = fonte_id
    items = await db.questoes.find(q, {"_id": 0}).to_list(limit)
    return items


@api.get("/questoes/5min")
async def get_5min_questions(user: dict = Depends(current_user)):
    """Random 5 questions across all user's content."""
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$sample": {"size": 5}},
        {"$project": {"_id": 0}},
    ]
    items = await db.questoes.aggregate(pipeline).to_list(5)
    return items


@api.get("/flashcards/due/{materia_id}")
async def get_due_flashcards(materia_id: str, user: dict = Depends(current_user)):
    now_iso = now_utc().isoformat()
    items = await db.flashcards.find(
        {"user_id": user["user_id"], "materia_id": materia_id, "proxima_revisao": {"$lte": now_iso}},
        {"_id": 0}
    ).to_list(50)
    if not items:
        # fallback: all
        items = await db.flashcards.find(
            {"user_id": user["user_id"], "materia_id": materia_id}, {"_id": 0}
        ).to_list(50)
    return items


@api.post("/flashcards/{flashcard_id}/review")
async def review_flashcard(flashcard_id: str, body: FlashcardReview, user: dict = Depends(current_user)):
    """SM-2 simplified SRS algorithm."""
    fc = await db.flashcards.find_one({"flashcard_id": flashcard_id, "user_id": user["user_id"]}, {"_id": 0})
    if not fc:
        raise HTTPException(404, "Flashcard não encontrado")
    grade = body.grade  # 0..3
    ef = float(fc.get("fator_facilidade", 2.5))
    reps = int(fc.get("repeticoes", 0))
    interval = int(fc.get("intervalo_dias", 0))

    # Map grade to SM-2 quality (0=again, 3=easy)
    quality = {0: 1, 1: 3, 2: 4, 3: 5}.get(grade, 3)

    if quality < 3:
        reps = 0
        interval = 1
    else:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 3
        else:
            interval = max(1, round(interval * ef))
        reps += 1

    ef = max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    proxima = now_utc() + timedelta(days=interval)
    await db.flashcards.update_one(
        {"flashcard_id": flashcard_id},
        {"$set": {
            "fator_facilidade": ef,
            "intervalo_dias": interval,
            "repeticoes": reps,
            "proxima_revisao": proxima.isoformat(),
        }}
    )
    return {"ok": True, "proxima_revisao": proxima.isoformat(), "intervalo_dias": interval}


# ---------- SESSIONS / STATS ----------
@api.post("/sessoes")
async def save_sessao(body: SessaoCreate, user: dict = Depends(current_user)):
    pct = (body.acertos / body.total_questoes * 100) if body.total_questoes else 0
    sess = {
        "sessao_id": new_id("sess"),
        "user_id": user["user_id"],
        "materia_id": body.materia_id,
        "fonte_id": body.fonte_id,
        "tipo": body.tipo,
        "total_questoes": body.total_questoes,
        "acertos": body.acertos,
        "duracao_segundos": body.duracao_segundos,
        "concluida": True,
        "pontuacao": round(pct, 1),
        "created_at": now_utc().isoformat(),
    }
    await db.sessoes.insert_one(sess)

    # Update streak
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    last = user_doc.get("ultima_sessao_data")
    today = now_utc().date()
    streak = user_doc.get("streak_atual", 0)
    if last:
        last_date = datetime.fromisoformat(last).date() if isinstance(last, str) else last
        delta = (today - last_date).days
        if delta == 0:
            pass  # same day, no change
        elif delta == 1:
            streak += 1
        else:
            streak = 1
    else:
        streak = 1
    max_streak = max(user_doc.get("streak_maximo", 0), streak)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"streak_atual": streak, "streak_maximo": max_streak, "ultima_sessao_data": today.isoformat()}}
    )
    sess.pop("_id", None)
    return sess


@api.post("/avaliacoes")
async def save_avaliacao(body: AvaliacaoIn, user: dict = Depends(current_user)):
    if not (1 <= body.nota <= 5):
        raise HTTPException(400, "Nota deve ser entre 1 e 5")
    doc = {
        "avaliacao_id": new_id("av"),
        "user_id": user["user_id"],
        "nota": body.nota,
        "materia_id": body.materia_id,
        "fonte_id": body.fonte_id,
        "sessao_id": body.sessao_id,
        "comentario": (body.comentario or "")[:500],
        "created_at": now_utc().isoformat(),
    }
    await db.avaliacoes.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------- NPS ----------
NPS_ELIGIBLE_DAYS = 14
NPS_MIN_SESSIONS = 3
NPS_MAX_ATTEMPTS = 2
NPS_SNOOZE_DAYS = 7


async def _nps_should_show(user: dict) -> bool:
    # Account age
    created_at = user.get("created_at")
    if not created_at:
        return False
    created_dt = datetime.fromisoformat(created_at) if isinstance(created_at, str) else created_at
    if created_dt.tzinfo is None:
        created_dt = created_dt.replace(tzinfo=timezone.utc)
    if (now_utc() - created_dt).days < NPS_ELIGIBLE_DAYS:
        return False
    # Sessions count
    sess_count = await db.sessoes.count_documents({"user_id": user["user_id"], "concluida": True})
    if sess_count < NPS_MIN_SESSIONS:
        return False
    # Survey record
    rec = await db.nps_surveys.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not rec:
        return True
    if rec.get("status") == "answered":
        return False
    if rec.get("attempts", 0) >= NPS_MAX_ATTEMPTS:
        return False
    snoozed_until = rec.get("snoozed_until")
    if snoozed_until:
        s_dt = datetime.fromisoformat(snoozed_until) if isinstance(snoozed_until, str) else snoozed_until
        if s_dt.tzinfo is None:
            s_dt = s_dt.replace(tzinfo=timezone.utc)
        if s_dt > now_utc():
            return False
    return True


@api.get("/nps/status")
async def nps_status(user: dict = Depends(current_user)):
    show = await _nps_should_show(user)
    return {"show": show}


@api.post("/nps/submit")
async def nps_submit(body: NpsIn, user: dict = Depends(current_user)):
    if not (0 <= body.nota <= 10):
        raise HTTPException(400, "Nota deve ser entre 0 e 10")
    now_iso = now_utc().isoformat()
    rec = await db.nps_surveys.find_one({"user_id": user["user_id"]}, {"_id": 0})
    doc_set = {
        "status": "answered",
        "nota": body.nota,
        "comentario": (body.comentario or "")[:1000],
        "answered_at": now_iso,
        "last_shown_at": now_iso,
    }
    if rec:
        await db.nps_surveys.update_one({"user_id": user["user_id"]}, {"$set": doc_set})
        survey_id = rec.get("survey_id")
    else:
        survey_id = new_id("nps")
        await db.nps_surveys.insert_one({
            "survey_id": survey_id,
            "user_id": user["user_id"],
            "attempts": 1,
            "created_at": now_iso,
            **doc_set,
        })
    return {"ok": True, "survey_id": survey_id, "nota": body.nota}


@api.post("/nps/snooze")
async def nps_snooze(user: dict = Depends(current_user)):
    now_iso = now_utc().isoformat()
    snooze_until = (now_utc() + timedelta(days=NPS_SNOOZE_DAYS)).isoformat()
    rec = await db.nps_surveys.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not rec:
        await db.nps_surveys.insert_one({
            "survey_id": new_id("nps"),
            "user_id": user["user_id"],
            "status": "snoozed",
            "attempts": 1,
            "snoozed_until": snooze_until,
            "last_shown_at": now_iso,
            "created_at": now_iso,
        })
        return {"ok": True, "attempts": 1, "snoozed_until": snooze_until}

    attempts = int(rec.get("attempts", 0)) + 1
    upd = {
        "attempts": attempts,
        "last_shown_at": now_iso,
    }
    if attempts >= NPS_MAX_ATTEMPTS:
        # Final dismiss — never show again
        upd["status"] = "dismissed"
        upd["snoozed_until"] = None
    else:
        upd["status"] = "snoozed"
        upd["snoozed_until"] = snooze_until
    await db.nps_surveys.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return {"ok": True, "attempts": attempts, "snoozed_until": upd.get("snoozed_until")}


@api.get("/stats")
async def get_stats(user: dict = Depends(current_user)):
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    sess_list = await db.sessoes.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(5000)
    total_questoes = sum(s.get("total_questoes", 0) for s in sess_list)
    total_acertos = sum(s.get("acertos", 0) for s in sess_list)
    total_segundos = sum(s.get("duracao_segundos", 0) for s in sess_list)
    taxa = (total_acertos / total_questoes * 100) if total_questoes else 0

    # Heatmap: last 365 days, count of questoes per day
    heatmap = {}
    for s in sess_list:
        d = s.get("created_at", "")[:10]
        heatmap[d] = heatmap.get(d, 0) + s.get("total_questoes", 0)

    # Last 7 days bar
    last7 = []
    for i in range(6, -1, -1):
        d = (now_utc() - timedelta(days=i)).date().isoformat()
        last7.append({"date": d, "count": heatmap.get(d, 0)})

    return {
        "user": user_doc,
        "total_questoes": total_questoes,
        "total_acertos": total_acertos,
        "taxa_acerto": round(taxa, 1),
        "total_horas": round(total_segundos / 3600, 1),
        "streak_atual": user_doc.get("streak_atual", 0),
        "streak_maximo": user_doc.get("streak_maximo", 0),
        "heatmap": heatmap,
        "last7": last7,
        "total_sessoes": len(sess_list),
    }


@api.get("/home")
async def home_dashboard(user: dict = Depends(current_user)):
    total_questoes = await db.questoes.count_documents({"user_id": user["user_id"]})
    total_materias = await db.materias.count_documents({"user_id": user["user_id"]})
    # Last session
    last_sess = await db.sessoes.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(1).to_list(1)
    last_materia = None
    if last_sess and last_sess[0].get("materia_id"):
        last_materia = await db.materias.find_one(
            {"materia_id": last_sess[0]["materia_id"]}, {"_id": 0}
        )
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {
        "user": user_doc,
        "questoes_disponiveis": total_questoes,
        "total_materias": total_materias,
        "last_session": last_sess[0] if last_sess else None,
        "last_materia": last_materia,
    }


@api.get("/")
async def root():
    return {"ok": True, "service": "StudyLoop API"}


# Include router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
