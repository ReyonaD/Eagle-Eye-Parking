from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, JSON
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
    #for alert_type='event': when the event actually starts/ends, as picked by
    #the admin in the form - distinct from created_at, which is just when the
    #row was submitted. Null for hazards and for events created before this existed.
    event_start = Column(DateTime, nullable=True)
    event_end = Column(DateTime, nullable=True)
    #emails of every distinct commuter who reported/confirmed this; lets admins
    #see who to follow up with and is how we tell a genuine second confirmation
    #from the same person re-submitting the same report
    reporter_emails = Column(JSON, nullable=True, default=list)
    #for alert_type='hazard': when an admin marked it as over. A published
    #hazard shows on the map/lots until then; null = still active. Reactivating
    #clears it again.
    deactivated_at = Column(DateTime, nullable=True)


class Note(Base):
    """
    A private commuter -> admin message (e.g. "my car broke down in Lot 20,
    back by 5pm"). Deliberately a separate table from Alert, not another
    alert_type/category value:
    - it's never meant to be published/broadcast, unlike hazards and events
    - each note is one person's own situation, so the Alert dedup/merge
      logic (multiple commuters confirming the SAME incident) doesn't apply
      here and would incorrectly combine two unrelated people's notes about
      the same lot
    - fields like phone_number only ever make sense for a note, not for any
      Alert category
    """
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    lot_name = Column(String, nullable=True)
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
    reporter_email = Column(String, nullable=False)
    #set when an admin reviews/acknowledges the note; null until then. Admin
    #UI buckets notes into Pending/Active/Expired from this + event_end.
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class DiagnosticLog(Base):
    """
    A snapshot of the app's recent console output, sent by a commuter from
    Help & Support so we can trace bugs that only happen on their device
    (e.g. the Android map not showing) without needing the device in hand.
    """
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
    """
    One row per device that has turned on alert notifications. A token is an
    Expo push token (ExponentPushToken[...]) and belongs to whoever last signed
    in on that device, so switching accounts moves it instead of duplicating it.
    """
    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    #"ios" / "android", only kept for debugging which devices are registered
    platform = Column(String, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
