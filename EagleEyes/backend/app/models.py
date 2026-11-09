from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, JSON, UniqueConstraint
from app.database import Base
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    #Primary Key
    id = Column(Integer, primary_key=True, index=True)

    #user information
    email = Column(String, unique=True, index=True, nullable=False)

    #display name, set by the user from the profile screen (not collected at registration)
    name = Column(String, nullable=True)

    #store the scrambled hash, not the plaintext password   
    hashed_password = Column(String, nullable=False)

    role = Column(String, default="commuter")

    is_active = Column(Boolean, default=True)

    #owners are admins who can also see the full admin roster and grant/revoke
    #other accounts' admin access; a regular admin cannot manage other admins
    is_owner = Column(Boolean, default=False, nullable=False)

    #ParkZen permit name (e.g. "Eagle", "Faculty and Staff"), set by the user from /api/permits
    permit_type = Column(String, nullable=True)

    #vehicle license plate, set by the user from the profile screen
    plate_state = Column(String, nullable=True)
    plate_number = Column(String, nullable=True)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    alert_type =Column(String, index=True)
    category=Column(String)

    description = Column(String, nullable=True)
    #red bagde number for frontend display
    upvotes=Column(Integer, default=1)
    #'published' = visible to commuters; 'pending' = waiting for admin review
    status = Column(String, default="published", index=True)
    #which parking lot the report refers to (picked by the commuter)
    lot_name = Column(String, nullable=True)
    #URLs (relative to the backend) of photos attached to the report
    image_urls = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # events: when it actually starts/ends (null for hazards and old events)
    event_start = Column(DateTime, nullable=True)
    event_end = Column(DateTime, nullable=True)
    # every distinct reporter, so a repeat report from the same person isn't a second confirmation
    reporter_emails = Column(JSON, nullable=True, default=list)
    # hazards: when an admin marked it over; null = still on the map
    deactivated_at = Column(DateTime, nullable=True)


class Note(Base):
    """A private commuter -> admin message. Separate from Alert: never published,
    never merged with other reports, and has note-only fields like phone_number."""
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    lot_name = Column(String, nullable=True)
    reporter_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    #the vehicle this note is about - may differ from the commuter's saved
    #profile plate, so it's its own field here rather than read off User
    plate_state = Column(String, nullable=True)
    plate_number = Column(String, nullable=True)
    image_urls = Column(JSON, nullable=True, default=list)
    #the commuter-provided window this note applies to (e.g. "car parked here
    #until Friday 5pm")
    event_start = Column(DateTime, nullable=True)
    event_end = Column(DateTime, nullable=True)
    #the logged-in account that sent the note - never taken from the form, since
    #Note Status and the acknowledgment push use it to find the note's author
    reporter_email = Column(String, nullable=False)
    #the email the commuter typed as their contact on the form (defaults to
    #their account email); only shown to admins, never used for identity
    contact_email = Column(String, nullable=True)
    #set when an admin reviews/acknowledges the note; null until then. Admin
    #UI buckets notes into Pending/Active/Expired from this + event_end.
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class DiagnosticLog(Base):
    """Recent app console output a commuter sent from Help & Support."""
    __tablename__ = "diagnostic_logs"

    id = Column(Integer, primary_key=True, index=True)
    reporter_email = Column(String, nullable=False, index=True)
    #optional "what were you doing when it broke" text from the user
    description = Column(String, nullable=True)
    #device context, so logs from different phones/OS versions can be told apart
    platform = Column(String, nullable=True)
    os_version = Column(String, nullable=True)
    app_version = Column(String, nullable=True)
    device_info = Column(JSON, nullable=True)
    #the captured console lines, oldest first, one per line
    logs = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    #SHA-256 hash of the token, never store the raw token
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    #how many wrong codes were tried against this token (max 5, then it dies)
    attempts = Column(Integer, default=0, nullable=False)

class PushToken(Base):
    """One row per device with alert notifications on; owned by the last account signed in there."""
    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    #"ios" / "android", only kept for debugging which devices are registered
    platform = Column(String, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class UserNotification(Base):
    """A commuter's "Note Status" entry. source_id isn't a ForeignKey and title/body are
    snapshots, so history survives deletes; the unique constraint prevents duplicates."""
    __tablename__ = "user_notifications"
    __table_args__ = (
        UniqueConstraint("user_id", "source_type", "source_id", "kind", name="uq_user_notification_event"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    #'note_acknowledged' (older rows may be 'report_approved' / 'report_declined')
    kind = Column(String, nullable=False)
    #'alert' or 'note' - which table source_id points into
    source_type = Column(String, nullable=False)
    source_id = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    body = Column(String, nullable=True)
    lot_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    #null = unread
    read_at = Column(DateTime, nullable=True)
