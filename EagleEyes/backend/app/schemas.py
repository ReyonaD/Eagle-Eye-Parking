from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    #EmailStr will reject fake email addresses
    email: EmailStr
    password: str

