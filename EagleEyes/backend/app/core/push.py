import logging
import re
from typing import Optional

import httpx

from app.database import session_local
from app.models import Alert, Note, PushToken, User

logger = logging.getLogger(__name__)

#Expo's push service forwards each message to FCM (Android) or APNs (iOS), so
#the backend only ever deals with Expo push tokens, never Firebase/Apple keys
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
#Expo rejects requests with more than 100 messages
EXPO_BATCH_SIZE = 100
#must match the channel the app creates in utils/pushNotifications.ts
ANDROID_CHANNEL_ID = "alerts"
MAX_BODY_LENGTH = 180

EXPO_TOKEN_PATTERN = re.compile(r"^Expo(nent)?PushToken\[[^\]]+\]$")


def is_expo_push_token(token: str) -> bool:
    return bool(EXPO_TOKEN_PATTERN.match(token))


def _alert_message(alert: Alert) -> tuple[str, str]:
    kind = "Event" if alert.alert_type == "event" else "Hazard"
    title = f"{kind} at {alert.lot_name}" if alert.lot_name else f"New {kind.lower()}"
    body = alert.title or ""
    if alert.description:
        #merged duplicate reports append "Also reported: ..." lines; the first one is enough here
        body = f"{body}: {alert.description.splitlines()[0]}" if body else alert.description.splitlines()[0]
    if len(body) > MAX_BODY_LENGTH:
        body = body[:MAX_BODY_LENGTH - 1].rstrip() + "…"
    return title, body


def _send(db, tokens: list[str], title: str, body: str, data: dict, log_ref: str) -> None:
    """Sends one message to each Expo token in batches and forgets tokens Expo
    says are gone (app uninstalled / notifications revoked)."""
    dead_tokens = []

    with httpx.Client(timeout=15) as client:
        for start in range(0, len(tokens), EXPO_BATCH_SIZE):
            batch = tokens[start:start + EXPO_BATCH_SIZE]
            messages = [
                {
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "channelId": ANDROID_CHANNEL_ID,
                    "data": data,
                }
                for token in batch
            ]
            try:
                response = client.post(EXPO_PUSH_URL, json=messages, headers={"Accept": "application/json"})
                response.raise_for_status()
                tickets = response.json().get("data", [])
            except (httpx.HTTPError, ValueError) as e:
                logger.warning("Expo push request failed for %s: %s", log_ref, e)
                continue

            #tickets come back in the same order as the messages
            for token, ticket in zip(batch, tickets):
                if ticket.get("status") != "error":
                    continue
                error = (ticket.get("details") or {}).get("error")
                if error == "DeviceNotRegistered":
                    dead_tokens.append(token)
                else:
                    logger.warning("Expo rejected a message for %s: %s", log_ref, error or ticket.get("message"))

    if dead_tokens:
        db.query(PushToken).filter(PushToken.token.in_(dead_tokens)).delete(synchronize_session=False)
        db.commit()


def send_alert_published(alert_id: int, exclude_user_id: Optional[int] = None) -> None:
    """Background task: pushes a newly published alert to every registered device."""
    db = session_local()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert or alert.status != "published":
            return

        query = db.query(PushToken)
        if exclude_user_id is not None:
            #the admin who posted it doesn't need a notification about their own post
            query = query.filter(PushToken.user_id != exclude_user_id)
        tokens = [row.token for row in query.all()]
        if not tokens:
            return

        title, body = _alert_message(alert)
        _send(db, tokens, title, body, {"alert_id": alert.id, "alert_type": alert.alert_type}, f"alert {alert_id}")
    finally:
        db.close()


def send_note_acknowledged(note_id: int) -> None:
    """Background task: tells the note's author it was acknowledged (title only, no personal details)."""
    db = session_local()
    try:
        note = db.query(Note).filter(Note.id == note_id).first()
        if not note or note.acknowledged_at is None:
            return
        user = db.query(User).filter(User.email == note.reporter_email).first()
        if not user:
            return
        tokens = [row.token for row in db.query(PushToken).filter(PushToken.user_id == user.id).all()]
        if not tokens:
            return

        body = f'The parking team has seen "{note.title}".'
        if len(body) > MAX_BODY_LENGTH:
            body = body[:MAX_BODY_LENGTH - 1].rstrip() + "…"
        _send(db, tokens, "Your note was acknowledged", body, {"note_id": note.id}, f"note {note_id}")
    finally:
        db.close()
