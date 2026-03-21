import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt 
from passlib.context import CryptContext 
from dotenv import load_dotenv

#this tell python to go find the .env file and load the variables into memory
load_dotenv()

#use getenv to securely pull the values out of memory
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
#wrap in int() to convert the string value to an integer
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))
#tell Passlib to use the industry-standard bcrypt algorithm 
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    #add expiration time to token's payload
    to_encode.update({"exp": expire})

    #sign the token using the secret key
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt