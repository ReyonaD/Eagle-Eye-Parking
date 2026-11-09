"""Hazard reports, admin review, push notifications, upvotes, and photo uploads."""
import pytest


def hazard(client, headers, **fields):
    body = {"title": "Ice", "alert_type": "hazard", "category": "snow", "lot_name": "Lot 20", **fields}
    return client.post("/alerts", headers=headers, json=body)


def register_device(client, headers, token):
    return client.post("/users/me/push-token", headers=headers, json={"token": token, "platform": "ios"})


class TestReporting:
    def test_commuter_report_waits_for_review(self, client, commuter, admin):
        report = hazard(client, commuter).json()
        assert report["status"] == "pending"
        assert report["title"] == "ICE"
        assert client.get("/alerts?alert_type=hazard").json() == []
        assert [a["id"] for a in client.get("/alerts/pending?alert_type=hazard", headers=admin).json()] == [report["id"]]

    def test_admin_post_is_published_immediately(self, client, admin):
        assert hazard(client, admin).json()["status"] == "published"

    def test_reporting_requires_login(self, client):
        assert hazard(client, {}).status_code == 401

    def test_commuter_needs_a_lot_or_a_description(self, client, commuter):
        assert hazard(client, commuter, lot_name=None).status_code == 400
        assert hazard(client, commuter, lot_name=None, description="   ").status_code == 400
        assert hazard(client, commuter, lot_name=None, description="Road behind Lot 20").status_code == 200

    def test_admin_can_post_campus_wide(self, client, admin):
        assert hazard(client, admin, lot_name=None).status_code == 200

    def test_at_most_three_photos(self, client, commuter):
        assert hazard(client, commuter, image_urls=["/uploads/1.jpg"] * 4).status_code == 400


class TestDuplicateReports:
    def test_reports_from_different_students_merge(self, client, make_user, admin):
        first = make_user("a@unt.edu")
        second = make_user("b@unt.edu")
        one = hazard(client, first, description="Ramp is icy", image_urls=["/uploads/1.jpg"]).json()
        two = hazard(client, second, description="Black ice", image_urls=["/uploads/2.jpg"]).json()

        assert two["id"] == one["id"]
        assert two["upvotes"] == 2
        assert two["image_urls"] == ["/uploads/1.jpg", "/uploads/2.jpg"]
        assert "Also reported: Black ice" in two["description"]
        assert len(client.get("/alerts/pending?alert_type=hazard", headers=admin).json()) == 1

    def test_same_student_reporting_again_is_not_a_confirmation(self, client, commuter):
        hazard(client, commuter)
        assert hazard(client, commuter).json()["upvotes"] == 1

    def test_different_lot_or_type_is_a_separate_report(self, client, make_user):
        first, second = make_user("a@unt.edu"), make_user("b@unt.edu")
        one = hazard(client, first).json()
        assert hazard(client, second, lot_name="Lot 24").json()["id"] != one["id"]
        assert hazard(client, second, category="flood").json()["id"] != one["id"]

    def test_published_reports_do_not_absorb_new_ones(self, client, make_user, admin):
        first, second = make_user("a@unt.edu"), make_user("b@unt.edu")
        one = hazard(client, first).json()
        client.put(f"/alerts/{one['id']}/approve", headers=admin, json={})
        assert hazard(client, second).json()["id"] != one["id"]

    def test_admin_posts_are_never_merged(self, client, admin):
        assert hazard(client, admin).json()["id"] != hazard(client, admin).json()["id"]


class TestReview:
    def test_approve_publishes_with_edits(self, client, commuter, admin):
        report = hazard(client, commuter).json()
        approved = client.put(f"/alerts/{report['id']}/approve", headers=admin,
                              json={"title": "black ice", "description": "  Use the north entrance  "}).json()
        assert approved["status"] == "published"
        assert (approved["title"], approved["description"]) == ("BLACK ICE", "Use the north entrance")

    def test_decline_keeps_history(self, client, commuter, admin):
        report = hazard(client, commuter).json()
        assert client.delete(f"/alerts/{report['id']}", headers=admin).json()["message"] == "Report declined."
        assert [a["id"] for a in client.get("/alerts/declined?alert_type=hazard", headers=admin).json()] == [report["id"]]

    def test_removing_a_published_alert_deletes_it(self, client, admin):
        alert = hazard(client, admin).json()
        client.delete(f"/alerts/{alert['id']}", headers=admin)
        assert client.get("/alerts?alert_type=hazard").json() == []

    def test_deactivate_and_reactivate(self, client, admin):
        alert = hazard(client, admin).json()
        off = client.put(f"/alerts/{alert['id']}/active", headers=admin, json={"active": False}).json()
        assert off["deactivated_at"] is not None
        on = client.put(f"/alerts/{alert['id']}/active", headers=admin, json={"active": True}).json()
        assert on["deactivated_at"] is None

    def test_commuters_cannot_review(self, client, commuter):
        report = hazard(client, commuter).json()
        assert client.put(f"/alerts/{report['id']}/approve", headers=commuter, json={}).status_code == 403
        assert client.delete(f"/alerts/{report['id']}", headers=commuter).status_code == 403

    def test_missing_alert(self, client, admin):
        assert client.put("/alerts/9999/approve", headers=admin, json={}).status_code == 404


class TestPushNotifications:
    def test_admin_post_notifies_everyone_except_the_poster(self, client, commuter, admin, sent_pushes):
        register_device(client, commuter, "ExponentPushToken[student]")
        register_device(client, admin, "ExponentPushToken[admin]")
        hazard(client, admin)
        assert len(sent_pushes) == 1
        assert sent_pushes[0]["tokens"] == ["ExponentPushToken[student]"]
        assert sent_pushes[0]["title"] == "Hazard at Lot 20"

    def test_commuter_report_notifies_only_once_approved(self, client, commuter, admin, sent_pushes):
        register_device(client, commuter, "ExponentPushToken[student]")
        report = hazard(client, commuter).json()
        assert sent_pushes == []
        client.put(f"/alerts/{report['id']}/approve", headers=admin, json={})
        assert len(sent_pushes) == 1
        client.put(f"/alerts/{report['id']}/approve", headers=admin, json={})
        assert len(sent_pushes) == 1

    def test_invalid_push_token_rejected(self, client, commuter):
        assert register_device(client, commuter, "not-a-token").status_code == 400

    def test_device_moves_to_latest_account(self, client, make_user, sent_pushes, admin):
        first, second = make_user("a@unt.edu"), make_user("b@unt.edu")
        register_device(client, first, "ExponentPushToken[phone]")
        register_device(client, second, "ExponentPushToken[phone]")
        client.delete("/users/me/push-token?token=ExponentPushToken[phone]", headers=first)
        hazard(client, admin)
        assert sent_pushes[0]["tokens"] == ["ExponentPushToken[phone]"]


class TestPrivacyAndUpvotes:
    def test_public_feed_hides_reporter_emails(self, client, commuter, admin):
        report = hazard(client, commuter).json()
        client.put(f"/alerts/{report['id']}/approve", headers=admin, json={})
        assert client.get("/alerts?alert_type=hazard").json()[0]["reporter_emails"] == []
        assert client.get("/alerts?alert_type=hazard", headers=commuter).json()[0]["reporter_emails"] == []
        assert client.get("/alerts?alert_type=hazard", headers=admin).json()[0]["reporter_emails"] == ["student@unt.edu"]

    def test_upvote_requires_login_and_counts_once(self, client, make_user, admin):
        alert = hazard(client, admin).json()
        voter = make_user("voter@unt.edu")
        assert client.put(f"/alerts/{alert['id']}/upvote").status_code == 401
        assert client.put(f"/alerts/{alert['id']}/upvote", headers=voter).json()["upvotes"] == 2
        assert client.put(f"/alerts/{alert['id']}/upvote", headers=voter).json()["upvotes"] == 2


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


class TestPhotoUploads:
    @pytest.mark.parametrize("contents,ext", [(PNG, ".png"), (JPEG, ".jpg")])
    def test_images_are_saved_under_a_random_name(self, client, commuter, upload_dir, contents, ext):
        response = client.post("/alerts/upload-image", headers=commuter,
                               files={"file": ("../../evil.exe", contents, "image/png")})
        url = response.json()["image_url"]
        assert url.startswith("/uploads/") and url.endswith(ext)
        assert "evil" not in url
        assert (upload_dir / url.split("/")[-1]).read_bytes() == contents

    def test_iphone_heic_photos_are_converted_to_jpeg(self, client, commuter, upload_dir):
        import io
        import pillow_heif
        from PIL import Image

        pillow_heif.register_heif_opener()
        heic = io.BytesIO()
        Image.new("RGB", (64, 48), (0, 133, 62)).save(heic, format="HEIF")

        response = client.post("/alerts/upload-image", headers=commuter,
                               files={"file": ("IMG_0001.HEIC", heic.getvalue(), "image/heic")})
        url = response.json()["image_url"]
        assert url.endswith(".jpg")
        saved = Image.open(upload_dir / url.split("/")[-1])
        assert (saved.format, saved.size) == ("JPEG", (64, 48))

    def test_non_images_rejected(self, client, commuter):
        response = client.post("/alerts/upload-image", headers=commuter,
                               files={"file": ("photo.jpg", b"#!/bin/sh\necho hi", "image/jpeg")})
        assert response.status_code == 400

    def test_upload_requires_login(self, client):
        assert client.post("/alerts/upload-image", files={"file": ("a.png", PNG, "image/png")}).status_code == 401
