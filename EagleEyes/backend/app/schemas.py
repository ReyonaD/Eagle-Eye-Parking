from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    #EmailStr will reject fake email addresses
    email: EmailStr
    password: str

class AlertCreate(BaseModel):
    title: str
    alert_type: str
    category: str
    description: Optional[str] = None

class AlertResponse(BaseModel):
    id: int
    title: str
    alert_type: str
    category: str
    description: Optional[str] = None
    upvotes: int
    created_at: datetime

    class Config:
        from_attributes = True
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
