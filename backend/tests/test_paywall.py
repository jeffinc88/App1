"""Iteration 6 — Plans & Paywall backend tests."""
import os
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _register():
    email = f"TEST_pay_{uuid.uuid4().hex[:10]}@studyloop.app"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "senha123!", "name": "Pay Tester"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    return data["token"], data["user"], email


@pytest.fixture(scope="module")
def fresh_user():
    token, user, email = _register()
    return {"token": token, "user": user, "email": email,
            "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def materia(fresh_user):
    r = requests.post(f"{API}/materias", headers=fresh_user["headers"],
                      json={"nome": "TEST_Paywall"}, timeout=15)
    assert r.status_code == 200
    return r.json()


CONTENT = (
    "A fotossíntese é o processo realizado pelos seres clorofilados em que se utiliza a energia "
    "luminosa do sol para sintetizar compostos orgânicos a partir de moléculas inorgânicas como o "
    "gás carbônico e a água. Esse processo é fundamental para a vida na Terra, pois além de produzir "
    "glicose para os organismos autótrofos, libera oxigênio na atmosfera. A clorofila, pigmento verde "
    "presente nos cloroplastos das células vegetais, é a principal molécula responsável por captar a "
    "energia luminosa."
)


# ---------- PLAN STATUS ----------
class TestPlanStatusFree:
    def test_status_unauthenticated(self):
        r = requests.get(f"{API}/plan/status", timeout=10)
        assert r.status_code == 401

    def test_status_fresh_free_user(self, fresh_user):
        r = requests.get(f"{API}/plan/status", headers=fresh_user["headers"], timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["plano"] == "free"
        assert d["is_pro"] is False
        assert d["fontes_max"] == 3
        assert d["sessoes_mes_max"] == 5
        assert d["can_use_foto_pdf"] is False
        assert d["pro_price_brl"] == 29.0
        assert d["fontes_used"] == 0


# ---------- FONTE LIMIT ----------
class TestFonteLimit:
    fonte_ids = []

    @pytest.mark.parametrize("idx", [1, 2, 3])
    def test_create_fontes_under_limit(self, fresh_user, materia, idx):
        r = requests.post(
            f"{API}/fontes/text",
            headers=fresh_user["headers"],
            json={"materia_id": materia["materia_id"],
                  "titulo": f"TEST_F{idx}",
                  "conteudo": CONTENT},
            timeout=180,
        )
        assert r.status_code == 200, f"#{idx} failed: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["status"] == "ready"
        TestFonteLimit.fonte_ids.append(d["fonte_id"])

    def test_fourth_fonte_402(self, fresh_user, materia):
        r = requests.post(
            f"{API}/fontes/text",
            headers=fresh_user["headers"],
            json={"materia_id": materia["materia_id"],
                  "titulo": "TEST_F4",
                  "conteudo": CONTENT},
            timeout=60,
        )
        assert r.status_code == 402, r.text
        detail = r.json()["detail"]
        assert detail["code"] == "free_limit"
        assert detail["motivo"] == "fonte_limite"
        assert detail["used"] == 3
        assert detail["max"] == 3


# ---------- FOTO/PDF GATE ----------
class TestFotoPdfGate:
    def test_pdf_blocked_for_free_even_when_empty(self):
        """Use a NEW user (0 fontes) and confirm pdf still 402 with motivo=foto_pdf."""
        token, _, _ = _register()
        headers = {"Authorization": f"Bearer {token}"}
        mat = requests.post(f"{API}/materias", headers=headers,
                            json={"nome": "TEST_PDFGate"}, timeout=15).json()
        files = {"file": ("a.pdf", b"%PDF-1.4 dummy", "application/pdf")}
        data = {"materia_id": mat["materia_id"], "titulo": "TEST_PDF"}
        r = requests.post(f"{API}/fontes/pdf", headers=headers, data=data, files=files, timeout=30)
        assert r.status_code == 402, r.text
        detail = r.json()["detail"]
        assert detail["motivo"] == "foto_pdf"
        assert detail["code"] == "free_limit"

    def test_photo_blocked_for_free(self):
        token, _, _ = _register()
        headers = {"Authorization": f"Bearer {token}"}
        mat = requests.post(f"{API}/materias", headers=headers,
                            json={"nome": "TEST_PhotoGate"}, timeout=15).json()
        files = {"file": ("a.jpg", b"\xff\xd8\xff\xe0dummy", "image/jpeg")}
        data = {"materia_id": mat["materia_id"], "titulo": "TEST_PHOTO"}
        r = requests.post(f"{API}/fontes/photo", headers=headers, data=data, files=files, timeout=30)
        assert r.status_code == 402, r.text
        detail = r.json()["detail"]
        assert detail["motivo"] == "foto_pdf"


# ---------- UPGRADE ----------
class TestUpgrade:
    def test_upgrade_unauthenticated(self):
        r = requests.post(f"{API}/plan/upgrade", timeout=10)
        assert r.status_code == 401

    def test_upgrade_makes_user_pro_and_records_payment(self, fresh_user):
        # fresh_user is at fonte limit by now
        r = requests.post(f"{API}/plan/upgrade", headers=fresh_user["headers"], timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "payment_id" in d
        assert d["amount"] == 29.0
        assert d["user"]["plano"] == "pro"

    def test_status_after_upgrade(self, fresh_user):
        r = requests.get(f"{API}/plan/status", headers=fresh_user["headers"], timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["plano"] == "pro"
        assert d["is_pro"] is True
        assert d["can_use_foto_pdf"] is True
        assert d["fontes_max"] is None
        assert d["sessoes_mes_max"] is None

    def test_pro_can_add_4th_text_fonte(self, fresh_user, materia):
        r = requests.post(
            f"{API}/fontes/text",
            headers=fresh_user["headers"],
            json={"materia_id": materia["materia_id"],
                  "titulo": "TEST_PRO_F4",
                  "conteudo": CONTENT},
            timeout=180,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ready"

    def test_upgrade_idempotent_no_duplicate_payment(self, fresh_user):
        # call upgrade again — should return already_pro:true and NOT create new payment
        # First count payments via subsequent upgrade response shape
        r1 = requests.post(f"{API}/plan/upgrade", headers=fresh_user["headers"], timeout=15)
        assert r1.status_code == 200
        d = r1.json()
        assert d["ok"] is True
        assert d.get("already_pro") is True
        assert "payment_id" not in d


# ---------- ANALYTICS ----------
class TestAnalytics:
    def test_event_unauthenticated(self):
        r = requests.post(f"{API}/analytics/event",
                          json={"name": "paywall_shown", "props": {"motivo": "foto_pdf"}},
                          timeout=10)
        assert r.status_code == 401

    def test_paywall_shown_event(self, fresh_user):
        r = requests.post(f"{API}/analytics/event",
                          headers=fresh_user["headers"],
                          json={"name": "paywall_shown", "props": {"motivo": "foto_pdf"}},
                          timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["event_id"].startswith("evt_")

    def test_paywall_cta_tapped_event(self, fresh_user):
        r = requests.post(f"{API}/analytics/event",
                          headers=fresh_user["headers"],
                          json={"name": "paywall_cta_tapped",
                                "props": {"motivo": "fonte_limite"}},
                          timeout=15)
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ---------- SESSAO LIMIT VIA MONGO SEED ----------
class TestSessaoLimitStatus:
    def test_sessao_count_reflected_in_status(self):
        """Insert 5 sessoes via Mongo, status should show sessoes_mes_used=5."""
        from motor.motor_asyncio import AsyncIOMotorClient
        from datetime import datetime as dt, timezone as tz

        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]

        token, user, _ = _register()
        headers = {"Authorization": f"Bearer {token}"}

        async def seed():
            cli = AsyncIOMotorClient(mongo_url)
            db = cli[db_name]
            now_iso = dt.now(tz.utc).isoformat()
            docs = [{
                "sessao_id": f"sess_TEST_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "tipo": "5min" if i % 2 == 0 else "quiz",
                "total_questoes": 5,
                "acertos": 3,
                "duracao_segundos": 60,
                "concluida": True,
                "pontuacao": 60.0,
                "created_at": now_iso,
            } for i in range(5)]
            await db.sessoes.insert_many(docs)
            cli.close()

        asyncio.get_event_loop().run_until_complete(seed())

        r = requests.get(f"{API}/plan/status", headers=headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["sessoes_mes_used"] == 5
        assert d["sessoes_mes_max"] == 5
