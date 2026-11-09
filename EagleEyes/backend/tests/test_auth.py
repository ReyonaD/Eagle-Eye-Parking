"""Registration, login, password reset, and the signed-in user's profile."""
from conftest import PASSWORD


def login(client, email, password=PASSWORD):
    return client.post("/login", data={"username": email, "password": password})


class TestRegisterAndLogin:
    def test_register_stores_lowercase_email(self, client):
        assert client.post("/register", json={"email": "New@UNT.edu", "password": "secret1"}).status_code == 201
        assert login(client, "new@unt.edu", "secret1").status_code == 200

    def test_duplicate_email_rejected_regardless_of_case(self, client):
        client.post("/register", json={"email": "dup@unt.edu", "password": "secret1"})
        response = client.post("/register", json={"email": "DUP@unt.edu", "password": "secret2"})
        assert response.status_code == 400

    def test_invalid_email_rejected(self, client):
        assert client.post("/register", json={"email": "not-an-email", "password": "x"}).status_code == 422

    def test_login_is_case_insensitive(self, client, make_user):
        make_user("case@unt.edu")
        assert login(client, "CASE@UNT.EDU").status_code == 200

    def test_wrong_password_rejected(self, client, make_user):
        make_user("user@unt.edu")
        assert login(client, "user@unt.edu", "wrong").status_code == 401

    def test_login_returns_role(self, client, admin):
        body = login(client, "admin@unt.edu").json()
        assert body["role"] == "admin"
        assert body["is_owner"] is False

    def test_inactive_user_cannot_log_in(self, make_user):
        assert make_user("gone@unt.edu", is_active=False) is None

    def test_deactivating_user_invalidates_existing_token(self, client, db, commuter):
        from app.models import User
        db.query(User).filter(User.email == "student@unt.edu").update({"is_active": False})
        db.commit()
        assert client.get("/users/me", headers=commuter).status_code == 401

    def test_bad_token_rejected(self, client):
        assert client.get("/users/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401


class TestPasswordReset:
    def test_unknown_email_gets_same_response_and_no_email(self, client, sent_reset_codes):
        response = client.post("/forgot-password", json={"email": "nobody@unt.edu"})
        assert response.status_code == 200
        assert sent_reset_codes == {}

    def test_full_reset_flow(self, client, make_user, sent_reset_codes):
        make_user("reset@unt.edu")
        client.post("/forgot-password", json={"email": "Reset@UNT.edu"})
        code = sent_reset_codes["reset@unt.edu"]
        assert len(code) == 6 and code.isdigit()

        assert client.post("/verify-reset-code", json={"email": "reset@unt.edu", "code": code}).status_code == 200
        response = client.post("/reset-password", json={"email": "reset@unt.edu", "code": code, "new_password": "newpass1"})
        assert response.status_code == 200

        assert login(client, "reset@unt.edu", "newpass1").status_code == 200
        assert login(client, "reset@unt.edu").status_code == 401

    def test_code_cannot_be_reused(self, client, make_user, sent_reset_codes):
        make_user("reset@unt.edu")
        client.post("/forgot-password", json={"email": "reset@unt.edu"})
        code = sent_reset_codes["reset@unt.edu"]
        client.post("/reset-password", json={"email": "reset@unt.edu", "code": code, "new_password": "newpass1"})
        again = client.post("/reset-password", json={"email": "reset@unt.edu", "code": code, "new_password": "newpass2"})
        assert again.status_code == 400

    def test_new_request_invalidates_old_code(self, client, make_user, sent_reset_codes):
        make_user("reset@unt.edu")
        client.post("/forgot-password", json={"email": "reset@unt.edu"})
        old_code = sent_reset_codes["reset@unt.edu"]
        client.post("/forgot-password", json={"email": "reset@unt.edu"})
        if sent_reset_codes["reset@unt.edu"] != old_code:
            assert client.post("/verify-reset-code", json={"email": "reset@unt.edu", "code": old_code}).status_code == 400

    def test_code_locks_after_too_many_wrong_attempts(self, client, make_user, sent_reset_codes):
        make_user("reset@unt.edu")
        client.post("/forgot-password", json={"email": "reset@unt.edu"})
        code = sent_reset_codes["reset@unt.edu"]
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            client.post("/verify-reset-code", json={"email": "reset@unt.edu", "code": wrong})
        assert client.post("/verify-reset-code", json={"email": "reset@unt.edu", "code": code}).status_code == 400


class TestProfile:
    def test_me_requires_login(self, client):
        assert client.get("/users/me").status_code == 401

    def test_update_name_and_permit(self, client, commuter):
        assert client.put("/users/me/name", headers=commuter, json={"name": "  Sam  "}).json() == {"name": "Sam"}
        assert client.put("/users/me/permit", headers=commuter, json={"permit_type": "Eagle"}).status_code == 200
        me = client.get("/users/me", headers=commuter).json()
        assert (me["name"], me["permit_type"]) == ("Sam", "Eagle")

    def test_plate_is_normalized(self, client, commuter):
        response = client.put("/users/me/plate", headers=commuter, json={"plate_state": "tx", "plate_number": "abc-1234"})
        assert response.json() == {"plate_state": "TX", "plate_number": "ABC1234"}

    def test_vanity_and_out_of_state_plates_allowed(self, client, commuter):
        assert client.put("/users/me/plate", headers=commuter, json={"plate_state": "TX", "plate_number": "EAGLE1"}).status_code == 200
        assert client.put("/users/me/plate", headers=commuter, json={"plate_state": "CA", "plate_number": "1ABC234"}).status_code == 200

    def test_invalid_plates_rejected(self, client, commuter):
        assert client.put("/users/me/plate", headers=commuter, json={"plate_state": "TX", "plate_number": "ABCDE12345"}).status_code == 422
        assert client.put("/users/me/plate", headers=commuter, json={"plate_state": "ZZ", "plate_number": "ABC1234"}).status_code == 422

    def test_empty_plate_clears_it(self, client, commuter):
        client.put("/users/me/plate", headers=commuter, json={"plate_state": "TX", "plate_number": "ABC1234"})
        response = client.put("/users/me/plate", headers=commuter, json={"plate_state": "TX", "plate_number": ""})
        assert response.json()["plate_number"] == ""
