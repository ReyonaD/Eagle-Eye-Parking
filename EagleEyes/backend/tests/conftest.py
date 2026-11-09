"""Shared test setup.

Tests never touch the real database in .env:
- TEST_DATABASE_URL set (CI, or a local Postgres) -> that Postgres database
- otherwise -> in-memory SQLite (tests marked `postgres_only` are skipped)

Push notifications and emails are replaced with recorders, so tests can check
what would have been sent without calling Expo or Gmail.
"""
import os
import sys
import types

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-used-anywhere")
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
USING_POSTGRES = bool(TEST_DATABASE_URL)

if USING_POSTGRES:
    # same session time zone as app/database.py
    engine = create_engine(TEST_DATABASE_URL, connect_args={"options": "-c timezone=UTC"})
else:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "before_cursor_execute", retval=True)
    def _skip_postgres_only_startup(conn, cursor, statement, params, context, executemany):
        # app.main patches columns in with Postgres-only ALTER TABLE statements at import
        if statement.lstrip().upper().startswith("ALTER TABLE") or "information_schema" in statement:
            return "SELECT 1", ()
        return statement, params

# Stand-in for app.database, installed before anything imports the real one
test_database = types.ModuleType("app.database")
test_database.engine = engine
test_database.session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
test_database.Base = declarative_base()


def _get_db():
    db = test_database.session_local()
    try:
        yield db
    finally:
        db.close()


test_database.get_db = _get_db
import app  # noqa: E402

sys.modules["app.database"] = test_database
app.database = test_database

from fastapi.testclient import TestClient  # noqa: E402
import app.main as main  # noqa: E402
from app.core import push  # noqa: E402

# the real sender, for tests of the Expo request itself (the fixture below replaces it)
REAL_PUSH_SEND = push._send
from app.models import User  # noqa: E402
from app.core import security  # noqa: E402

# Full-strength bcrypt takes ~0.25s per hash; tests only need it to work, not to be slow
security.pwd_context.update(bcrypt__rounds=4)

postgres_only = pytest.mark.skipif(not USING_POSTGRES, reason="needs Postgres (set TEST_DATABASE_URL)")

PASSWORD = "pw123456"


@pytest.fixture(autouse=True)
def clean_database():
    """Every test starts with empty tables."""
    test_database.Base.metadata.drop_all(bind=engine)
    test_database.Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db():
    session = test_database.session_local()
    yield session
    session.close()


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def sent_pushes(monkeypatch):
    """Records push notifications instead of sending them to Expo."""
    sent = []
    monkeypatch.setattr(push, "_send", lambda db, tokens, title, body, data, log_ref: sent.append(
        {"tokens": sorted(tokens), "title": title, "body": body, "data": data}
    ))
    return sent


@pytest.fixture(autouse=True)
def sent_reset_codes(monkeypatch):
    """Records password reset emails instead of sending them."""
    sent = {}
    monkeypatch.setattr(main, "send_password_reset_email", lambda email, code: sent.__setitem__(email, code))
    return sent


@pytest.fixture(autouse=True)
def upload_dir(monkeypatch, tmp_path):
    """Uploaded photos go to a temp folder, not backend/static/uploads."""
    monkeypatch.setattr(main, "UPLOAD_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def make_user(client, db):
    """Registers a user with the given role and returns their auth headers."""

    def _make(email, role="commuter", is_owner=False, is_active=True):
        assert client.post("/register", json={"email": email, "password": PASSWORD}).status_code == 201
        if role != "commuter" or is_owner or not is_active:
            user = db.query(User).filter(User.email == email.lower()).one()
            user.role, user.is_owner, user.is_active = role, is_owner, is_active
            db.commit()
        response = client.post("/login", data={"username": email, "password": PASSWORD})
        if response.status_code != 200:
            return None
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _make


@pytest.fixture
def owner(make_user):
    return make_user("owner@unt.edu", role="admin", is_owner=True)


@pytest.fixture
def admin(make_user):
    return make_user("admin@unt.edu", role="admin")


@pytest.fixture
def commuter(make_user):
    return make_user("student@unt.edu")
