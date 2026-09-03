from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, JSON
from app.database import Base
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    #Primary Key
    id = Column(Integer, primary_key=True, index=True)

    #user information
    email = Column(String, unique=True, index=True, nullable=False)

    #store the scrambled hash, not the plaintext password   
    hashed_password = Column(String, nullable=False)

    role = Column(String, default="commuter")

    is_active = Column(Boolean, default=True)

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
