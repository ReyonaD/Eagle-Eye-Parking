import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext 
from dotenv import load_dotenv

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
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

#ROLE-BASED ACCESS CONTROL
def get_current_user_role(token: str = Depends(oauth2_scheme)):
    """Extract the role from the JWT token"""
    
    try: 
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role: str = payload.get("role")
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token does not contain a role",
                headers={"WWW-Authenticate": "Bearer"}
            )
        return role
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
def require_admin(role: str = Depends(get_current_user_role)):
    """Block access to endpoints that require admin role"""
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin privileges required."
        )
    return role