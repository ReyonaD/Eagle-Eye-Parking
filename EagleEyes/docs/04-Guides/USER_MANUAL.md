# EagleEyes – User Manual
**Version:** UM_001
**Team Name:** EagleEyes
**Date:** 10/11/2026

---

## 1. Introduction
EagleEyes Parking is a mobile and web application that helps University of North Texas (UNT) students, faculty, staff, and visitors find open parking on campus. It shows a live, color-coded map of campus parking lots, filters lots by parking permit, and hands off to your phone's maps app for directions. Users can also report parking hazards and send notes to UNT Transportation Services, cutting down the time spent circling campus looking for a spot.

---

## 2. System Requirements

**Hardware**
- An iPhone or Android phone, or a computer with a web browser
- An active internet connection (Wi-Fi or cellular data)
- Location services on the device (needed to show your location and nearby lots)
- For mobile installation only: a USB cable and a computer to install from (a Mac is required for iPhone)

**Software**
- **Web:** a current version of Chrome, Safari, Edge, or Firefox
- **iPhone:** iOS with Developer Mode turned on (required for apps installed by cable)
- **Android:** Android with USB debugging turned on (required for apps installed by cable)

**Other Dependencies**
- A UNT email address to create an account
- Live parking data comes from ParkZen's occupancy service. If that service is unavailable, lots appear grey ("No Data").

---

## 3. Installation Guide

### Web Version
No installation required. Open the live application in your browser: **[LIVE LINK]**

### Mobile Version (installed by cable)
The EagleEyes mobile app is not distributed through the App Store or Google Play. It is installed directly onto your phone from a computer by a member of the EagleEyes team.

**Android**
1. On the phone, open **Settings → About phone** and tap **Build number** 7 times to unlock Developer options.
2. Open **Settings → Developer options** and turn on **USB debugging**.
3. Connect the phone to the computer with a USB cable and tap **Allow** on the "Allow USB debugging?" prompt.
4. From the computer, the team installs the app by running `npx expo run:android --device` in the `frontend` folder (or `adb install EagleEyes.apk` if an APK has already been built).
5. When installation finishes, the EagleEyes icon appears on the phone.

**iPhone (requires a Mac with Xcode)**
1. Connect the iPhone to the Mac with a cable and tap **Trust This Computer** on the phone.
2. On the phone, turn on **Settings → Privacy & Security → Developer Mode**, then restart when prompted.
3. From the Mac, the team installs the app by running `npx expo run:ios --device` in the `frontend` folder and selecting your phone.
4. If the app does not open the first time, go to **Settings → General → VPN & Device Management**, tap the developer profile, and choose **Trust**.

> **Note:** An iPhone app installed with a free Apple developer account expires after 7 days and must be reinstalled. With a paid Apple Developer account it lasts one year.

---

## 4. Getting Started
1. **Launch the application:** On a phone, tap the **EagleEyes** icon. On a computer, open **[LIVE LINK]** in your browser.
2. **Create an account:** On the login screen, tap **Sign Up**. Enter your **UNT Email**, a **Password**, and **Confirm Password**, then tap **Sign Up**.
3. **Log in:** Enter your UNT Email and Password and tap **Log In**. If you forgot your password, tap **Forgot password?**, enter your email, and use the code sent to you (valid for 15 minutes) to set a new password.
4. **Allow location access:** When prompted, choose **Allow While Using App** so the map can show your location.
5. **Add your permit (optional):** Open the **PROFILE** tab → **Profile Setting**, choose your **Parking Permit**, and tap **Save**. Turn on **Only show me eligible parking for my permit** if you want the map to show only lots your permit allows.
6. Open the **MAP** tab to start exploring parking lots.

The app has three tabs on the bottom bar: **MAP**, **LOTS**, and **PROFILE**. The bell icon in the top bar opens **Alerts**.

---

## 5. Features & Functions

### Feature 1: Interactive Parking Map
#### Description
The Interactive Parking Map shows the parking lots across the UNT campus in one place. Each lot is drawn on the map and colored by its current occupancy, helping students, faculty, staff, and visitors identify potential parking locations.

#### How to Use
1. Open the EagleEyes application.
2. Go to the **MAP** tab.
3. Use the **CAMPUS** dropdown at the top to choose the campus you want to view.
4. Browse the map to locate parking lots around campus.
5. Tap a parking lot to open its details (see Feature 4).
6. Drag or pinch to move and zoom the map, or use the **+** / **–** buttons, to explore other parking areas.

#### Expected Result
The map displays parking lot locations and their current occupancy colors when parking data is available.

---

### Feature 2: Parking Availability Indicator
#### Description
EagleEyes displays parking occupancy using color-coded indicators. These help users quickly identify lots that may have available spaces and avoid lots that are nearly full.

| Color | Meaning | Recommended Action |
| -------- | -------- | -------- |
| Green | Lot is less than 85% full | Consider this lot as a parking option |
| Orange | Lot is 85% to under 95% full | Parking is limited. Consider another lot |
| Red | Lot is 95% to 100% full | Consider an alternative parking location |
| Grey | No occupancy data is currently available | Check the lot in person or consider an alternative |

#### How to Use
1. Open the **MAP** tab.
2. Locate the parking lot you are interested in.
3. Check the color displayed on the lot.
4. Make your parking decision based on the occupancy shown.
5. Repeat steps 2–4 for other lots if desired.

> **Note:** Parking availability is based on the latest data received by the application. Check the **Last synced** time at the top of the map, or the **ParkZen capture time** in a lot's details, before making a decision.

---

### Feature 3: Permit-Based Parking Filter
#### Description
The Permit-Based Parking Filter helps users find parking lots that accept their UNT parking permit. It reduces confusion about parking restrictions and helps users avoid lots that do not accept their permit.

#### How to Use
1. Open the **MAP** tab.
2. Tap the **PERMIT** dropdown at the top of the screen.
3. Select your permit type from the list (choose **All Permits** to show every lot).
4. Review the updated map. Only lots that accept the selected permit are shown.
5. Tap a lot to check its details for any additional restrictions.

**Other ways to filter by permit:**
- On the **LOTS** tab, use the **PERMIT** and **AVAILABILITY** filter buttons under the search bar.
- In **PROFILE → Profile Setting**, turn on **Only show me eligible parking for my permit** to filter the map automatically.
- **Day/Night permit rules:** Tap the map settings button on the map and choose **Day** or **Night** under **PERMIT RULES** to preview which lots your permit can use at that time of day.

> **Disclaimer:** Parking restrictions may depend on the lot, the designated parking area, and the time of day. Always follow the official UNT Transportation Services parking rules and posted signs.

---

### Feature 4: Parking Lot Details
#### Description
The Parking Lot Details panel provides more information about a selected lot, helping users decide whether it meets their parking needs.

#### How to Use
1. Open the **LOTS** tab from the bottom bar (or tap a lot on the **MAP**).
2. Type the lot name into the **Lot Search** bar.
3. Tap the lot to open its details panel.
4. Review the information displayed.

The details panel may include:
- Parking lot name and availability status
- **Occupancy** (percentage of the lot that is empty)
- **ParkZen capture time** (when the data was last updated)
- **Capacity** (total number of spaces)
- **Address**
- **Permits** accepted in the lot
- **Pay for Parking** button (for paid Premium Parking lots)
- **Get Directions** button

#### Expected Result
Users can review the selected lot's parking information when needed.

---

### Feature 5: Search and Get Directions to a Parking Lot
#### Description
This feature lets users search for a specific parking lot and open an external navigation app for directions to it.

> **Disclaimer:** Enable location services on your device and grant EagleEyes permission to access your location. If location access is unavailable, the navigation app may not be able to route from your current location.

#### How to Use
1. Open the **LOTS** tab from the bottom bar and search for the desired parking lot.
2. Select the parking lot.
3. Review the lot's parking information and permits.
4. Tap **Get Directions** and choose a navigation app (**Apple Maps** on iPhone, or **Google Maps**) to open a route to the lot.

---

### Feature 6: Find Nearby Parking Lots
#### Description
This feature helps users find convenient parking options based on their current location. Users can see where they are on the map and explore nearby parking lots.

> **Disclaimer:** Enable location services on your device and grant EagleEyes permission to access your location. If location access is unavailable, some proximity features may not work as expected.

#### How to Use
1. Open the **MAP** tab.
2. Allow EagleEyes to access your device's location when prompted. Make sure location services are enabled.
3. Locate the blue dot on the map. This shows your current location.

   ![Blue dot showing current location](https://hackmd.io/_uploads/HJkm2ldjGl.png)

4. Explore the parking lots displayed around your location.

#### Expected Result
The map displays your current location and nearby parking lots, so you can explore parking options and check their availability.

---

### Feature 7: Report a Hazard
#### Description
Authenticated users can report parking-related hazards, such as snow, flooding, a traffic jam, a fallen tree branch, or an item on the road, so UNT Transportation Services and other drivers are aware of them.

#### How to Use
1. Tap the yellow **⚠** button on the **MAP** (also available on the Alerts screen and in **PROFILE → Help & Support**).
2. Choose **Report a Hazard**.
3. Add a memo or description (lot, location, details).
4. Tap **SELECT HAZARD TYPE** and choose the type of hazard.
5. Optionally select the lot and tap **ADD** to attach photos from your camera or photo library.
6. Tap **SUBMIT**.

#### Expected Result
Your report is sent to a parking administrator for review. Once approved, it appears for all users in **Alerts**. Reports that are rejected are not published.

---

### Feature 8: Note to Admin
#### Description
The Note to Admin feature lets authenticated users send a one-way message to UNT Transportation Services about a parking-related situation that does not fit a hazard category. Examples include a vehicle breakdown or an unusual circumstance that prevents a vehicle from being moved.

> **Disclaimer:** This feature does not provide an in-app conversation or a direct reply from an administrator. Sending a note to admin does NOT guarantee that your vehicle will not be moved or cited by the department.

#### How to Use
1. Tap the yellow **⚠** button on the **MAP** (also available on the Alerts screen and in **PROFILE → Help & Support**).
2. Choose **Note to Admin**.
3. Enter a **SUBJECT** and **WRITE YOUR NOTE**.
4. Optionally select the related parking lot.
5. Tap **SUBMIT**.

#### Expected Result
A **Note sent** confirmation appears, and your note is delivered to the parking team for review.

---

### Feature 9: Campus Alerts
#### Description
The Alerts screen shows campus parking alerts posted by administrators and approved hazard reports, so users know about closures, events, and hazards before they drive.

#### How to Use
1. Tap the bell icon in the top bar.
2. Browse the alerts, grouped by category. Tap a section header to expand or collapse it.
3. Tap an alert to view its full details and photos.

---

## 6. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Unable to log in due to an invalid email or password | The email or password entered is incorrect, or the account is not registered yet | Double-check your email spelling. If you forgot your password, tap **Forgot password?** on the login screen and complete the steps. If you don't have an account, tap **Sign Up** first. |
| Not receiving a password reset code by email | The email went to the Spam/Junk folder, or a misspelled address was used | Check your Spam folder for an email from EagleEyes Parking. If it isn't there, return to the Forgot Password screen and retype your email carefully. Codes are only sent to registered email addresses. A code lasts 15 minutes. If it expires, request a new one. |
| The map opens but no parking lots are drawn | There is no internet connection, or the parking data server is temporarily unavailable | Turn Wi-Fi/cellular data off and back on, then close and reopen the app. If lots still don't appear after a minute, the server may be restarting. Wait a while and try again. |
| All lots appear grey | No occupancy data is currently available from ParkZen | Data should return automatically. Check the **Last synced** time at the top of the map, and try again later. |
| I filed a hazard report but it isn't showing in Alerts | Hazard reports are not published right away. They wait in a review queue until a parking administrator approves them | No action needed. After an admin approves your report, it will be visible to everyone. If it's rejected, it will not be published. |
| Distances in the "Select Lot" list all seem too far | Location access is off, so distances are measured from the campus center instead of your location | **iPhone:** Settings → EagleEyes → Location → **While Using the App**. **Android:** Settings → Apps → EagleEyes → Permissions → Location → **Allow only while using the app**. Then reopen the lot picker. |
| The iPhone app won't open after installation, or stopped working after a week | The developer profile isn't trusted, or the free-account install has expired (7 days) | Go to Settings → General → VPN & Device Management and trust the developer profile. If it expired, ask the EagleEyes team to reinstall the app. |
| The camera or photo library won't open when adding a photo | EagleEyes was not given camera or photo access | Open your phone's Settings → EagleEyes and allow **Camera** and **Photos** access. |

---

## 7. Contact Information
- **Support Email:** [contact email]
- **Website:** [LIVE LINK]
- **Project Repository:** https://github.com/ReyonaD/Eagle-Eye-Parking
- **Other Support Channels:** In the app, go to **PROFILE → Help & Support**

---

## 8. FAQ

**Q:** Do I need an account to use EagleEyes?
**A:** Yes. Create one with your UNT email by tapping **Sign Up** on the login screen.

**Q:** How current is the parking availability?
**A:** Availability comes from the latest data received from ParkZen. Check the **Last synced** time on the map or the **ParkZen capture time** in a lot's details.

**Q:** Why can't I see some parking lots on the map?
**A:** A permit filter may be on. Set the **PERMIT** dropdown to **All Permits**, or turn off **Only show me eligible parking for my permit** in Profile Setting.

**Q:** Can I pay for parking in the app?
**A:** For Premium Parking lots, the lot details include a **Pay for Parking** button that opens the payment page.

**Q:** Will an admin reply to my Note to Admin?
**A:** No. Notes are one-way messages to UNT Transportation Services, and there is no in-app reply.
