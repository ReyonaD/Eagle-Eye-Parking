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
from app.models import User, Alert, Note, DiagnosticLog, PasswordResetToken, PushToken
from app.schemas import UserCreate, UserPermitUpdate, UserNameUpdate, UserPlateUpdate, AlertResponse, AlertCreate, AlertApprove, AlertActiveUpdate, AlertEventUpdate, NoteCreate, NoteResponse, DiagnosticLogCreate, DiagnosticLogSummary, DiagnosticLogResponse, ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest, PushTokenRegister
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.security import SECRET_KEY, ALGORITHM, create_access_token, require_admin, require_owner
from app.core.email import send_password_reset_email
from app.core.push import send_alert_published, is_expo_push_token
from typing import List, Optional
Base.metadata.create_all(bind=engine)
#create_all does not add new columns to existing tables, so patch them in here.
#Existing alerts predate the approval flow and stay visible as 'published'.
with engine.connect() as _conn:
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'published'"))
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS lot_name VARCHAR"))
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS image_urls JSON"))
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS reporter_emails JSON"))
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS event_start TIMESTAMP"))
    _conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS event_end TIMESTAMP"))
    _conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS permit_type VARCHAR"))
    _conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR"))
    _conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE"))
    _conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS plate_state VARCHAR"))
    _conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS plate_number VARCHAR"))
    #the notes table itself is new enough that create_all above already made
    #it, but plate_state/plate_number were added after that first run
    _conn.execute(text("ALTER TABLE notes ADD COLUMN IF NOT EXISTS plate_state VARCHAR"))
    _conn.execute(text("ALTER TABLE notes ADD COLUMN IF NOT EXISTS plate_number VARCHAR"))
    #hazards now stay on the map until an admin deactivates them; before that
    #they simply lapsed 24h after being reported. When the column is first
    #added, close out those older hazards at their old expiry so they don't
    #all reappear on the map at once.
    has_deactivated_at = _conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'alerts' AND column_name = 'deactivated_at'"
    )).first()
    if not has_deactivated_at:
        _conn.execute(text("ALTER TABLE alerts ADD COLUMN deactivated_at TIMESTAMP"))
        _conn.execute(text(
            "UPDATE alerts SET deactivated_at = created_at + INTERVAL '24 hours' "
            "WHERE alert_type = 'hazard' AND status = 'published' "
            "AND created_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours'"
        ))
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

def _looks_like_heic(header: bytes) -> bool:
    #iPhones shoot HEIC by default; detect the ISO-BMFF ftyp box so we can convert
    return len(header) >= 12 and header[4:8] == b"ftyp" and header[8:12] in (
        b"heic", b"heix", b"hevc", b"mif1", b"msf1"
    )

def _convert_heic_to_jpeg(contents: bytes) -> bytes:
    from io import BytesIO
    import pillow_heif
    from PIL import Image as PILImage
    pillow_heif.register_heif_opener()
    img = PILImage.open(BytesIO(contents)).convert("RGB")
    buf = BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()
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
#how long a cached ParkZen permit (name + allowed hours) is trusted before
#it's re-fetched, so an hours change made in the ParkZen dashboard shows up
#in the app without a backend restart
PERMIT_CACHE_TTL = timedelta(hours=1)

async def get_permit_info(permit_id: str, token: str) -> Optional[dict]:
    """Fetch a permit from ParkZen - its name, type, and allowed parking
    hours (rules.dailyTimeSlots: per weekday, the time slots the permit may
    park in) - using a cache to be fast. None if ParkZen can't be reached."""
    cached = permit_cache.get(permit_id)
    if cached and cached["fetched_at"] > datetime.now() - PERMIT_CACHE_TTL:
        return cached["info"]

    url = f"https://api.parkzenapp.com/api/permits/{permit_id}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Use AsyncClient to prevent blocking the server
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                rules = data.get("rules") or {}
                info = {
                    "name": data.get("name") or data.get("title") or data.get("type") or "Unknown",
                    "type": data.get("type"),
                    "dailyTimeSlots": rules.get("dailyTimeSlots") or [],
                }
                permit_cache[permit_id] = {"info": info, "fetched_at": datetime.now()}
                return info
    except httpx.RequestError as e:
        print(f"Error fetching permit {permit_id}: {e}")
    #keep serving a stale copy rather than nothing if ParkZen is unreachable
    return cached["info"] if cached else None

async def get_permit_name(permit_id: str, token: str):
    """fetch the real name of permit from Parkzen, using a cache to be fast"""
    info = await get_permit_info(permit_id, token)
    return info["name"] if info else "Unknown"

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
    access_token = create_access_token(data={"sub": str(user.email), "role": user.role, "is_owner": user.is_owner})

    #hand the token to the mobile app
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": user.role,
        "is_owner": user.is_owner
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
        "name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "permit_type": current_user.permit_type,
        "is_owner": current_user.is_owner,
        "plate_state": current_user.plate_state,
        "plate_number": current_user.plate_number
    }

@app.put("/users/me/name")
def update_current_user_name(
    payload: UserNameUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lets a logged-in user set or change their display name."""
    current_user.name = payload.name.strip()
    db.commit()
    db.refresh(current_user)
    return {"name": current_user.name}

@app.put("/users/me/permit")
def update_current_user_permit(
    payload: UserPermitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lets a logged-in user set or change their parking permit, e.g. after
    picking one from GET /api/permits."""
    current_user.permit_type = payload.permit_type.strip()
    db.commit()
    db.refresh(current_user)
    return {"permit_type": current_user.permit_type}

@app.put("/users/me/plate")
def update_current_user_plate(
    payload: UserPlateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lets a logged-in user set, change, or clear their vehicle license plate."""
    current_user.plate_state = payload.plate_state.strip().upper()
    current_user.plate_number = payload.plate_number.strip()
    db.commit()
    db.refresh(current_user)
    return {"plate_state": current_user.plate_state, "plate_number": current_user.plate_number}

@app.post("/users/me/push-token")
def register_push_token(
    payload: PushTokenRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Called by the app after the user allows notifications, so this device
    gets a push whenever an alert is published. Re-registering is harmless."""
    if not is_expo_push_token(payload.token):
        raise HTTPException(status_code=400, detail="Not a valid Expo push token.")

    row = db.query(PushToken).filter(PushToken.token == payload.token).first()
    if row:
        #same phone, possibly a different account now: the latest login owns it
        row.user_id = current_user.id
        row.platform = payload.platform
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(PushToken(user_id=current_user.id, token=payload.token, platform=payload.platform))
    db.commit()
    return {"message": "Push token registered."}

@app.delete("/users/me/push-token")
def remove_push_token(
    token: str = Query(..., description="The Expo push token to stop sending to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Called on logout or when the user turns notifications off in Profile."""
    db.query(PushToken).filter(PushToken.token == token, PushToken.user_id == current_user.id)\
        .delete(synchronize_session=False)
    db.commit()
    return {"message": "Push token removed."}

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

def _get_parkzen_credentials() -> tuple[str, str, str]:
    client_id = os.getenv("PARKZEN_CLIENT_ID", "University of North Texas")
    username = os.getenv("PARKZEN_USERNAME")
    password = os.getenv("PARKZEN_PASSWORD")
    if not username or not password:
        raise HTTPException(status_code=500, detail="Missing ParkZen credentials in backend .env")
    return client_id, username, password

async def _fetch_raw_lots() -> tuple[list, str]:
    """Fetches the raw (unprocessed) lot list from ParkZen. Shared by /api/lots and
    /api/permits so both stay in sync with whatever ParkZen actually returns."""
    client_id, username, password = _get_parkzen_credentials()
    active_token = await get_parkzen_token(username, password)

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

    return actual_lots_array, active_token

@app.get("/api/permits")
async def get_permit_types():
    """Returns the distinct list of real ParkZen permit names (drawn from every
    lot's permit list), so the frontend's permit picker never drifts from what
    ParkZen actually recognizes."""
    try:
        actual_lots_array, active_token = await _fetch_raw_lots()

        raw_permit_ids: set[str] = set()
        for lot in actual_lots_array:
            for permit_id in lot.get("permits", []) or []:
                raw_permit_ids.add(permit_id)

        permit_names = set()
        for permit_id in raw_permit_ids:
            name = await get_permit_name(permit_id, active_token)
            if name and name != "Unknown":
                permit_names.add(name)

        return sorted(permit_names)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Server error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error while communicating to ParkZen")

@app.get("/api/permit-hours")
async def get_permit_hours():
    """When each permit may park, straight from ParkZen: one entry per permit
    used by any UNT lot, with its per-weekday allowed time slots
    (dailyTimeSlots: [{day, timeSlots: [{startTime, endTime}]}], 24h "HH:MM")."""
    try:
        actual_lots_array, active_token = await _fetch_raw_lots()

        permit_ids: set[str] = set()
        for lot in actual_lots_array:
            for permit_id in lot.get("permits", []) or []:
                permit_ids.add(permit_id)

        hours = []
        for permit_id in sorted(permit_ids):
            info = await get_permit_info(permit_id, active_token)
            if info and info["name"] != "Unknown":
                hours.append(info)
        return sorted(hours, key=lambda permit: permit["name"])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Server error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error while communicating to ParkZen")

@app.get("/api/lots")
async def get_parking_lots():
    """Fetches UNT lots drawn in Parkzen Dashboard"""
    try:
        actual_lots_array, active_token = await _fetch_raw_lots()

        # PROCESS THE DATA
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

@app.get("/admin/admins")
def list_admins(
    db: Session = Depends(get_db),
    is_owner: bool = Depends(require_owner)
):
    """Owner-only: the full admin roster, so an owner can see who else has
    admin access and decide whether to grant/revoke it."""
    admins = db.query(User).filter(User.role == "admin").order_by(User.email).all()
    return [
        {"id": a.id, "email": a.email, "name": a.name, "is_owner": a.is_owner}
        for a in admins
    ]

@app.put("/admin/users/{target_email}/grant-owner")
def grant_owner(
    target_email: str,
    db: Session = Depends(get_db),
    is_owner: bool = Depends(require_owner)
):
    """Owner-only: gives an existing admin owner-level access (can manage
    other admins too). The target must already be an admin."""
    target_user = db.query(User).filter(User.email == target_email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.role != "admin":
        raise HTTPException(status_code=400, detail="Only existing admins can be granted owner access.")

    target_user.is_owner = True
    db.commit()

    return {"message": f"User {target_email} is now an owner."}

@app.put("/admin/users/{target_email}/revoke")
def revoke_admin(
    target_email: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_owner: bool = Depends(require_owner)
):
    """Owner-only: strips a user's admin (and owner, if any) access back down
    to a regular commuter account. Guards against an owner locking themselves
    out and against leaving the system with zero owners."""
    if target_email == current_user.email:
        raise HTTPException(status_code=400, detail="You can't revoke your own access. Ask another owner to do it.")

    target_user = db.query(User).filter(User.email == target_email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.is_owner:
        remaining_owners = db.query(User).filter(User.is_owner == True, User.id != target_user.id).count()
        if remaining_owners == 0:
            raise HTTPException(status_code=400, detail="Can't remove the last remaining owner.")

    target_user.role = "commuter"
    target_user.is_owner = False
    db.commit()

    return {"message": f"User {target_email}'s admin access has been revoked."}

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

@app.get("/alerts/declined", response_model=List[AlertResponse])
def get_declined_alerts(
    alert_type: str = Query(..., description="Must be 'hazard' or 'event'"),
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """Admin-only history of reports an admin declined, kept instead of hard-deleted."""
    return db.query(Alert)\
            .filter(Alert.alert_type == alert_type, Alert.status == "declined")\
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
    if ext is None and _looks_like_heic(contents[:12]):
        #iPhone HEIC photos get converted to JPEG so every client can display them
        try:
            contents = _convert_heic_to_jpeg(contents)
            ext = ".jpg"
        except Exception:
            raise HTTPException(status_code=400, detail="Could not process this photo. Please try a different one.")
    if ext is None:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WEBP images are allowed")

    #random filename: never trust or reuse the client-supplied name
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)

    return {"image_url": f"/uploads/{filename}"}

#reports for the same lot+hazard type stay "live" for this long; a report older
#than this is treated as resolved/stale and no longer absorbs new duplicates
DUPLICATE_REPORT_WINDOW = timedelta(hours=48)

@app.post("/alerts", response_model=AlertResponse)
def create_alert(
    alert_data: AlertCreate,
    background_tasks: BackgroundTasks,
    db: Session= Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if alert_data.image_urls and len(alert_data.image_urls) > MAX_IMAGES_PER_ALERT:
        raise HTTPException(status_code=400, detail=f"A report can include at most {MAX_IMAGES_PER_ALERT} photos")

    alert_type = alert_data.alert_type.lower()

    #dedup/merge models "multiple different commuters independently reporting
    #the same hazard" - it never applies to admin posts (there's no multi-
    #reporter confirmation signal when it's the same admin posting twice),
    #and a lot-less report can't be confirmed as "the same incident" as
    #another lot-less report, so only dedupe for commuters with a lot picked
    existing = None
    if current_user.role != "admin" and alert_data.lot_name:
        existing = db.query(Alert).filter(
            Alert.alert_type == alert_type,
            Alert.category == alert_data.category,
            Alert.lot_name == alert_data.lot_name,
            Alert.status.in_(["pending", "published"]),
            Alert.created_at >= datetime.now(timezone.utc) - DUPLICATE_REPORT_WINDOW,
        ).order_by(desc(Alert.created_at)).first()

    if existing:
        #merge in any new photos this report added, up to the per-alert cap
        merged_images = list(existing.image_urls or [])
        for url in (alert_data.image_urls or []):
            if url not in merged_images and len(merged_images) < MAX_IMAGES_PER_ALERT:
                merged_images.append(url)
        existing.image_urls = merged_images

        #fold in a differing description so admins don't lose the new detail
        if alert_data.description and alert_data.description != existing.description:
            existing.description = (
                f"{existing.description}\nAlso reported: {alert_data.description}"
                if existing.description else alert_data.description
            )

        #the same person re-reporting isn't a second confirmation - only a
        #new distinct reporter should bump the "N students reported this" count
        reporters = list(existing.reporter_emails or [])
        if current_user.email not in reporters:
            reporters.append(current_user.email)
            existing.reporter_emails = reporters
            existing.upvotes = len(reporters)

        db.commit()
        db.refresh(existing)
        return existing

    #admin posts go live immediately; commuter reports wait for admin review
    new_alert = Alert(
        title=alert_data.title.upper(),
        alert_type=alert_type,
        category=alert_data.category,
        description=alert_data.description,
        lot_name=alert_data.lot_name,
        image_urls=alert_data.image_urls or [],
        status="published" if current_user.role == "admin" else "pending",
        reporter_emails=[current_user.email],
        event_start=alert_data.event_start,
        event_end=alert_data.event_end,
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    #commuter reports are pushed later, when an admin approves them
    if new_alert.status == "published":
        background_tasks.add_task(send_alert_published, new_alert.id, current_user.id)
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

#─── Notes (private commuter -> admin messages; see Note model for why this
#is its own table instead of another Alert category) ────────────────────────

@app.post("/notes", response_model=NoteResponse)
def create_note(
    note_data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if note_data.image_urls and len(note_data.image_urls) > MAX_IMAGES_PER_ALERT:
        raise HTTPException(status_code=400, detail=f"A note can include at most {MAX_IMAGES_PER_ALERT} photos")

    new_note = Note(
        title=note_data.title.strip(),
        description=note_data.description,
        lot_name=note_data.lot_name,
        phone_number=note_data.phone_number,
        plate_state=note_data.plate_state,
        plate_number=note_data.plate_number,
        image_urls=note_data.image_urls or [],
        event_start=note_data.event_start,
        event_end=note_data.event_end,
        reporter_email=current_user.email,
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note

@app.get("/notes", response_model=List[NoteResponse])
def get_notes(
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """Admin-only: every note to admin, newest first. The admin UI buckets
    these into Acknowledgment Pending/Active/Expired client-side from
    event_end and acknowledged_at - there's no server-side status filter."""
    return db.query(Note).order_by(desc(Note.created_at)).all()

@app.put("/notes/{note_id}/acknowledge", response_model=NoteResponse)
def acknowledge_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    note.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)
    return note

#─── Diagnostic logs (app console output a commuter sends from Help & Support
#so we can trace bugs that only reproduce on their device) ──────────────────

@app.post("/logs", response_model=DiagnosticLogSummary, status_code=status.HTTP_201_CREATED)
def submit_diagnostic_log(
    log_data: DiagnosticLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_log = DiagnosticLog(
        reporter_email=current_user.email,
        description=(log_data.description or "").strip() or None,
        platform=log_data.platform,
        os_version=log_data.os_version,
        app_version=log_data.app_version,
        device_info=log_data.device_info,
        logs=log_data.logs,
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@app.get("/logs", response_model=List[DiagnosticLogSummary])
def list_diagnostic_logs(
    reporter_email: Optional[str] = Query(None, description="Only logs sent by this user"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """Admin-only: newest submissions first, without the log body (use GET /logs/{id})."""
    query = db.query(DiagnosticLog)
    if reporter_email:
        query = query.filter(DiagnosticLog.reporter_email == reporter_email)
    return query.order_by(desc(DiagnosticLog.created_at)).limit(limit).all()

@app.get("/logs/{log_id}", response_model=DiagnosticLogResponse)
def get_diagnostic_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    log = db.query(DiagnosticLog).filter(DiagnosticLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found.")
    return log

@app.put("/alerts/{alert_id}/approve", response_model=AlertResponse)
def approve_alert(
    alert_id: int,
    edits: AlertApprove,
    background_tasks: BackgroundTasks,
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

    was_published = alert.status == "published"
    alert.status = "published"
    db.commit()
    db.refresh(alert)
    if not was_published:
        background_tasks.add_task(send_alert_published, alert.id)
    return alert

@app.put("/alerts/{alert_id}", response_model=AlertResponse)
def update_event(
    alert_id: int,
    payload: AlertEventUpdate,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """Admin edits a published event's details - e.g. setting the end date of
    an event that was saved with "No end date" once it's known."""
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.alert_type == "event").first()
    if not alert:
        raise HTTPException(status_code=404, detail="Event not found.")
    if payload.event_end is not None and payload.event_end < payload.event_start:
        raise HTTPException(status_code=400, detail="End date/time must be after the start date/time.")

    alert.title = payload.title.strip().upper()
    alert.category = payload.category
    alert.description = payload.description
    alert.lot_name = payload.lot_name or None
    alert.event_start = payload.event_start
    alert.event_end = payload.event_end
    db.commit()
    db.refresh(alert)
    return alert

@app.put("/alerts/{alert_id}/active", response_model=AlertResponse)
def set_hazard_active(
    alert_id: int,
    payload: AlertActiveUpdate,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """Admin takes a published hazard off the map/lots once it's over
    (active=false), or puts it back up (active=true). Unlike DELETE, the
    hazard stays in the published history."""
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.alert_type == "hazard",
        Alert.status == "published",
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Published hazard not found.")

    alert.deactivated_at = None if payload.active else datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert

@app.delete("/alerts/{alert_id}")
def remove_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_role: str = Depends(require_admin)
):
    """
    One endpoint, three outcomes depending on the report's current status:
    - pending   -> decline it: keep the row as 'declined' instead of erasing
                   it, so admins can see what's been turned down
    - published -> resolved hazard being pulled off the live feed: gone for good
    - declined  -> admin clearing out old rejected history: gone for good
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code= 404, detail="Alert not found or already resolved.")

    if alert.status == "pending":
        alert.status = "declined"
        db.commit()
        return {"message": "Report declined."}

    db.delete(alert)
    db.commit()
    return {"message": "Alert successfully resolved and removed from the feed."}

