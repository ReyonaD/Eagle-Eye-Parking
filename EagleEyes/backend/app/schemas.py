import re
from pydantic import BaseModel, EmailStr, Field, model_validator
from datetime import datetime
from typing import List, Optional

class UserCreate(BaseModel):
    #EmailStr will reject fake email addresses
    email: EmailStr
    password: str

class UserPermitUpdate(BaseModel):
    #must be one of the names returned by GET /api/permits
    permit_type: str = Field(min_length=1, max_length=100)

class UserNameUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

US_STATE_CODES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
    "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
    "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
    "WV", "WI", "WY",
}

def normalize_plate(state: Optional[str], number: Optional[str]) -> tuple[str, str]:
    """Uppercase, drop spaces/dashes, then check: 2-8 letters/digits and a real US state.
    An empty number is allowed (no plate). Mirrors frontend/utils/plates.ts."""
    state = re.sub(r"[^A-Z]", "", (state or "").upper())
    number = re.sub(r"[^A-Z0-9]", "", (number or "").upper())
    if number:
        if not re.fullmatch(r"[A-Z0-9]{2,8}", number):
            raise ValueError("Plate number must be 2-8 letters or numbers (e.g. ABC1234).")
        if state not in US_STATE_CODES:
            raise ValueError("Plate state must be a 2-letter US state code (e.g. TX).")
    return state, number

class UserPlateUpdate(BaseModel):
    #empty plate_number clears a previously-saved plate
    plate_state: str = Field(default="", max_length=10)
    plate_number: str = Field(default="", max_length=20)

    @model_validator(mode="after")
    def _normalize(self):
        self.plate_state, self.plate_number = normalize_plate(self.plate_state, self.plate_number)
        return self

class AlertCreate(BaseModel):
    title: str
    alert_type: str
    category: str
    description: Optional[str] = None
    lot_name: Optional[str] = None
    #URLs returned by POST /alerts/upload-image, attached before the report is created
    image_urls: Optional[List[str]] = None
    #events only: when it actually starts/ends, distinct from when the report was submitted
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None

class AlertResponse(BaseModel):
    id: int
    title: str
    alert_type: str
    category: str
    description: Optional[str] = None
    upvotes: int
    created_at: datetime
    status: Optional[str] = "published"
    lot_name: Optional[str] = None
    image_urls: Optional[List[str]] = []
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None
    #emails of every distinct commuter who reported/confirmed this; admin-only context, not shown to commuters
    reporter_emails: Optional[List[str]] = []
    #hazards only: when an admin marked it as over; null = still on the map/lots
    deactivated_at: Optional[datetime] = None
    # create/update/approve only: overlapping events or active closures, for admin warnings
    conflicts: Optional[List["EventConflict"]] = None

class EventConflict(BaseModel):
    id: int
    title: str
    category: str
    is_closure: bool
    #the lots this event shares with the one being saved
    lot_names: List[str]
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None

class NoteCreate(BaseModel):
    title: str
    description: Optional[str] = None
    lot_name: Optional[str] = None
    reporter_name: Optional[str] = Field(default=None, max_length=100)
    #contact email typed on the form; the note's author is always the logged-in user
    contact_email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    plate_state: Optional[str] = None
    plate_number: Optional[str] = None
    #URLs returned by POST /alerts/upload-image, attached before the note is created
    image_urls: Optional[List[str]] = None
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None

    @model_validator(mode="after")
    def _normalize_plate(self):
        state, number = normalize_plate(self.plate_state, self.plate_number)
        self.plate_state, self.plate_number = state or None, number or None
        return self

class NoteResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    lot_name: Optional[str] = None
    reporter_name: Optional[str] = None
    phone_number: Optional[str] = None
    plate_state: Optional[str] = None
    plate_number: Optional[str] = None
    image_urls: Optional[List[str]] = []
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None
    reporter_email: str
    contact_email: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

class AlertApprove(BaseModel):
    #optional edits the admin can make while approving a pending report
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    #admin can remove unclear photos or attach better ones before publishing
    image_urls: Optional[List[str]] = None

    class Config:
        from_attributes = True
class AlertEventUpdate(BaseModel):
    #the full edited event from the admin's Edit Event form, replacing the old values
    title: str
    category: str
    description: Optional[str] = None
    lot_name: Optional[str] = None
    event_start: datetime
    #null = no end date (TBD / permanent), so an admin can add or clear one later
    event_end: Optional[datetime] = None

class AlertActiveUpdate(BaseModel):
    #true = show the hazard on the map/lots again; false = it's over, take it down
    active: bool

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8)

class DiagnosticLogCreate(BaseModel):
    #captured console output from the device; capped so one upload can't flood the DB
    logs: str = Field(min_length=1, max_length=1_000_000)
    description: Optional[str] = Field(default=None, max_length=2000)
    platform: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    #free-form device details (model, map provider, screen size...) - kept as JSON
    #so the frontend can add fields without a backend change
    device_info: Optional[dict] = None

class DiagnosticLogSummary(BaseModel):
    """List view for admins - everything except the (large) log body."""
    id: int
    reporter_email: str
    description: Optional[str] = None
    platform: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    device_info: Optional[dict] = None
    created_at: datetime

class DiagnosticLogResponse(DiagnosticLogSummary):
    logs: str

class PushTokenRegister(BaseModel):
    #Expo push token from expo-notifications' getExpoPushTokenAsync()
    token: str = Field(min_length=1, max_length=255)
    platform: Optional[str] = Field(default=None, max_length=20)

class UserNotificationResponse(BaseModel):
    """One "My Updates" entry. Never includes the note's phone number, plate,
    or description - only the snapshot fields the commuter already wrote."""
    id: int
    kind: str
    source_type: str
    source_id: int
    title: str
    body: Optional[str] = None
    lot_name: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None

class UnreadCountResponse(BaseModel):
    count: int

class MyNoteResponse(BaseModel):
    """A commuter's own note as shown in Note Status: just enough to recognise
    it and see whether it's been acknowledged (no phone number or plate)."""
    id: int
    title: str
    lot_name: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None

AlertResponse.model_rebuild()
