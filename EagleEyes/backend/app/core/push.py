import re
from typing import Optional

import httpx

from app.database import session_local
from app.models import Alert, PushToken

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


def send_alert_published(alert_id: int, exclude_user_id: Optional[int] = None) -> None:
    """Notifies every registered device that an alert just went live.
    Runs as a background task, after the request's own DB session is closed,
    so it opens its own."""
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
        data = {"alert_id": alert.id, "alert_type": alert.alert_type}
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
                    print(f"[PUSH] Expo push request failed for alert {alert_id}: {e}")
                    continue

                #tickets come back in the same order as the messages
                for token, ticket in zip(batch, tickets):
                    if ticket.get("status") != "error":
                        continue
                    error = (ticket.get("details") or {}).get("error")
                    if error == "DeviceNotRegistered":
                        #app uninstalled or notifications revoked: stop sending to it
                        dead_tokens.append(token)
                    else:
                        print(f"[PUSH] Expo rejected a message for alert {alert_id}: {error or ticket.get('message')}")

        if dead_tokens:
            db.query(PushToken).filter(PushToken.token.in_(dead_tokens)).delete(synchronize_session=False)
            db.commit()
    finally:
        db.close()
