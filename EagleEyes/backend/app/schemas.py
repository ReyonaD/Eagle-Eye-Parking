from pydantic import BaseModel, EmailStr, Field
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

class UserPlateUpdate(BaseModel):
    #empty string allowed — a user can clear a previously-saved plate
    plate_state: str = Field(default="", max_length=10)
    plate_number: str = Field(default="", max_length=20)

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

class NoteCreate(BaseModel):
    title: str
    description: Optional[str] = None
    lot_name: Optional[str] = None
    phone_number: Optional[str] = None
    plate_state: Optional[str] = None
    plate_number: Optional[str] = None
    #URLs returned by POST /alerts/upload-image, attached before the note is created
    image_urls: Optional[List[str]] = None
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None

class NoteResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    lot_name: Optional[str] = None
    phone_number: Optional[str] = None
    plate_state: Optional[str] = None
    plate_number: Optional[str] = None
    image_urls: Optional[List[str]] = []
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None
    reporter_email: str
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
