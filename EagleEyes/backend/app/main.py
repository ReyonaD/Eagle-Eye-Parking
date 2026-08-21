import httpx
import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import jwt, JWTError 
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .database import engine, Base
from . import models
#imports custom files
from app.database import get_db
from app.models import User, Alert, PasswordResetToken
from app.schemas import UserCreate, AlertResponse, AlertCreate, ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.security import SECRET_KEY, ALGORITHM, create_access_token, require_admin
from app.core.email import send_password_reset_email
from typing import List
Base.metadata.create_all(bind=engine)
app = FastAPI(title = "EagleEyes API")
# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins instead of "*"
    allow_credentials=True,  # Set to True if you need to allow cookies or authentication headers
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

permit_cache = {}
def get_permit_name(permit_id: str, token: str):
    """fetch the real name of permit from Parkzen, using a cache to be fast"""
    if permit_id in permit_cache:
        return permit_cache[permit_id]
    url = f"https://api.parkzenapp.com/api/permits/{permit_id}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = httpx.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            name = data.get("name") or data.get("title") or data.get("type") or "Unknown"
            permit_cache[permit_id] = name
            return name
    except httpx.RequestError as e:
        print(f"Error fetching permit name for {permit_id}: {e}")
    return "Unknown"

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
        hashed_password=hashedPW,
        role="commuter"
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
    access_token = create_access_token(data={"sub": str(user.email), "role": user.role})

    #hand the token to the mobile app
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": user.role
        }


PASSWORD_RESET_TOKEN_TTL_MINUTES = 15
PASSWORD_RESET_MAX_ATTEMPTS = 5

def _hash_token(raw_token: str) -> str:
    #store only the SHA-256 hash so a database leak can't expose usable tokens
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

@app.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Generates a one-time reset token. Always returns the same message so attackers can't tell which emails exist."""
    generic_response = {
        "message": "If an account exists for that email, a reset link has been sent."
    }

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return generic_response

    #invalidate any unused tokens this user already has
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: datetime.now(timezone.utc)})

    #6-digit code is easy to type on a phone; hash includes the email so codes can't collide across users
    code = f"{secrets.randbelow(10**6):06d}"
    token_record = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(f"{user.email}:{code}"),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES),
    )
    db.add(token_record)
    db.commit()

    #send the email in the background so the API responds instantly
    background_tasks.add_task(send_password_reset_email, user.email, code)

    return generic_response

def _validate_reset_code(email: str, code: str, db: Session):
    """Shared check for the verify and reset endpoints. Returns (user, token record) or raises 400."""
    invalid_error = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This code is invalid or has expired. Please request a new one.",
    )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise invalid_error

    #the user's newest active (unused, unexpired) token
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at >= datetime.now(timezone.utc),
    ).order_by(PasswordResetToken.id.desc()).first()
    if not record:
        raise invalid_error

    #wrong code -> count the attempt, kill the token after too many tries
    if record.token_hash != _hash_token(f"{user.email}:{code}"):
        record.attempts += 1
        if record.attempts >= PASSWORD_RESET_MAX_ATTEMPTS:
            record.used_at = datetime.now(timezone.utc)
        db.commit()
        raise invalid_error

    return user, record

@app.post("/verify-reset-code")
def verify_reset_code(payload: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    """Checks the 6-digit code WITHOUT consuming it, so the app can move on to the new-password step"""
    _validate_reset_code(payload.email, payload.code, db)
    return {"message": "Code verified."}

@app.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Consumes a reset token and updates the user's password"""
    user, record = _validate_reset_code(payload.email, payload.code, db)

    user.hashed_password = get_password_hash(payload.new_password)
    record.used_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Password has been reset. You can now log in."}

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
        auth_response = httpx.post(auth_url, json = auth_payload)

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

        lots_response = httpx.get(lots_url, headers=headers)

        if lots_response.status_code != 200:
            raise HTTPException(lots_response.status_code, detail="Fail to fetch lots from ParkZen API")
        
        raws_lots_data = lots_response.json()

        #extract the array
        actual_lots_array = raws_lots_data.get("data") or raws_lots_data.get("lots") or raws_lots_data

        if not isinstance(actual_lots_array, list):
            raise HTTPException(status_code=500, detail="Unexpected response format from ParkZen API")
        
        for lot in actual_lots_array:
            raw_permit_id = lot.get("permits", [])
            readable_permits = []
            for permit_id in raw_permit_id:
                #use helper function and pass the token 
                permit_name = get_permit_name(permit_id, token)
                readable_permits.append(permit_name)

            #replace the raw permit ids with the readable names in the lot data
            lot["permits"] = readable_permits

            #DEMO MODE (disabled): fakes occupancy for lots with no data. Re-enable by
            #uncommenting the block below and adding "import random" back at the top.
            #if "occupancy" not in lot or not lot["occupancy"]:
            #    #generate random occupancy data for testing between 10% and 100%
            #    fake_occupancy = round(random.uniform(0.1,1.0), 2)
            #
            #    if fake_occupancy >= 0.95:
            #        fill = '#E74C3C'  # Red for full
            #        status = "Full"
            #    elif fake_occupancy >= 0.85:
            #        fill = '#F39C12'  # Yellow for medium
            #        status = "Medium"
            #    else:
            #        fill = '#2ECC71'  # Green for low
            #        status = "Available"
            #
            #    lot["fillColor"] = fill
            #    lot["infoSheetTitle"] = status
            #    lot["occupancy"] = {
            #        "lastUpdatedVia": "capstone_simulation",
            #        "capstone_simulation": {
            #            "estimate": fake_occupancy
            #        }
            #    }
            #    lot["numParkedUsers"] = int(fake_occupancy * random.randint(100,300))

            #Translate real ParkZen occupancy into the fields the frontend reads.
            #Lots without an estimate are left untouched and render as gray "No Data".
            occupancy = lot.get("occupancy") or {}
            estimate = occupancy.get("mlOccupancyEstimate")
            if estimate is not None:
                if estimate >= 0.95:
                    lot["fillColor"] = '#E74C3C'  # Red for full
                    lot["infoSheetTitle"] = "Full"
                elif estimate >= 0.85:
                    lot["fillColor"] = '#F39C12'  # Yellow for medium
                    lot["infoSheetTitle"] = "Medium"
                else:
                    lot["fillColor"] = '#2ECC71'  # Green for low
                    lot["infoSheetTitle"] = "Available"

                #the frontend reads the estimate from occupancy[lastUpdatedVia].estimate
                method = occupancy.get("lastUpdatedVia") or "python-fusion"
                if not isinstance(occupancy.get(method), dict):
                    occupancy[method] = {}
                occupancy[method]["estimate"] = estimate
                lot["occupancy"] = occupancy
        #return clean array to the frontend
        return actual_lots_array
    except Exception as e:
        print(f"Server error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error while communicating to ParkZen")
#TEST ROUTE
@app.get("/admin/test")
def admin_only_dashboard(role: str = Depends(require_admin)):
    # Because of Depends(require_admin), standard commuters will get a 403 error 
    # before this code even runs!
    return {
        "message": "Welcome to the EagleEyes Admin Dashboard!", 
        "your_role": role
    }

@app.put("/admin/users/{target_email}/promote")
def promote_to_admin(
    target_email: str,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    #find target user
    target_user = db.query(User).filter(User.email == target_email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    #promote
    target_user.role = "admin"
    db.commit()

    return {"message": f"User {target_email} has been successfully promoted to admin."}

@app.get("/alerts", response_model=List[AlertResponse])
def get_alerts(
    alert_type: str=Query(..., description="Must be 'hazard' or 'event'"),
    db: Session= Depends(get_db)
):
    """
    Fetches the list for the tabs. 
    Orders them by newest first!
    """
    alerts = db.query(Alert)\
            .filter(Alert.alert_type == alert_type)\
            .order_by(desc(Alert.created_at))\
            .all()
    return alerts
    
@app.post("/alerts", response_model=AlertResponse)
def create_alert(
    alert_data: AlertCreate,
    db: Session= Depends(get_db)
):
    new_alert = Alert(
        title=alert_data.title.upper(), 
        alert_type=alert_data.alert_type.lower(),
        category=alert_data.category,
        description=alert_data.description
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return new_alert

@app.put("/alerts/{alert_id}/upvote", response_model=AlertResponse)
def upvote_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code= 404, detail="Alert not found or already resolved.")
    
    alert.upvotes+=1
    db.commit()
    db.refresh(alert)

    return alert

@app.delete("/alerts/{alert_id}")
def remove_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code= 404, detail="Alert not found or already resolved.")
    db.delete(alert)
    db.commit()

    return {"message": "Alert successfully resolved and removed from the feed."}

