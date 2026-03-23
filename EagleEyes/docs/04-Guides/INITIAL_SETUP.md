🦅 **EagleEyes: Sprint 3 Local Setup Guide**

Hey team! This is a instruction for you to set up in your own device from Monica.

I've gone ahead and set up for both our backend and frontend. Everything is pre-configured to talk to each other right out of the box, including OS-detection to bypass Android network errors.

Here is your quick-start guide to getting the full stack running on your machine so we can start coding!

🛠️ **Prerequisites**
Before you pull the code, make sure you have these installed on your computer:

- Python (For our FastAPI backend)

- Node.js & npm (For our React Native frontend)

- Expo Go app downloaded on your physical phone, OR an iOS/Android Emulator installed on your computer.

🖥️ **Step 1: Boot Up the Backend (FastAPI)**
The Python backend is our engine. You must have this running first, otherwise, the mobile app will crash trying to fetch data that isn't there!

Clone this repo to your machine and navigate into the backend folder:
`cd backend`
Install the required Python packages:
`pip install -r requirements.txt`
Start the server using this exact command:
`uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
(Note: The --host 0.0.0.0 part is crucial! It opens the network so Android emulators can actually see the server).

✅ If it's working, you'll see a message saying "Application startup complete". Leave this terminal window open and running!

📱 **Step 2: Boot Up the Frontend (Expo / React Native)**
Now let's get the mobile UI running.

Open a second, completely new terminal window.

Navigate to the frontend folder:
`cd frontend`
Install the Node modules:
`npm install`
Start the Expo development server:
`npm start`

🚀 **Step 3: Launch the App!**
When the Expo menu appears in your frontend terminal, you have three ways to view the app:

Option A (Physical Phone - Fastest!): 
Make sure your phone and computer are on the same Wi-Fi. Open your camera and scan the giant QR code in the terminal to launch it in the Expo Go app.

Option B (iOS Simulator - Mac Only): 
Press i on your keyboard.

Option C (Android Emulator): 
Make sure your Android Studio virtual device is already awake, then press a on your keyboard.

🧪 **How to know it worked:**
I have implemented a smart-routing script built in inside index.tsx. It automatically detects if you are using an iPhone or Android and routes the API fetch call to the correct IP address (localhost vs 10.0.2.2).

When the app opens, you should briefly see a loading spinner, followed by this text:

**"Connected! Status: {"database": "disconnected", "parkzen_sdk": "pending"}"**

If you see that, your full-stack environment is officially working and you are ready to start coding! If you get a "Connection Failed" error, double-check that your backend terminal is still running.

**Let Monica know if you run to any problem!**