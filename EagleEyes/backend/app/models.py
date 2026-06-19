from sqlalchemy import Boolean, Column, Integer, String, DateTime
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))



