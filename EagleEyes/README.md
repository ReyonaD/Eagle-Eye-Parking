# 🦅 EagleEyes Backend & Systems Handoff Guide
This document provides the necessary technical context for the Frontend Team to interact with the FastAPI Backend and the ParkZen Native Bridge.
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
Please keep the following in mind when modifying `app/(tabs)/index.tsx`:\

**Native Module**: The `requestPermissions` and `getParkedLocation` functions are not standard React Native libraries. They are linked to the `parkzen-core` module in the `/modules` folder.\
**Localhost Networking**: When testing on a physical iPhone, you may need to replace `127.0.0.1` in the fetch URL with your computer's Local IP Address (e.g., `192.168.1.XX`).
**Mock Data**: Currently, the backend serves simulated UNT data. Once the ParkZen REST API URL is confirmed, the backend will be updated to serve live production data automatically.

## 5. Security Checklist
**[ ] API Keys**: Never hardcode ParkZen or Google Maps keys in the frontend logic.\
**[ ] Auth Tokens**: The `handleLogout` function in the Profile/Map screens must ensure `AsyncStorage.removeItem('token')` is called to clear the session.

Written by: Monica Vu(Team lead)