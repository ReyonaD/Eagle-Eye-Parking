import requests
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import jwt, JWTError 
from sqlalchemy.orm import Session

#imports custom files
from app.database import get_db
from app.models import User
from app.schemas import UserCreate
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.security import SECRET_KEY, ALGORITHM

app = FastAPI(title = "EagleEyes API")
# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins instead of "*"
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Check the JWT token and return the current user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        #decode the token using the secret key and algorithm
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    #find user in database by email
    user= db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    
    return user
@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """Registers new user and save them to the database"""
    #check if the email is already in the database
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")
    #scramble the password using bcrypt
    hashedPW = get_password_hash(user.password)
    #create a new User object with the email and hashed password
    new_user = User(
        email=user.email,
        hashed_password=hashedPW
    )
    #save to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user) #refresh the instance to get the generated id from database
    
    return {"message": "User account is created successfully", "user_id": new_user.id}

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Authenticate user and return a JWT token"""
    #find the user in database by email
    #FastAPI call email field "username" by default, so we have to use form_data.username to get the email
    user = db.query(User).filter(User.email == form_data.username).first()

    #check if the user exists and if the password is matched
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"} ,
        )
    #create a JWT token with user's id as the payload
    access_token = create_access_token(data={"sub": str(user.email)})

    #hand the token to the mobile app
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
        }

@app.get("/")
def read_root():
    return {"message": "EagleEyes Backend is running and ready for development phase!"}

@app.get("/api/v1/health")
def health_check():
    return {"database": "disconnected", "parkzen_sdk": "pending"}
@app.get("/users/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    """A protected route. Only users with valid token can access this route and get their user information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active
    }

@app.get("/api/lots")
def get_parking_lots():
    """mock data representing the unt lots drawn in Parkzen Dashaboard"""
    # return [
    #     {
    #         "id": "lot-20",
    #         "name": "Lot 20 (Eagle)",
    #         "isFull": False, 
    #         "polygonCoordinates": [
    #             {"latitude": 33.2160, "longitude": -97.1500},
    #             {"latitude": 33.2160, "longitude": -97.1470},
    #             {"latitude": 33.2145, "longitude": -97.1470},
    #             {"latitude": 33.2145, "longitude": -97.1500},
    #         ]
    #     },
    #     {
    #         "id": "highland-garage",
    #         "name": "Highland Street Garage",
    #         "isFull": True, 
    #         "polygonCoordinates": [
    #             {"latitude": 33.2130, "longitude": -97.1460},
    #             {"latitude": 33.2130, "longitude": -97.1440},
    #             {"latitude": 33.2115, "longitude": -97.1440},
    #             {"latitude": 33.2115, "longitude": -97.1460},
    #         ]
    #     }
    # ]
    #load credentials from environment variables
    client_id = os.getenv("PARKZEN_CLIENT_ID", "University of North Texas")
    username = os.getenv("PARKZEN_USERNAME")
    password = os.getenv("PARKZEN_PASSWORD")

    if not username or not password:
        raise HTTPException(status_code=500, detail="Missing ParkZen credentials in backend .env")
    
    try:
        #get the access token
        auth_url = "https://api.parkzenapp.com/api/auth/login"
        auth_payload = {
            "username": username,
            "password": password
        }
        auth_response = requests.post(auth_url, json = auth_payload)

        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to authenticate with ParkZen")
        
        auth_data = auth_response.json()
        #keep the token checking flexible since the ParkZen API might return the token in different formats. We will try to find the token in multiple places in the response.
        token = auth_data.get("accessToken") or auth_data.get("token") 
        if not token and "data" in auth_data:
            token = auth_data["data"].get("accessToken") or auth_data["data"].get("token")
            
        if not token:
            print("Raw Auth Response:", auth_data)
            raise HTTPException(status_code=500, detail="Could not find token in login response")
        #fetch the UNT lots using the token
        lots_url = f"https://api.parkzenapp.com/api/lots?clientId={client_id}"
        headers = {"Authorization": f"Bearer {token}"}

        lots_response = requests.get(lots_url, headers=headers)

        if lots_response.status_code != 200:
            raise HTTPException(lots_response.status_code, detail="Fail to fetch lots from ParkZen API")
        
        raws_lots_data = lots_response.json()

        #extract the array
        actual_lots_array = raws_lots_data.get("data") or raws_lots_data.get("lots") or raws_lots_data

        if not isinstance(actual_lots_array, list):
            raise HTTPException(status_code=500, detail="Unexpected response format from ParkZen API")
        
        #return raw array to the frontend
        return actual_lots_array
    except Exception as e:
        print(f"Server error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error while communicating to ParkZen")
