"""Notes to Admin, acknowledgments, the "My Updates" feed, and diagnostic logs."""
from conftest import postgres_only


def send_note(client, headers, **fields):
    body = {"title": "Car broke down", "lot_name": "Lot 20", "phone_number": "(940) 555-0100",
            "plate_state": "tx", "plate_number": "abc 1234", **fields}
    return client.post("/notes", headers=headers, json=body)


def register_device(client, headers, token):
    client.post("/users/me/push-token", headers=headers, json={"token": token})


class TestSendingNotes:
    def test_note_belongs_to_the_signed_in_account(self, client, commuter):
        note = send_note(client, commuter, contact_email="other@gmail.com").json()
        assert note["reporter_email"] == "student@unt.edu"
        assert note["contact_email"] == "other@gmail.com"

    def test_plate_is_normalized(self, client, commuter):
        note = send_note(client, commuter).json()
        assert (note["plate_state"], note["plate_number"]) == ("TX", "ABC1234")

    def test_invalid_plate_rejected(self, client, commuter):
        assert send_note(client, commuter, plate_number="A!").status_code == 422

    def test_at_most_three_photos(self, client, commuter):
        assert send_note(client, commuter, image_urls=["/uploads/1.jpg"] * 4).status_code == 400

    def test_requires_login(self, client):
        assert send_note(client, {}).status_code == 401


class TestAdminView:
    def test_only_admins_see_notes(self, client, commuter, admin):
        send_note(client, commuter)
        assert client.get("/notes", headers=commuter).status_code == 403
        assert [n["title"] for n in client.get("/notes", headers=admin).json()] == ["Car broke down"]

    def test_my_notes_only_shows_my_own(self, client, make_user, commuter):
        other = make_user("other@unt.edu")
        send_note(client, commuter, title="Mine")
        send_note(client, other, title="Theirs")
        mine = client.get("/users/me/notes", headers=commuter).json()
        assert [n["title"] for n in mine] == ["Mine"]
        assert "phone_number" not in mine[0] and "plate_number" not in mine[0]


@postgres_only
class TestAcknowledgment:
    def test_acknowledging_notifies_the_author(self, client, commuter, admin, sent_pushes):
        register_device(client, commuter, "ExponentPushToken[student]")
        note = send_note(client, commuter).json()

        acknowledged = client.put(f"/notes/{note['id']}/acknowledge", headers=admin).json()
        assert acknowledged["acknowledged_at"] is not None
        assert client.get("/users/me/notifications/unread-count", headers=commuter).json() == {"count": 1}
        assert sent_pushes[0]["tokens"] == ["ExponentPushToken[student]"]
        assert "555" not in sent_pushes[0]["body"] and "ABC1234" not in sent_pushes[0]["body"]

    def test_acknowledging_twice_is_a_no_op(self, client, commuter, admin, sent_pushes):
        register_device(client, commuter, "ExponentPushToken[student]")
        note = send_note(client, commuter).json()
        first = client.put(f"/notes/{note['id']}/acknowledge", headers=admin).json()
        second = client.put(f"/notes/{note['id']}/acknowledge", headers=admin).json()
        assert first["acknowledged_at"] == second["acknowledged_at"]
        assert len(sent_pushes) == 1
        assert len(client.get("/users/me/notifications", headers=commuter).json()) == 1

    def test_marking_updates_read(self, client, make_user, commuter, admin):
        for title in ("One", "Two"):
            note = send_note(client, commuter, title=title).json()
            client.put(f"/notes/{note['id']}/acknowledge", headers=admin)
        updates = client.get("/users/me/notifications", headers=commuter).json()

        client.put(f"/users/me/notifications/{updates[0]['id']}/read", headers=commuter)
        assert client.get("/users/me/notifications/unread-count", headers=commuter).json() == {"count": 1}
        client.put("/users/me/notifications/read-all", headers=commuter)
        assert client.get("/users/me/notifications/unread-count", headers=commuter).json() == {"count": 0}

        other = make_user("other@unt.edu")
        assert client.put(f"/users/me/notifications/{updates[0]['id']}/read", headers=other).status_code == 404


def test_acknowledging_requires_admin(client, commuter):
    note = send_note(client, commuter).json()
    assert client.put(f"/notes/{note['id']}/acknowledge", headers=commuter).status_code == 403


def test_acknowledging_missing_note(client, admin):
    assert client.put("/notes/9999/acknowledge", headers=admin).status_code == 404


class TestDiagnosticLogs:
    def test_submitted_logs_are_admin_only(self, client, commuter, admin):
        log = client.post("/logs", headers=commuter, json={"logs": "line 1\nline 2", "platform": "ios"}).json()
        assert log["reporter_email"] == "student@unt.edu"
        assert client.get("/logs", headers=commuter).status_code == 403
        assert client.get(f"/logs/{log['id']}", headers=admin).json()["logs"] == "line 1\nline 2"
        assert len(client.get("/logs?reporter_email=student@unt.edu", headers=admin).json()) == 1

    def test_missing_log(self, client, admin):
        assert client.get("/logs/9999", headers=admin).status_code == 404
