import httpx
import os
import random
import secrets
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError 
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from .database import engine, Base
from . import models
#imports custom files
from app.database import get_db
from app.models import User, Alert, PasswordResetToken
from app.schemas import UserCreate, AlertResponse, AlertCreate, AlertApprove, ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.security import SECRET_KEY, ALGORITHM, create_access_token, require_admin
from app.core.email import send_password_reset_email
from typing import List, Optional
Base.metadata.create_all(bind=engine)
#create_all does not add new columns to existing tables, so patch them in here.
#Existing alerts predate the approval flow and stay visible as 'published'.
with engine.connect() as _conn:
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'published'"))
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS lot_name VARCHAR"))
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS image_urls JSON"))
    _conn.commit()
app = FastAPI(title = "EagleEyes API")
# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins instead of "*"
    allow_credentials=True,  # Set to True if you need to allow cookies or authentication headers
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Photos attached to hazard/event reports are saved to disk here and served back at /uploads/<filename>
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

MAX_IMAGE_SIZE = 8 * 1024 * 1024  # 8MB
MAX_IMAGES_PER_ALERT = 3
#extension is picked from the sniffed content, never the client-supplied filename
IMAGE_SIGNATURES = [
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"RIFF", ".webp"),  # confirmed further below (bytes 8-12 must read "WEBP")
]

def _sniff_image_extension(header: bytes) -> Optional[str]:
    """Identify JPEG/PNG/WEBP from the actual file bytes, not the client-supplied content-type."""
    for signature, ext in IMAGE_SIGNATURES:
        if header.startswith(signature):
            if ext == ".webp" and header[8:12] != b"WEBP":
                continue
            return ext
    return None
parkzen_auth_cache = {
    "token": None,
    "expires_at": None
}
permit_cache = {}
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
async def get_permit_name(permit_id: str, token: str):
    """fetch the real name of permit from Parkzen, using a cache to be fast"""
    if permit_id in permit_cache:
        return permit_cache[permit_id]
    
    url = f"https://api.parkzenapp.com/api/permits/{permit_id}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Use AsyncClient to prevent blocking the server
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
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

async def get_parkzen_token(username: str, password: str, force_refresh: bool = False) -> str:
    """Return a valid ParkZen token, logging in only when the cached one is
    missing, expired, or explicitly invalidated (force_refresh)."""
    current_time = datetime.now()
    if (not force_refresh
            and parkzen_auth_cache["token"] is not None
            and parkzen_auth_cache["expires_at"] is not None
            and parkzen_auth_cache["expires_at"] > current_time):
        return parkzen_auth_cache["token"]

    auth_url = "https://api.parkzenapp.com/api/auth/login"
    auth_payload = {"username": username, "password": password}
    async with httpx.AsyncClient() as client:
        auth_response = await client.post(auth_url, json=auth_payload)

    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to authenticate with ParkZen")

    auth_data = auth_response.json()
    token = auth_data.get("accessToken") or auth_data.get("token")
    if not token and "data" in auth_data:
        token = auth_data["data"].get("accessToken") or auth_data["data"].get("token")

    if not token:
        raise HTTPException(status_code=500, detail="Could not find token in login response")

    parkzen_auth_cache["token"] = token
    parkzen_auth_cache["expires_at"] = current_time + timedelta(minutes=10)
    return token

@app.get("/api/lots")
async def get_parking_lots():
    """Fetches UNT lots drawn in Parkzen Dashboard"""
    client_id = os.getenv("PARKZEN_CLIENT_ID", "University of North Texas")
    username = os.getenv("PARKZEN_USERNAME")
    password = os.getenv("PARKZEN_PASSWORD")

    if not username or not password:
        raise HTTPException(status_code=500, detail="Missing ParkZen credentials in backend .env")
    
    try:
        active_token = await get_parkzen_token(username, password)

        # FETCH THE LOTS ASYNCHRONOUSLY
        lots_url = f"https://api.parkzenapp.com/api/lots?clientId={client_id}"
        headers = {"Authorization": f"Bearer {active_token}"}

        async with httpx.AsyncClient() as client:
            lots_response = await client.get(lots_url, headers=headers)

        # A 401 here means the cached token was invalidated early (e.g., another
        # login on the shared ParkZen account) — force one fresh login and retry.
        if lots_response.status_code == 401:
            active_token = await get_parkzen_token(username, password, force_refresh=True)
            headers = {"Authorization": f"Bearer {active_token}"}
            async with httpx.AsyncClient() as client:
                lots_response = await client.get(lots_url, headers=headers)

        if lots_response.status_code != 200:
            raise HTTPException(lots_response.status_code, detail="Fail to fetch lots from ParkZen API")
        
        raws_lots_data = lots_response.json()
        actual_lots_array = raws_lots_data.get("data") or raws_lots_data.get("lots") or raws_lots_data

        if not isinstance(actual_lots_array, list):
            raise HTTPException(status_code=500, detail="Unexpected response format from ParkZen API")
        
        # 4. PROCESS THE DATA
        for lot in actual_lots_array:
            raw_permit_ids = lot.get("permits", [])
            readable_permits = []
            for permit_id in raw_permit_ids:
                # Need to await the async function here
                permit_name = await get_permit_name(permit_id, active_token)
                readable_permits.append(permit_name)

            lot["permits"] = readable_permits

            occupancy = lot.get("occupancy") or {}
            source_timestamp = (
                lot.get("lastUpdatedAt")
                or lot.get("updatedAt")
                or lot.get("updated_at")
                or lot.get("timestamp")
                or lot.get("lastUpdated")
                or lot.get("capturedAt")
                or lot.get("observedAt")
                or occupancy.get("lastUpdatedAt")
                or occupancy.get("updatedAt")
                or occupancy.get("updated_at")
                or occupancy.get("timestamp")
            )

            fetched_at = datetime.now(timezone.utc).isoformat()
            lot["backendFetchedAt"] = fetched_at

            if source_timestamp is not None:
                try:
                    if isinstance(source_timestamp, (int, float)):
                        epoch_seconds = source_timestamp / 1000 if source_timestamp > 1_000_000_000_000 else source_timestamp
                        lot["lastUpdatedAt"] = datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat()
                    else:
                        lot["lastUpdatedAt"] = datetime.fromisoformat(str(source_timestamp).replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
                except (TypeError, ValueError):
                    lot["lastUpdatedAt"] = str(source_timestamp)
            else:
                lot["lastUpdatedAt"] = None

            lot["sourceTimestampProvidedByParkzen"] = source_timestamp is not None
            lot["captureTimeSource"] = "parkzen" if source_timestamp is not None else "none"

            # Occupancy Logic 
            estimate = occupancy.get("parkzenServerOccupancyEstimate")
            if estimate is None:
                estimate = occupancy.get("lprEstimate")

            if estimate is not None:
                if estimate >= 0.95:
                    lot["fillColor"] = '#E74C3C'
                    lot["infoSheetTitle"] = "Full"
                elif estimate >= 0.85:
                    lot["fillColor"] = '#F39C12'
                    lot["infoSheetTitle"] = "Medium"
                else:
                    lot["fillColor"] = '#2ECC71'
                    lot["infoSheetTitle"] = "Available"

                method = occupancy.get("lastUpdatedVia") or "python-fusion"
                occupancy["lastUpdatedVia"] = method
                if not isinstance(occupancy.get(method), dict):
                    occupancy[method] = {}
                occupancy[method]["estimate"] = estimate
                lot["occupancy"] = occupancy
            else:
                lot["fillColor"] = '#808080'
                lot["infoSheetTitle"] = "No Data"
                if not isinstance(occupancy, dict):
                    occupancy = {}
                occupancy.setdefault("lastUpdatedVia", "unknown")
                occupancy["unknown"] = {"estimate": None}
                lot["occupancy"] = occupancy
                
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
            .filter(Alert.alert_type == alert_type, Alert.status == "published")\
            .order_by(desc(Alert.created_at))\
            .all()
    return alerts

@app.get("/alerts/pending", response_model=List[AlertResponse])
def get_pending_alerts(
    alert_type: str = Query(..., description="Must be 'hazard' or 'event'"),
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """Admin review queue: commuter-submitted alerts waiting for approval."""
    return db.query(Alert)\
            .filter(Alert.alert_type == alert_type, Alert.status == "pending")\
            .order_by(desc(Alert.created_at))\
            .all()
    
@app.post("/alerts/upload-image")
async def upload_alert_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Saves a single photo for a hazard/event report and returns its URL.
    Called once per selected photo before POST /alerts, which attaches the returned URLs."""
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 8MB")

    ext = _sniff_image_extension(contents[:12])
    if ext is None:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WEBP images are allowed")

    #random filename: never trust or reuse the client-supplied name
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)

    return {"image_url": f"/uploads/{filename}"}

@app.post("/alerts", response_model=AlertResponse)
def create_alert(
    alert_data: AlertCreate,
    db: Session= Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if alert_data.image_urls and len(alert_data.image_urls) > MAX_IMAGES_PER_ALERT:
        raise HTTPException(status_code=400, detail=f"A report can include at most {MAX_IMAGES_PER_ALERT} photos")

    #admin posts go live immediately; commuter reports wait for admin review
    new_alert = Alert(
        title=alert_data.title.upper(),
        alert_type=alert_data.alert_type.lower(),
        category=alert_data.category,
        description=alert_data.description,
        lot_name=alert_data.lot_name,
        image_urls=alert_data.image_urls or [],
        status="published" if current_user.role == "admin" else "pending"
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

@app.put("/alerts/{alert_id}/approve", response_model=AlertResponse)
def approve_alert(
    alert_id: int,
    edits: AlertApprove,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """Admin approves a pending report (optionally editing it) and publishes it."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved.")

    if edits.title is not None and edits.title.strip():
        alert.title = edits.title.strip().upper()
    if edits.category is not None and edits.category.strip():
        alert.category = edits.category.strip()
    if edits.description is not None:
        alert.description = edits.description.strip() or None
    if edits.image_urls is not None:
        alert.image_urls = edits.image_urls

    alert.status = "published"
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

