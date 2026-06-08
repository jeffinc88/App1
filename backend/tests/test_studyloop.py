"""StudyLoop backend regression tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-to-app-96.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def user_ctx():
    """Register a fresh user and return token + user."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@studyloop.app"
    payload = {"email": email, "password": "senha123!", "name": "Test User"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert "password_hash" not in data["user"]
    return {"token": data["token"], "user": data["user"], "email": email, "password": "senha123!"}


@pytest.fixture(scope="module")
def auth_headers(user_ctx):
    return {"Authorization": f"Bearer {user_ctx['token']}"}


# --- AUTH ---
class TestAuth:
    def test_login_success(self, user_ctx):
        r = requests.post(f"{API}/auth/login", json={"email": user_ctx["email"], "password": user_ctx["password"]}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["email"] == user_ctx["email"]

    def test_login_wrong_password(self, user_ctx):
        r = requests.post(f"{API}/auth/login", json={"email": user_ctx["email"], "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_returns_user_without_password(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "password_hash" not in d
        assert "email" in d

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_onboarding_persists(self, auth_headers):
        r = requests.post(f"{API}/auth/onboarding", headers=auth_headers,
                          json={"nivel_ensino": "graduacao", "horas_diarias": 2}, timeout=15)
        assert r.status_code == 200
        # verify via me
        me = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=10).json()
        assert me["onboarding_done"] is True
        assert me["nivel_ensino"] == "graduacao"
        assert me["horas_diarias"] == 2


# --- MATERIAS ---
class TestMaterias:
    materia_id = None

    def test_create_materia(self, auth_headers):
        r = requests.post(f"{API}/materias", headers=auth_headers,
                          json={"nome": "TEST_Biologia", "cor": "#F5A623", "icone": "book"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["nome"] == "TEST_Biologia"
        assert "materia_id" in d
        TestMaterias.materia_id = d["materia_id"]

    def test_list_materias(self, auth_headers):
        r = requests.get(f"{API}/materias", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert any(m["materia_id"] == TestMaterias.materia_id for m in items)

    def test_patch_materia(self, auth_headers):
        r = requests.patch(f"{API}/materias/{TestMaterias.materia_id}", headers=auth_headers,
                           json={"nome": "TEST_Bio_Updated"}, timeout=15)
        assert r.status_code == 200
        # verify
        items = requests.get(f"{API}/materias", headers=auth_headers, timeout=15).json()
        found = [m for m in items if m["materia_id"] == TestMaterias.materia_id]
        assert found and found[0]["nome"] == "TEST_Bio_Updated"


# --- CONTENT INGESTION (AI) ---
class TestContent:
    fonte_id = None
    materia_id_local = None

    def test_create_text_fonte_generates_ai(self, auth_headers):
        # Create dedicated materia
        m = requests.post(f"{API}/materias", headers=auth_headers,
                          json={"nome": "TEST_AIMateria"}, timeout=15).json()
        TestContent.materia_id_local = m["materia_id"]
        content = (
            "A mitocôndria é uma organela citoplasmática encontrada em células eucariontes. "
            "Sua principal função é a produção de energia (ATP) através do processo de respiração celular. "
            "Possui dupla membrana: externa lisa e interna com dobras chamadas cristas mitocondriais. "
            "Tem DNA próprio (mtDNA) e ribossomos, sendo herdada pela linhagem materna. "
            "A teoria endossimbiótica propõe que mitocôndrias evoluíram de bactérias procariontes."
        )
        r = requests.post(f"{API}/fontes/text", headers=auth_headers,
                          json={"materia_id": TestContent.materia_id_local, "titulo": "Mitocôndria", "conteudo": content},
                          timeout=120)
        assert r.status_code == 200, f"AI fonte failed: {r.status_code} {r.text[:500]}"
        d = r.json()
        assert d["status"] == "ready"
        assert d["total_questoes"] > 0
        assert d["total_flashcards"] > 0
        TestContent.fonte_id = d["fonte_id"]

    def test_get_questoes(self, auth_headers):
        r = requests.get(f"{API}/questoes", params={"materia_id": TestContent.materia_id_local},
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert "enunciado" in items[0] and "opcoes" in items[0]

    def test_get_5min_questoes(self, auth_headers):
        r = requests.get(f"{API}/questoes/5min", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) <= 5

    def test_flashcards_due(self, auth_headers):
        r = requests.get(f"{API}/flashcards/due/{TestContent.materia_id_local}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        TestContent.flashcard_id = items[0]["flashcard_id"]

    def test_flashcard_review_updates_srs(self, auth_headers):
        fc_id = TestContent.flashcard_id
        r = requests.post(f"{API}/flashcards/{fc_id}/review", headers=auth_headers,
                          json={"grade": 2}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["intervalo_dias"] >= 1
        assert "proxima_revisao" in d


# --- SESSIONS / STATS / HOME ---
class TestSessionsStats:
    def test_save_sessao_updates_streak(self, auth_headers):
        r = requests.post(f"{API}/sessoes", headers=auth_headers,
                          json={"tipo": "quiz", "total_questoes": 5, "acertos": 4, "duracao_segundos": 120,
                                "materia_id": TestContent.materia_id_local}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["pontuacao"] == 80.0

    def test_stats(self, auth_headers):
        r = requests.get(f"{API}/stats", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "heatmap" in d and "last7" in d and "taxa_acerto" in d
        assert len(d["last7"]) == 7
        assert d["streak_atual"] >= 1

    def test_home(self, auth_headers):
        r = requests.get(f"{API}/home", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "user" in d and "questoes_disponiveis" in d
        assert d["questoes_disponiveis"] > 0


# --- LINK SCRAPING (optional, slower) ---
class TestLinkSource:
    def test_link_source(self, auth_headers):
        m = requests.post(f"{API}/materias", headers=auth_headers,
                          json={"nome": "TEST_LinkMateria"}, timeout=15).json()
        r = requests.post(f"{API}/fontes/link", headers=auth_headers,
                          json={"materia_id": m["materia_id"], "url": "https://en.wikipedia.org/wiki/Mitochondrion"},
                          timeout=180)
        if r.status_code != 200:
            pytest.skip(f"Link source skipped: {r.status_code} {r.text[:200]}")
        d = r.json()
        assert d["status"] == "ready"
        assert d["total_questoes"] > 0


# --- DELETE materia cascades ---
class TestCleanup:
    def test_delete_materia(self, auth_headers):
        r = requests.delete(f"{API}/materias/{TestMaterias.materia_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = requests.get(f"{API}/materias", headers=auth_headers, timeout=15).json()
        assert not any(m["materia_id"] == TestMaterias.materia_id for m in items)
