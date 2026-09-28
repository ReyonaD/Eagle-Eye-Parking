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

class AlertCreate(BaseModel):
    title: str
    alert_type: str
    category: str
    description: Optional[str] = None
    lot_name: Optional[str] = None
    #URLs returned by POST /alerts/upload-image, attached before the report is created
    image_urls: Optional[List[str]] = None

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
