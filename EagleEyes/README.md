# 🦅 EagleEyes Backend & Systems Handoff Guide
This document provides the necessary technical context for the Frontend Team to interact with the FastAPI Backend and the ParkZen Native Bridge.

## Quick Start Guide

### Prerequisites
- **Node.js** 18+ with npm
- **Python** 3.9+ (for backend)
- **Xcode Command Line Tools** (for iOS simulator)

### Option 1: Development Server (Recommended for Active Development) 🚀

**Start the Backend (in a separate terminal):**
```bash
cd EagleEyes/backend
source venv/bin/activate
python3 -m venv venv  # Only first time
pip install -r requirements.txt  # Only first time
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Start the Frontend Dev Server:**
```bash
cd EagleEyes/frontend
npm install  # Only first time
npx expo start --clear
```

**Then open the app:**
- Press `i` to open iOS simulator
- Or scan the QR code with Expo Go app on your iPhone

---

### Option 2: Native Build (For Production/ParkZen Testing) 📱

**Prerequisites:**
- Xcode installed
- CocoaPods: `sudo gem install cocoapods`

**Start the Backend** (same as above)

**Build and Run Native iOS App:**
```bash
cd EagleEyes/frontend
npx expo run:ios
```

---

## 1. Developer Setup (Python Backend)
To run the parking data engine locally, follow these steps. The server must be active for the Map View to display any parking lots.
Prerequisites: Python 3.9+, Pip\
Bash
### 1. Navigate to the backend directory
`cd EagleEyes/backend`

### 2. Create a virtual environment
`python3 -m venv venv`

### 3. Activate the environment
`source venv/bin/activate  # On Windows: venv\Scripts\activate`

### 4. Install dependencies
`pip install -r requirements.txt`

### 5. Start the development server
`uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

## 2. System Architecture Overview
The app uses a Three-Tier Architecture to keep API keys secure and handle native hardware communication.
| Component | Responsibility | Technology |
| :--- | :--- | :--- |
| **Frontend** | Map UI, Polygons, User Auth State | React Native (Expo) |
| **Backend** | Data Proxy, JWT Auth, Database | Python (FastAPI) |
| **Native Bridge** | Background SDK Communication | Swift (iOS) / Kotlin (Android) |
## 3. API Reference for Frontend
The Map Screen (index.tsx) is configured to fetch data from the following endpoint.\
GET /api/lots\
Description: Returns the coordinates and live occupancy status for UNT parking lots.\
**Expected Response Shape:**
JSON\
```
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
Note: `isFull: true` should be rendered as Red (Occupied).\ `isFull: false` should be rendered as Green (Available).

## 4. Frontend Integration Notes

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
- **Physical iPhone:** Replace `localhost` with your MAC's local IP (e.g., `192.168.1.XX`)
- **Android Emulator:** Use `http://10.0.2.2:8000`

### Mock Data
Currently, the backend serves simulated UNT data. Once the ParkZen REST API URL is confirmed, the backend will be updated to serve live production data automatically.

## 5. Security Checklist
**[ ] API Keys**: Never hardcode ParkZen or Google Maps keys in the frontend logic.\
**[ ] Auth Tokens**: The `handleLogout` function in the Profile/Map screens must ensure `AsyncStorage.removeItem('token')` is called to clear the session.

Written by: Monica Vu (Team lead)  
Updated: April 14, 2026

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