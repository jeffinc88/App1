"""StudyLoop NPS Survey backend tests — Iteration 5.

Validates the eligibility rules, snooze behaviour (max 2 attempts), and
permanent dismissal flow. Uses Motor to time-travel users.created_at and
nps_surveys.snoozed_until.
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://doc-to-app-96.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- Helpers ----------
def _register_user():
    email = f"TEST_nps_{uuid.uuid4().hex[:10]}@studyloop.app"
    pwd = "senha123!"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": pwd, "name": "NPS Tester"},
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _mongo():
    client = AsyncIOMotorClient(MONGO_URL)
    return client, client[DB_NAME]


async def _age_user(user_id: str, days: int):
    client, db = await _mongo()
    try:
        new_created = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        await db.users.update_one({"user_id": user_id}, {"$set": {"created_at": new_created}})
    finally:
        client.close()


async def _insert_sessoes(user_id: str, count: int = 3):
    client, db = await _mongo()
    try:
        docs = []
        for i in range(count):
            docs.append({
                "sessao_id": f"TEST_sess_{uuid.uuid4().hex[:8]}",
                "user_id": user_id,
                "tipo": "quiz",
                "total_questoes": 5,
                "acertos": 4,
                "duracao_segundos": 60,
                "concluida": True,
                "pontuacao": 80,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        await db.sessoes.insert_many(docs)
    finally:
        client.close()


async def _set_snoozed_past(user_id: str):
    client, db = await _mongo()
    try:
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        await db.nps_surveys.update_one({"user_id": user_id}, {"$set": {"snoozed_until": past}})
    finally:
        client.close()


async def _clear_snoozed(user_id: str):
    client, db = await _mongo()
    try:
        await db.nps_surveys.update_one({"user_id": user_id}, {"$set": {"snoozed_until": None}})
    finally:
        client.close()


async def _cleanup(user_id: str):
    client, db = await _mongo()
    try:
        await db.users.delete_many({"user_id": user_id})
        await db.sessoes.delete_many({"user_id": user_id})
        await db.nps_surveys.delete_many({"user_id": user_id})
    finally:
        client.close()


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


# ---------- Test class ----------
class TestNps:
    """NPS Survey — eligibility, snooze (max 2 attempts), submit, permanent dismiss."""

    def test_fresh_user_show_false(self):
        ctx = _register_user()
        try:
            r = requests.get(f"{API}/nps/status", headers=_auth(ctx["token"]), timeout=15)
            assert r.status_code == 200
            assert r.json() == {"show": False}
        finally:
            run(_cleanup(ctx["user"]["user_id"]))

    def test_no_auth_returns_401(self):
        r1 = requests.get(f"{API}/nps/status", timeout=10)
        assert r1.status_code == 401
        r2 = requests.post(f"{API}/nps/submit", json={"nota": 9}, timeout=10)
        assert r2.status_code == 401
        r3 = requests.post(f"{API}/nps/snooze", timeout=10)
        assert r3.status_code == 401

    def test_aged_but_only_2_sessions_show_false(self):
        ctx = _register_user()
        uid = ctx["user"]["user_id"]
        try:
            run(_age_user(uid, 15))
            run(_insert_sessoes(uid, 2))
            r = requests.get(f"{API}/nps/status", headers=_auth(ctx["token"]), timeout=15)
            assert r.status_code == 200
            assert r.json()["show"] is False, "Should not show: account aged but <3 sessions"
        finally:
            run(_cleanup(uid))

    def test_eligible_user_show_true(self):
        ctx = _register_user()
        uid = ctx["user"]["user_id"]
        try:
            run(_age_user(uid, 15))
            run(_insert_sessoes(uid, 3))
            r = requests.get(f"{API}/nps/status", headers=_auth(ctx["token"]), timeout=15)
            assert r.status_code == 200
            assert r.json()["show"] is True
        finally:
            run(_cleanup(uid))

    def test_snooze_flow_two_attempts_max(self):
        """Full snooze flow: 1st snooze → hidden 7d, fast-forward → shows again,
        2nd snooze → dismissed PERMANENTLY (clearing snoozed_until still hides)."""
        ctx = _register_user()
        uid = ctx["user"]["user_id"]
        h = _auth(ctx["token"])
        try:
            run(_age_user(uid, 15))
            run(_insert_sessoes(uid, 3))

            # First eligibility check → show
            assert requests.get(f"{API}/nps/status", headers=h, timeout=15).json()["show"] is True

            # First snooze
            r = requests.post(f"{API}/nps/snooze", headers=h, timeout=15)
            assert r.status_code == 200, r.text
            j = r.json()
            assert j["attempts"] == 1
            assert j["snoozed_until"] is not None

            # Hidden while snoozed
            assert requests.get(f"{API}/nps/status", headers=h, timeout=15).json()["show"] is False

            # Time-travel snoozed_until to past
            run(_set_snoozed_past(uid))
            assert requests.get(f"{API}/nps/status", headers=h, timeout=15).json()["show"] is True

            # Second snooze → reach MAX_ATTEMPTS → dismissed
            r = requests.post(f"{API}/nps/snooze", headers=h, timeout=15)
            assert r.status_code == 200, r.text
            j = r.json()
            assert j["attempts"] == 2
            assert j["snoozed_until"] is None

            # Hidden permanently — even after clearing snoozed_until
            run(_clear_snoozed(uid))
            assert requests.get(f"{API}/nps/status", headers=h, timeout=15).json()["show"] is False
        finally:
            run(_cleanup(uid))

    def test_submit_valid_and_hides_permanently(self):
        ctx = _register_user()
        uid = ctx["user"]["user_id"]
        h = _auth(ctx["token"])
        try:
            run(_age_user(uid, 15))
            run(_insert_sessoes(uid, 3))
            assert requests.get(f"{API}/nps/status", headers=h, timeout=15).json()["show"] is True

            r = requests.post(
                f"{API}/nps/submit",
                json={"nota": 9, "comentario": "gostei muito"},
                headers=h,
                timeout=15,
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["nota"] == 9
            assert "survey_id" in d

            # Verify Mongo doc shape
            async def _check():
                client, db = await _mongo()
                try:
                    rec = await db.nps_surveys.find_one({"user_id": uid}, {"_id": 0})
                    return rec
                finally:
                    client.close()

            rec = run(_check())
            assert rec is not None
            assert rec["status"] == "answered"
            assert rec["nota"] == 9
            assert rec["comentario"] == "gostei muito"

            # No more show
            assert requests.get(f"{API}/nps/status", headers=h, timeout=15).json()["show"] is False
        finally:
            run(_cleanup(uid))

    def test_submit_invalid_nota(self):
        ctx = _register_user()
        h = _auth(ctx["token"])
        try:
            r1 = requests.post(f"{API}/nps/submit", json={"nota": 11}, headers=h, timeout=10)
            assert r1.status_code == 400
            r2 = requests.post(f"{API}/nps/submit", json={"nota": -1}, headers=h, timeout=10)
            assert r2.status_code == 400
        finally:
            run(_cleanup(ctx["user"]["user_id"]))
