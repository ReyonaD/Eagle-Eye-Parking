"""Admin and owner access: changes take effect on the very next request."""


def pending_queue(client, headers):
    return client.get("/alerts/pending?alert_type=hazard", headers=headers)


class TestAdminOnlyEndpoints:
    def test_commuter_gets_admin_revoked(self, client, commuter):
        response = pending_queue(client, commuter)
        assert response.status_code == 403
        assert response.json()["detail"] == "admin_revoked"

    def test_admin_allowed(self, client, admin):
        assert pending_queue(client, admin).status_code == 200

    def test_admin_cannot_use_owner_endpoints(self, client, admin):
        assert client.get("/admin/admins", headers=admin).status_code == 403

    def test_owner_lists_admins(self, client, owner, admin):
        emails = [a["email"] for a in client.get("/admin/admins", headers=owner).json()]
        assert emails == ["admin@unt.edu", "owner@unt.edu"]


class TestPromote:
    def test_promotion_applies_without_new_login(self, client, owner, commuter):
        assert pending_queue(client, commuter).status_code == 403
        assert client.put("/admin/users/Student@UNT.edu/promote", headers=owner).status_code == 200
        assert pending_queue(client, commuter).status_code == 200

    def test_only_owners_can_promote(self, client, admin, commuter):
        assert client.put("/admin/users/student@unt.edu/promote", headers=admin).status_code == 403

    def test_promoting_an_admin_is_rejected(self, client, owner, admin):
        assert client.put("/admin/users/admin@unt.edu/promote", headers=owner).status_code == 400

    def test_unknown_user(self, client, owner):
        assert client.put("/admin/users/nobody@unt.edu/promote", headers=owner).status_code == 404


class TestRevoke:
    def test_revoked_admin_is_blocked_immediately(self, client, owner, admin):
        assert pending_queue(client, admin).status_code == 200
        assert client.put("/admin/users/admin@unt.edu/revoke", headers=owner).status_code == 200

        response = pending_queue(client, admin)
        assert response.status_code == 403
        assert response.json()["detail"] == "admin_revoked"
        assert client.get("/users/me", headers=admin).json()["role"] == "commuter"

    def test_revoked_owner_loses_owner_powers(self, client, make_user, owner):
        second_owner = make_user("owner2@unt.edu", role="admin", is_owner=True)
        assert client.put("/admin/users/owner@unt.edu/revoke", headers=second_owner).status_code == 200
        assert client.put("/admin/users/owner2@unt.edu/revoke", headers=owner).status_code == 403

    def test_cannot_revoke_yourself_in_any_case(self, client, owner):
        assert client.put("/admin/users/OWNER@unt.edu/revoke", headers=owner).status_code == 400

    def test_revoking_a_commuter_is_rejected(self, client, owner, commuter):
        assert client.put("/admin/users/student@unt.edu/revoke", headers=owner).status_code == 400

    def test_admins_cannot_revoke(self, client, make_user, admin):
        make_user("admin2@unt.edu", role="admin")
        assert client.put("/admin/users/admin2@unt.edu/revoke", headers=admin).status_code == 403


class TestGrantOwner:
    def test_owner_can_grant_owner(self, client, owner, admin):
        assert client.put("/admin/users/admin@unt.edu/grant-owner", headers=owner).status_code == 200
        assert client.get("/admin/admins", headers=admin).status_code == 200

    def test_only_admins_can_become_owners(self, client, owner, commuter):
        assert client.put("/admin/users/student@unt.edu/grant-owner", headers=owner).status_code == 400

    def test_already_owner_rejected(self, client, make_user, owner):
        make_user("owner2@unt.edu", role="admin", is_owner=True)
        assert client.put("/admin/users/owner2@unt.edu/grant-owner", headers=owner).status_code == 400
