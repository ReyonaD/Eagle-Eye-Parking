"""Smoke test for admin access changes + lot closure rules.

Runs the real FastAPI app against a throwaway in-memory SQLite database (never
the Neon DB in .env) and exits non-zero on any failure:

    cd backend && venv/bin/python3 tests/test_admin_and_closures.py
"""
import os, sys, types
from datetime import datetime, timedelta, timezone
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.environ.setdefault("SECRET_KEY", "test-secret")

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
@event.listens_for(engine, "before_cursor_execute", retval=True)
def _skip_pg_only(conn, cursor, statement, params, context, executemany):
    if statement.lstrip().upper().startswith("ALTER TABLE") or "information_schema" in statement:
        return "SELECT 1", ()
    return statement, params

fake = types.ModuleType("app.database")
fake.engine = engine
fake.session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
fake.Base = declarative_base()
def get_db():
    db = fake.session_local()
    try: yield db
    finally: db.close()
fake.get_db = get_db
import app
sys.modules["app.database"] = fake
app.database = fake

from fastapi.testclient import TestClient
import app.main as m
m.send_alert_published = lambda *a, **k: None
c = TestClient(m.app)
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if not cond else ""))
    if not cond: fails.append(name)

def register(email, pw="pw123456"):
    c.post("/register", json={"email": email, "password": pw})
def login(email, pw="pw123456"):
    r = c.post("/login", data={"username": email, "password": pw})
    return {"Authorization": f"Bearer {r.json()['access_token']}"} if r.status_code == 200 else r
db = fake.session_local()
def set_user(email, **kw):
    u = db.query(m.User).filter(m.User.email == email).first()
    for k, v in kw.items(): setattr(u, k, v)
    db.commit()

# ── admin management ──
register("Owner@UNT.edu"); register("owner2@unt.edu"); register("admin@unt.edu"); register("stu@unt.edu")
check("register lowercases email", db.query(m.User).filter(m.User.email == "owner@unt.edu").first() is not None)
check("duplicate with different case rejected", c.post("/register", json={"email": "OWNER@unt.edu", "password": "x"}).status_code == 400)
set_user("owner@unt.edu", role="admin", is_owner=True)
set_user("owner2@unt.edu", role="admin", is_owner=True)
owner = login("OWNER@unt.edu"); check("login is case-insensitive", isinstance(owner, dict))
owner2 = login("owner2@unt.edu"); stu = login("stu@unt.edu"); adm = login("admin@unt.edu")

r = c.put("/admin/users/admin@unt.edu/promote", headers=owner); check("owner can promote", r.status_code == 200, r.text)
r = c.get("/alerts/pending?alert_type=hazard", headers=adm)
check("promotion works without re-login (old token)", r.status_code == 200, r.text)
r = c.put("/admin/users/admin@unt.edu/promote", headers=owner); check("promote already-admin -> 400", r.status_code == 400)
r = c.put("/admin/users/stu@unt.edu/promote", headers=adm); check("non-owner admin cannot promote", r.status_code == 403)

r = c.put("/admin/users/admin@unt.edu/revoke", headers=owner); check("owner revokes admin", r.status_code == 200, r.text)
r = c.get("/alerts/pending?alert_type=hazard", headers=adm)
check("revoked admin blocked immediately", r.status_code == 403 and r.json()["detail"] == "admin_revoked", r.text)
r = c.put("/admin/users/admin@unt.edu/revoke", headers=owner); check("revoke non-admin -> 400", r.status_code == 400)

r = c.put("/admin/users/owner@unt.edu/revoke", headers=owner2); check("owner2 revokes owner1", r.status_code == 200, r.text)
r = c.put("/admin/users/owner2@unt.edu/revoke", headers=owner)
check("revoked owner cannot revoke others", r.status_code == 403, r.text)
r = c.put("/admin/users/OWNER2@unt.edu/revoke", headers=owner2); check("cannot revoke self (any case)", r.status_code == 400)
r = c.get("/users/me", headers=owner); check("/users/me shows demotion", r.json()["role"] == "commuter" and r.json()["is_owner"] is False)

set_user("stu@unt.edu", is_active=False)
check("inactive user's token rejected", c.get("/users/me", headers=stu).status_code == 401)
check("inactive user cannot log in", not isinstance(login("stu@unt.edu"), dict))
set_user("stu@unt.edu", is_active=True)

# ── closures ──
now = datetime.now(timezone.utc)
iso = lambda d: d.isoformat()
r = c.post("/alerts", headers=owner2, json={"title": "Gameday closure", "alert_type": "event", "category": "Lot Closure",
            "lot_name": "Lot 20; Lot 24", "event_start": iso(now - timedelta(hours=1)), "event_end": iso(now + timedelta(hours=3))})
check("admin creates closure", r.status_code == 200, r.text)
closure_id = r.json()["id"]
r = c.post("/alerts", headers=stu, json={"title": "ICE", "alert_type": "hazard", "category": "ice", "lot_name": "Lot 24"})
check("commuter hazard on closed lot -> 409", r.status_code == 409, r.text)
r = c.post("/alerts", headers=stu, json={"title": "ICE", "alert_type": "hazard", "category": "ice", "lot_name": "lot 24"})
check("closure match is case-insensitive", r.status_code == 409, r.text)
r = c.post("/alerts", headers=stu, json={"title": "ICE", "alert_type": "hazard", "category": "ice", "lot_name": "Lot 50"})
check("commuter hazard on open lot OK", r.status_code == 200, r.text)
pending_id = r.json()["id"]
r = c.post("/alerts", headers=stu, json={"title": "ICE", "alert_type": "hazard", "category": "ice"})
check("commuter hazard with no lot and no description -> 400", r.status_code == 400, r.text)
r = c.post("/alerts", headers=stu, json={"title": "ICE", "alert_type": "hazard", "category": "ice", "description": "   "})
check("blank description doesn't count as a location", r.status_code == 400, r.text)
r = c.post("/alerts", headers=stu, json={"title": "ICE", "alert_type": "hazard", "category": "ice",
            "description": "Road behind Lot 20"})
check("'Not in a lot' hazard with a description OK", r.status_code == 200, r.text)
r = c.post("/alerts", headers=owner2, json={"title": "ICE", "alert_type": "hazard", "category": "ice"})
check("admin campus-wide hazard (no lot) OK", r.status_code == 200, r.text)
r = c.post("/alerts", headers=owner2, json={"title": "ICE", "alert_type": "hazard", "category": "ice", "lot_name": "Lot 20"})
check("admin hazard on closed lot allowed + warned", r.status_code == 200 and len(r.json()["conflicts"]) == 1, r.text)

r = c.post("/alerts", headers=owner2, json={"title": "Concert", "alert_type": "event", "category": "Concert",
            "lot_name": "Lot 20", "event_start": iso(now + timedelta(hours=2)), "event_end": iso(now + timedelta(hours=5))})
check("event overlapping closure returns conflict", r.status_code == 200 and [x["id"] for x in r.json()["conflicts"]] == [closure_id], r.text)
concert_id = r.json()["id"]
r = c.post("/alerts", headers=owner2, json={"title": "Later", "alert_type": "event", "category": "Concert",
            "lot_name": "Lot 20", "event_start": iso(now + timedelta(hours=3)), "event_end": iso(now + timedelta(hours=6))})
check("back-to-back event is not a conflict", r.json()["conflicts"] == [], r.text)
r = c.post("/alerts", headers=owner2, json={"title": "Close 20", "alert_type": "event", "category": "Lot Closure",
            "lot_name": "Lot 20", "event_start": iso(now + timedelta(hours=4))})
ids = {x["id"] for x in r.json()["conflicts"]}
check("open-ended closure lists overlapping events of any kind", concert_id in ids and closure_id not in ids, r.text)
r = c.put(f"/alerts/{concert_id}", headers=owner2, json={"title": "Concert", "category": "Concert", "lot_name": "Lot 20",
            "event_start": iso(now + timedelta(hours=2)), "event_end": iso(now + timedelta(hours=5))})
check("edit event: conflicts exclude itself", r.status_code == 200 and concert_id not in {x["id"] for x in r.json()["conflicts"]}, r.text)

# approve after the lot closes
c.post("/alerts", headers=owner2, json={"title": "Close 50", "alert_type": "event", "category": "Closure",
        "lot_name": "Lot 50", "event_start": iso(now - timedelta(minutes=5))})
r = c.put(f"/alerts/{pending_id}/approve", headers=owner2, json={})
check("approve on now-closed lot (legacy 'Closure') warns", r.status_code == 200 and len(r.json()["conflicts"]) == 1, r.text)

# ── privacy / upvotes ──
r = c.get("/alerts?alert_type=hazard"); check("public feed hides reporter emails", all(a["reporter_emails"] == [] for a in r.json()))
r = c.get("/alerts?alert_type=hazard", headers=owner2); check("admin feed shows reporter emails", any(a["reporter_emails"] for a in r.json()))
check("upvote requires login", c.put(f"/alerts/{pending_id}/upvote").status_code == 401)
u1 = c.put(f"/alerts/{pending_id}/upvote", headers=adm).json()["upvotes"]
u2 = c.put(f"/alerts/{pending_id}/upvote", headers=adm).json()["upvotes"]
check("same user upvoting twice counts once", u1 == u2 == 2, f"{u1},{u2}")

# ── license plates ──
r = c.put("/users/me/plate", headers=owner2, json={"plate_state": "tx", "plate_number": "abc-1234"})
check("plate normalized (uppercase, no dash)", r.status_code == 200 and r.json() == {"plate_state": "TX", "plate_number": "ABC1234"}, r.text)
r = c.put("/users/me/plate", headers=owner2, json={"plate_state": "TX", "plate_number": "EAGLE1"})
check("vanity plate allowed", r.status_code == 200, r.text)
r = c.put("/users/me/plate", headers=owner2, json={"plate_state": "TX", "plate_number": "ABCDE12345"})
check("plate longer than 8 rejected", r.status_code == 422, r.text)
r = c.put("/users/me/plate", headers=owner2, json={"plate_state": "ZZ", "plate_number": "ABC1234"})
check("unknown state rejected", r.status_code == 422, r.text)
r = c.put("/users/me/plate", headers=owner2, json={"plate_state": "TX", "plate_number": ""})
check("empty plate clears it", r.status_code == 200 and r.json()["plate_number"] == "", r.text)
r = c.post("/notes", headers=stu, json={"title": "Stuck", "lot_name": "Lot 20", "plate_state": "tx", "plate_number": "abc 1234"})
check("note plate normalized", r.status_code == 200 and r.json()["plate_number"] == "ABC1234", r.text)
r = c.post("/notes", headers=stu, json={"title": "Stuck", "lot_name": "Lot 20", "plate_state": "TX", "plate_number": "A!"})
check("note with invalid plate rejected", r.status_code == 422, r.text)

print("\n%d failure(s)" % len(fails)); sys.exit(1 if fails else 0)
