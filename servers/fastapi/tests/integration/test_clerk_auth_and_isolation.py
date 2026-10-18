import asyncio
import os
import uuid
import pytest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.middlewares import SessionAuthMiddleware
from api.v1.auth.router import API_V1_AUTH_ROUTER
from api.v1.ppt.router import API_V1_PPT_ROUTER
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from models.sql.user import User
from services.database import get_async_session, _scope_owned_selects
from sqlalchemy.orm import Session


@pytest.fixture(autouse=True)
def isolate_environment(tmp_path_factory, monkeypatch):
    temp_dir = tmp_path_factory.mktemp("config")
    monkeypatch.setenv("USER_CONFIG_PATH", str(temp_dir / "userConfig.json"))
    with patch.dict("os.environ"):
        yield


def _build_test_app(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'clerk_test.db'}")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def init_tables():
        async with engine.begin() as conn:
            await conn.run_sync(User.__table__.create)
            await conn.run_sync(PresentationModel.__table__.create)
            await conn.run_sync(SlideModel.__table__.create)

    asyncio.run(init_tables())

    async def override_session():
        async with session_maker() as session:
            yield session

    app = FastAPI()
    app.include_router(API_V1_AUTH_ROUTER)
    app.include_router(API_V1_PPT_ROUTER)
    app.dependency_overrides[get_async_session] = override_session

    # Attach SessionAuthMiddleware with mocked session_maker
    with patch("api.middlewares.async_session_maker", session_maker):
        app.add_middleware(SessionAuthMiddleware)

    return app, engine, session_maker


def test_clerk_rejects_untrusted_spoofed_header_when_secret_configured(tmp_path, monkeypatch):
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_correct_secret")
    monkeypatch.delenv("DISABLE_AUTH", raising=False)

    app, engine, session_maker = _build_test_app(tmp_path)
    client = TestClient(app)

    try:
        with patch("api.middlewares.async_session_maker", session_maker):
            # Attempt to spoof user identity without internal secret
            resp = client.get(
                "/api/v1/ppt/presentation/all",
                headers={"x-clerk-user-id": "user_malicious_attacker"},
            )
            assert resp.status_code == 401
            assert "Untrusted or unverified" in resp.json()["detail"]

            # Attempt to spoof with wrong internal secret
            resp = client.get(
                "/api/v1/ppt/presentation/all",
                headers={
                    "x-clerk-user-id": "user_malicious_attacker",
                    "x-clerk-internal-secret": "sk_test_wrong_secret",
                },
            )
            assert resp.status_code == 401
            assert "Untrusted or unverified" in resp.json()["detail"]
    finally:
        asyncio.run(engine.dispose())


def test_clerk_trusted_user_registration_and_no_duplicates(tmp_path, monkeypatch):
    test_secret = "sk_test_verified_secret_123"
    monkeypatch.setenv("CLERK_SECRET_KEY", test_secret)
    monkeypatch.delenv("DISABLE_AUTH", raising=False)

    app, engine, session_maker = _build_test_app(tmp_path)
    client = TestClient(app)

    try:
        with patch("api.middlewares.async_session_maker", session_maker):
            headers = {
                "x-clerk-user-id": "user_clerk_alice_999",
                "x-clerk-user-email": "alice@example.com",
                "x-clerk-internal-secret": test_secret,
            }

            # 1. First request creates user
            status_resp = client.get("/api/v1/auth/status", headers=headers)
            assert status_resp.status_code == 200
            data = status_resp.json()
            assert data["authenticated"] is True
            assert data["username"] == "alice@example.com"
            assert data["user_id"] == "user_clerk_alice_999"
            assert data["role"] == "user"

            # 2. Verify in DB
            async def get_users():
                async with session_maker() as s:
                    res = await s.execute(select(User))
                    return res.scalars().all()

            users = asyncio.run(get_users())
            assert len(users) == 1
            alice = users[0]
            assert alice.username == "user_clerk_alice_999"
            assert alice.is_superuser is False
            assert alice.is_active is True

            # 3. Repeated request should not create a duplicate user
            status_resp2 = client.get("/api/v1/auth/status", headers=headers)
            assert status_resp2.status_code == 200

            users_after = asyncio.run(get_users())
            assert len(users_after) == 1
            assert users_after[0].id == alice.id
    finally:
        asyncio.run(engine.dispose())


def test_clerk_multi_tenant_presentation_isolation(tmp_path, monkeypatch):
    test_secret = "sk_test_isolation_secret_456"
    monkeypatch.setenv("CLERK_SECRET_KEY", test_secret)
    monkeypatch.delenv("DISABLE_AUTH", raising=False)

    app, engine, session_maker = _build_test_app(tmp_path)
    client = TestClient(app)

    try:
        with patch("api.middlewares.async_session_maker", session_maker):
            alice_headers = {
                "x-clerk-user-id": "user_clerk_alice",
                "x-clerk-user-email": "alice@example.com",
                "x-clerk-internal-secret": test_secret,
            }
            bob_headers = {
                "x-clerk-user-id": "user_clerk_bob",
                "x-clerk-user-email": "bob@example.com",
                "x-clerk-internal-secret": test_secret,
            }

            # Pre-authenticate both users to create their DB records
            client.get("/api/v1/auth/status", headers=alice_headers)
            client.get("/api/v1/auth/status", headers=bob_headers)

            async def get_user_id(username):
                async with session_maker() as s:
                    res = await s.execute(select(User).where(User.username == username))
                    return res.scalars().first().id

            alice_db_id = asyncio.run(get_user_id("user_clerk_alice"))
            bob_db_id = asyncio.run(get_user_id("user_clerk_bob"))

            # Create a presentation owned by Alice
            alice_presentation_id = uuid.uuid4()

            async def create_alice_presentation():
                async with session_maker() as s:
                    pres = PresentationModel(
                        id=alice_presentation_id,
                        owner_id=alice_db_id,
                        version=PresentationVersion.V2_STANDARD,
                        content="Alice private presentation",
                        n_slides=1,
                        language="en",
                        title="Alice Presentation",
                    )
                    slide = SlideModel(
                        id=uuid.uuid4(),
                        presentation=alice_presentation_id,
                        owner_id=alice_db_id,
                        layout_group="standard",
                        layout="standard",
                        index=0,
                        content={"title": "Alice Slide 1"},
                        ui={"type": "standard"},
                    )
                    s.add(pres)
                    s.add(slide)
                    await s.commit()

            asyncio.run(create_alice_presentation())

            # 1. Alice queries /all: should see her presentation
            alice_all = client.get("/api/v1/ppt/presentation/all", headers=alice_headers)
            assert alice_all.status_code == 200
            alice_ids = [p["id"] for p in alice_all.json()]
            assert str(alice_presentation_id) in alice_ids

            # 2. Bob queries /all: should NOT see Alice's presentation
            bob_all = client.get("/api/v1/ppt/presentation/all", headers=bob_headers)
            assert bob_all.status_code == 200
            bob_ids = [p["id"] for p in bob_all.json()]
            assert str(alice_presentation_id) not in bob_ids

            # 3. Bob attempts GET /presentation/{alice_presentation_id}: must return 404
            bob_get = client.get(
                f"/api/v1/ppt/presentation/{alice_presentation_id}",
                headers=bob_headers,
            )
            assert bob_get.status_code == 404

            # 4. Bob attempts DELETE /presentation/{alice_presentation_id}: must return 404
            bob_del = client.delete(
                f"/api/v1/ppt/presentation/{alice_presentation_id}",
                headers=bob_headers,
            )
            assert bob_del.status_code == 404

            # 5. Verify Alice's presentation was NOT deleted and Alice can still access it
            alice_get = client.get(
                f"/api/v1/ppt/presentation/{alice_presentation_id}",
                headers=alice_headers,
            )
            assert alice_get.status_code == 200
            assert alice_get.json()["title"] == "Alice Presentation"
    finally:
        asyncio.run(engine.dispose())
