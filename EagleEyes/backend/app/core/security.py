import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext 
from dotenv import load_dotenv

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
#this tell python to go find the .env file and load the variables into memory
load_dotenv()

#use getenv to securely pull the values out of memory
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
#wrap in int() to convert the string value to an integer
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))
#tell Passlib to use the industry-standard bcrypt algorithm 
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
#where client should go to get the token, in this case, it's the /login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

#PASSWORD FUNCTIONS
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """check if the typed password match with the one in database"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """plaintext->scrambled bscrypt hash"""
    return pwd_context.hash(password)

#JWT TOKEN GENERATION
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """create a JWT token for the user"""
    to_encode = data.copy()
    #calculate the expiration time of token
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    #add expiration time to token's payload
    to_encode.update({"exp": expire})

    #sign the token using the secret key
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ROLE-BASED ACCESS CONTROL
# Checks read the user from the database, not the JWT claims, so role changes apply immediately.
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

#detail string the app keys off to tell "you were demoted" apart from any
#other 403, so it can log the user out instead of showing a generic error
ADMIN_REVOKED_DETAIL = "admin_revoked"

def _user_from_token(token: Optional[str], db: Session):
    """The active User a token belongs to, or None if it's missing/invalid."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    email = payload.get("sub")
    if not email:
        return None
    user = db.query(User).filter(User.email == email).first()
    if user is None or user.is_active is False:
        return None
    return user

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Check the JWT token and return the current (active) user"""
    user = _user_from_token(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_optional_user(token: Optional[str] = Depends(optional_oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    """Like get_current_user, but for public endpoints: None when logged out."""
    return _user_from_token(token, db)

def require_admin(user: User = Depends(get_current_user)) -> User:
    """Block access to endpoints that require admin role (checked live)"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ADMIN_REVOKED_DETAIL,
        )
    return user

def require_owner(user: User = Depends(require_admin)) -> User:
    """Owner-only endpoints (managing other admins)."""
    if not user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Owner privileges required."
        )
    return user
