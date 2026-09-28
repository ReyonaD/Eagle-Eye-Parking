# Contributions

This file lists the major features, modules, and documents each team member contributed to the EagleEyes Parking project.

## Nhan Vu (Team Lead)
- Set up the initial backend (FastAPI) and frontend (Expo/React Native) foundation and connected them together
- Implemented role-based authentication (register/login) on the backend and the frontend `auth.js` API layer
- Integrated the ParkZen SDK/API to pull live parking lot data, including occupancy timestamps and auto-refresh logic
- Built admin-dashboard endpoints, including promoting a commuter account to admin
- Migrated the database to Neon serverless and tuned connection pooling
- Redesigned the Map View UI/UX (mobile and web) and fixed lot-naming/regex filtering issues
- Added photo attachments to hazard reports and fixed web-platform support
- Set up Android/iOS device syncing (ngrok bridging, native module fixes) for the whole team
- Wrote and maintained project documentation (`docs/` folder structure and guides) and the backend handoff README

## Thuan Nguyen (Emma)
- Built the Map View tab and added parking lot markers/pins
- Designed and implemented the Admin Dashboard tabs and profile tab
- Added the app top bar, EagleEye logo, and calendar/event display
- Fixed Android tab icons and cleaned up overall UI/UX consistency

## Aaditya Yadav
- Built the Lots tab UI: search, status badges, filters, permit badges, and redesigned lot cards
- Implemented the admin Hazards tab (list, detail, and post-alert screens)
- Added the functional Edit Profile screen with permit card and saved lots

## Alperen Dalkir
- Implemented the forgot/reset password flow, including one-time expiring codes emailed via Gmail SMTP and a 6-digit OTP input screen
- Built hazard reporting and the admin review/approval flow for hazards and alerts, including photo upload (with HEIC-to-JPEG conversion) and photo replacement during approval
- Updated parking occupancy handling to use ParkZen's real LPR-based measurement data
- Implemented the lot details bottom sheet, "Get Directions" map-app picker, and distance formatting on the map and lots tab
- Fixed campus/permit dropdown behavior and CORS configuration on the backend

## Luis Lozano
- Added the Alerts screen and bell-icon navigation from other tabs
- Added pagination to the Lots page for a cleaner list view

## How to Contribute
See [docs/04-Guides/INITIAL_SETUP.md](./docs/04-Guides/INITIAL_SETUP.md) to get the project running locally before submitting changes.
