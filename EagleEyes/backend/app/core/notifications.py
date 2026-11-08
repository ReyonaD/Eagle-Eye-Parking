from typing import Iterable, Optional

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Note, User, UserNotification

#kind values stored on UserNotification
#(hazard report approve/decline entries used to exist; older rows may still be
#in the table with kind report_approved / report_declined)
NOTE_ACKNOWLEDGED = "note_acknowledged"


def _notify(
    db: Session,
    emails: Iterable[str],
    kind: str,
    source_type: str,
    source_id: int,
    title: str,
    body: Optional[str],
    lot_name: Optional[str],
) -> int:
    """Adds one "My Updates" entry per distinct submitter. Doesn't commit - the
    caller commits it together with the status change that triggered it, so
    the two can never get out of sync. Returns how many entries were new."""
    unique_emails = {e for e in (emails or []) if e}
    if not unique_emails:
        return 0
    #a submitter whose account no longer exists is simply skipped
    user_ids = [u.id for u in db.query(User.id).filter(User.email.in_(unique_emails)).all()]
    if not user_ids:
        return 0

    rows = [
        {
            "user_id": user_id,
            "kind": kind,
            "source_type": source_type,
            "source_id": source_id,
            "title": title,
            "body": body,
            "lot_name": lot_name,
        }
        for user_id in user_ids
    ]
    #the unique constraint (user, source, kind) turns a repeat review into a
    #no-op instead of a second notification or an error
    stmt = insert(UserNotification).values(rows).on_conflict_do_nothing(
        constraint="uq_user_notification_event"
    ).returning(UserNotification.id)
    return len(db.execute(stmt).fetchall())


def notify_note_acknowledged(db: Session, note: Note) -> int:
    """Tells the commuter their note was seen. Only the note's title and lot go
    into the update - never the phone number, plate, or description."""
    return _notify(
        db,
        [note.reporter_email],
        NOTE_ACKNOWLEDGED,
        "note",
        note.id,
        "Your note was acknowledged",
        f'The parking team has seen your note "{note.title}".',
        note.lot_name,
    )
