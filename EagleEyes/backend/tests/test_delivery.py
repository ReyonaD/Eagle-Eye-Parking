"""Outgoing messages: Expo push requests and password reset emails (no real network)."""
import json
import logging

import httpx
import pytest

from conftest import REAL_PUSH_SEND
from app.core import email, push
from app.models import PushToken, User


@pytest.fixture
def expo(monkeypatch):
    """Answers Expo push requests with `tickets`; records what was posted."""
    state = {"requests": [], "tickets": None, "status": 200}

    def handler(request):
        messages = json.loads(request.content)
        state["requests"].append(messages)
        tickets = state["tickets"] or [{"status": "ok"} for _ in messages]
        return httpx.Response(state["status"], json={"data": tickets})

    real_client = httpx.Client
    monkeypatch.setattr(push.httpx, "Client", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    return state


@pytest.fixture
def tokens(db):
    user = User(email="phone@unt.edu", hashed_password="x")
    db.add(user)
    db.commit()
    for token in ("ExponentPushToken[a]", "ExponentPushToken[b]"):
        db.add(PushToken(user_id=user.id, token=token))
    db.commit()
    return ["ExponentPushToken[a]", "ExponentPushToken[b]"]


class TestExpoPush:
    def test_sends_one_message_per_device(self, db, expo, tokens):
        REAL_PUSH_SEND(db, tokens, "Hazard at Lot 20", "ICE", {"alert_id": 1}, "alert 1")
        messages = expo["requests"][0]
        assert [m["to"] for m in messages] == tokens
        assert messages[0]["title"] == "Hazard at Lot 20"
        assert messages[0]["channelId"] == "alerts"

    def test_batches_large_sends(self, db, expo):
        many = [f"ExponentPushToken[{i}]" for i in range(push.EXPO_BATCH_SIZE + 5)]
        REAL_PUSH_SEND(db, many, "t", "b", {}, "batch")
        assert [len(r) for r in expo["requests"]] == [push.EXPO_BATCH_SIZE, 5]

    def test_forgets_devices_that_uninstalled_the_app(self, db, expo, tokens):
        expo["tickets"] = [{"status": "error", "details": {"error": "DeviceNotRegistered"}}, {"status": "ok"}]
        REAL_PUSH_SEND(db, tokens, "t", "b", {}, "cleanup")
        assert [row.token for row in db.query(PushToken).all()] == ["ExponentPushToken[b]"]

    def test_expo_outage_is_logged_not_raised(self, db, expo, tokens, caplog):
        expo["status"] = 500
        with caplog.at_level(logging.WARNING):
            REAL_PUSH_SEND(db, tokens, "t", "b", {}, "outage")
        assert "Expo push request failed" in caplog.text
        assert db.query(PushToken).count() == 2

    def test_other_errors_keep_the_device(self, db, expo, tokens, caplog):
        expo["tickets"] = [{"status": "error", "details": {"error": "MessageRateExceeded"}}, {"status": "ok"}]
        with caplog.at_level(logging.WARNING):
            REAL_PUSH_SEND(db, tokens, "t", "b", {}, "rate")
        assert "MessageRateExceeded" in caplog.text
        assert db.query(PushToken).count() == 2


class TestAlertMessage:
    def test_title_names_the_lot_and_body_is_shortened(self):
        alert = push.Alert(alert_type="hazard", lot_name="Lot 20", title="ICE",
                           description="x" * 300 + "\nAlso reported: more")
        title, body = push._alert_message(alert)
        assert title == "Hazard at Lot 20"
        assert body.startswith("ICE: xxx") and body.endswith("…")
        assert len(body) == push.MAX_BODY_LENGTH

    def test_campus_wide_event(self):
        title, body = push._alert_message(push.Alert(alert_type="event", title="GAMEDAY"))
        assert (title, body) == ("New event", "GAMEDAY")


class FakeSMTP:
    sent = []
    fail = False

    def __init__(self, host, port, timeout):
        self.host = host

    def __enter__(self):
        if FakeSMTP.fail:
            raise OSError("connection refused")
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        pass

    def login(self, user, password):
        pass

    def sendmail(self, sender, to, message):
        FakeSMTP.sent.append((to, message))


class TestResetEmail:
    @pytest.fixture(autouse=True)
    def smtp(self, monkeypatch):
        FakeSMTP.sent, FakeSMTP.fail = [], False
        monkeypatch.setattr(email.smtplib, "SMTP", FakeSMTP)
        monkeypatch.setattr(email, "SMTP_USER", "eagleeyes@gmail.com")
        monkeypatch.setattr(email, "SMTP_PASSWORD", "app-password")

    def test_sends_the_code(self):
        email.send_password_reset_email("student@unt.edu", "123456")
        to, message = FakeSMTP.sent[0]
        assert to == "student@unt.edu"
        assert "123456" in message

    def test_mail_failure_is_logged_not_raised(self, caplog):
        FakeSMTP.fail = True
        with caplog.at_level(logging.ERROR):
            email.send_password_reset_email("student@unt.edu", "123456")
        assert "Failed to send password reset email" in caplog.text

    def test_without_smtp_settings_nothing_is_sent(self, monkeypatch, caplog):
        monkeypatch.setattr(email, "SMTP_USER", None)
        with caplog.at_level(logging.WARNING):
            email.send_password_reset_email("student@unt.edu", "123456")
        assert FakeSMTP.sent == []
        assert "SMTP not configured" in caplog.text
