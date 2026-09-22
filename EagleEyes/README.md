# 🦅 EagleEye Parking

## Project Description

EagleEye Parking is a mobile and web app that helps UNT students, faculty, and staff find open parking on campus in real time. It shows a live map of campus parking lots color-coded by availability, lets users filter lots by the permit type they hold, and helps them navigate to an open lot. Users can also report parking hazards (blocked spaces, downed signs, etc.) with photos, and admins can review those reports and post alerts that everyone sees on the map and in the app.

The goal is to cut down the time drivers spend circling campus looking for a spot by surfacing accurate, near-real-time lot occupancy instead of static maps or guesswork.

**Core features:**
- Live campus map with color-coded lot occupancy (open / full), powered by ParkZen's license-plate-recognition data feed
- Filtering lots by permit type, campus region, and distance, with a "Get Directions" hand-off to the phone's maps app
- Role-based accounts (commuter vs. admin) with email/password login and a forgot/reset-password flow
- Hazard reporting with photo uploads, plus an admin review and approval workflow
- Campus alerts (posted by admins) shown on the map, on lot cards, and in a dedicated Alerts tab
- Admin dashboard for managing hazards, alerts, and promoting users to admin

## Technologies Used

**Frontend** (`EagleEyes/frontend`)
- React Native + [Expo](https://expo.dev/) (Expo Router for navigation), TypeScript/JavaScript
- `react-native-maps` / `@vis.gl/react-google-maps` for the map UI (native vs. web)
- `expo-image-picker` for hazard-report photo uploads
- `react-native-calendars` for the events/alerts calendar

**Backend** (`EagleEyes/backend`)
- Python 3.9+ with [FastAPI](https://fastapi.tiangolo.com/) and Uvicorn
- SQLAlchemy ORM with Alembic migrations, running on a Neon (serverless Postgres) database
- `python-jose` + `passlib`/`bcrypt` for JWT-based authentication
- `httpx` for calling the ParkZen occupancy API
- Gmail SMTP for password-reset emails

**Native bridge**
- Swift (iOS) / Kotlin (Android) module (`frontend/modules/parkzen-core`) for on-device communication with the ParkZen SDK

**Tooling**
- npm (frontend), pip + venv (backend)
- ESLint (frontend linting)
- ngrok, for bridging a phone/simulator to a local backend during development

## Installation Instructions

**Prerequisites:**
- Node.js 18+ with npm
- Python 3.9+
- Xcode Command Line Tools (for the iOS simulator) or Android Studio (for the Android emulator)
- Expo Go app on your phone (optional, for testing without a simulator)

**1. Clone the repository**
```bash
git clone <repo-url>
cd Eagle-Eye-Parking/EagleEyes
```

**2. Set up the backend**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Create a `.env` file in `backend/` with your database URL, JWT secret, and email credentials (ask a team member for the values used in development).

**3. Set up the frontend**
```bash
cd ../frontend
npm install
```

## How to Run the Application

**Start the backend** (in one terminal):
```bash
cd EagleEyes/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend must be running for the app to show any parking-lot data.

**Start the frontend** (in a second terminal):
```bash
cd EagleEyes/frontend
npx expo start --clear
```
Then:
- Press `i` to open the iOS simulator, `a` for the Android emulator, or `w` to open it in a browser
- Or scan the QR code with the Expo Go app on your phone

**Native build** (required to test the real ParkZen hardware bridge, instead of the mock/manual "Find My Car" flow):
```bash
cd EagleEyes/frontend
npx expo run:ios      # or: npx expo run:android
```
This requires Xcode and CocoaPods (`sudo gem install cocoapods`) for iOS.

## Testing

There is not yet an automated test suite in the repository — `backend/tests/` and the top-level `Testing/` folder are reserved for that as it's added (backend tests are expected to use `pytest`).

In the meantime, the team tests manually before merging:
- **Manual QA**: exercising each changed screen/flow in the Expo dev client (iOS simulator, Android emulator, and web) and against a running local backend
- **API checks**: hitting backend endpoints directly (e.g., via FastAPI's `/docs` Swagger UI at `http://localhost:8000/docs`) to verify request/response shapes
- **Cross-platform pass**: features that touch the map or native modules are checked on both iOS and Android, since `EagleMap.tsx` and the ParkZen bridge behave differently per platform

---

## System Architecture Overview
The app uses a three-tier architecture to keep API keys secure and handle native hardware communication.

| Component | Responsibility | Technology |
| :--- | :--- | :--- |
| **Frontend** | Map UI, Polygons, User Auth State | React Native (Expo) |
| **Backend** | Data Proxy, JWT Auth, Database | Python (FastAPI) |
| **Native Bridge** | Background SDK Communication | Swift (iOS) / Kotlin (Android) |

## API Reference for Frontend
The Map Screen (`index.tsx`) is configured to fetch data from the following endpoint.

`GET /api/lots`
Description: Returns the coordinates and live occupancy status for UNT parking lots.

**Expected Response Shape:**
```json
[
  {
    "id": "lot-20",
    "name": "Lot 20 (Eagle)",
    "isFull": false,
    "polygonCoordinates": [
      {"latitude": 33.2160, "longitude": -97.1500},
      {"latitude": 33.2160, "longitude": -97.1470},
      {"latitude": 33.2145, "longitude": -97.1470},
      {"latitude": 33.2145, "longitude": -97.1500}
    ]
  }
]
```
Note: `isFull: true` should be rendered as Red (Occupied). `isFull: false` should be rendered as Green (Available).

## Frontend Integration Notes

### Current Status (April 2026)
- ✅ Map display with live lot data
- ✅ Lot details modal
- ✅ User authentication flow
- ❌ ParkZen core **disabled** in dev server (commented out in `components/EagleMap.tsx`)
- ⏳ GPS location tracking (planned)
- ⏳ Automatic parking detection (requires ParkZen core in native build)

### ParkZen Core Module
The `requestPermissions` and `getParkedLocation` functions are linked to the `parkzen-core` module in `/modules/parkzen-core`.

**Current Dev Server Status:**
- ParkZen imports are **commented out** in `components/EagleMap.tsx` (lines 5, 16-24)
- "Find My Car" uses manual parking simulation (long-press map)

**To Enable ParkZen (Native Build Only):**
1. Uncomment the import on line 5 of `components/EagleMap.tsx`
2. Uncomment the `setupParkZen` function (lines 16-24)
3. Uncomment the `setupParkZen()` call (line 56)
4. Run `npx expo run:ios` instead of `npx expo start`

### Localhost Networking
- **Dev Server (Simulator):** Use `http://localhost:8000`
- **Physical iPhone:** Replace `localhost` with your Mac's local IP (e.g., `192.168.1.XX`)
- **Android Emulator:** Use `http://10.0.2.2:8000`

### Mock Data
Currently, the backend serves simulated UNT data. Once the ParkZen REST API URL is confirmed, the backend will be updated to serve live production data automatically.

## Security Checklist
- [ ] **API Keys**: Never hardcode ParkZen or Google Maps keys in the frontend logic.
- [ ] **Auth Tokens**: The `handleLogout` function in the Profile/Map screens must ensure `AsyncStorage.removeItem('token')` is called to clear the session.

## 🛠️ Android Build Setup
This project strictly requires **Java 17**.
If your Android build fails, ensure your terminal is using Java 17:
1. `brew install openjdk@17`
2. `export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"`

## 🔄 Switching Branches?
If you switch branches or pull new code and the app won't build, run:
`npm run reset-android`

## Troubleshooting

### Dev Server Issues
| Problem | Solution |
| :--- | :--- |
| Port 8081 already in use | Use a different port: `npx expo start --port 8082` |
| App keeps refreshing | Check `app/_layout.tsx` auth logic, ensure token is set in AsyncStorage |
| Backend unreachable | Verify backend is running on `http://localhost:8000` |
| Native modules error | Make sure you're using `npx expo start`, not `npx expo run:ios` |

### Native Build Issues
| Problem | Solution |
| :--- | :--- |
| Cannot find ParkZen module | Ensure ParkZen imports are uncommented and you're using `npx expo run:ios` |
| Pod errors | Run `rm -rf ios/Pods ios/Pods.lock && npx expo run:ios` |
| Java version mismatch | Install Java 17: `brew install openjdk@17` |

---
Maintained by the EagleEye Parking team (UNT CSCE Capstone).
