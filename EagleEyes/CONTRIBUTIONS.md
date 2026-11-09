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
- Built the web-specific admin layout, event scheduling, and hazard/note triage workflows; reworked the Note to Admin feature
- Added night-time permit rules, location-aware map, grouped permit pickers, Premium Parking payment links, and lot-specific reserved-permit matching
- Redesigned the Alerts page, fixed permit filtering and alert/duplicate-hazard logic, and persisted the user's license plate
- Showed lot closures, events, and hazards on the map; added permit hours and a map-only dark mode
- Upgraded to ParkZen SDK 1.0.4 (new bundle identifier) and set up push notifications via Firebase (Android) and APNs (iOS)
- Connected "My Updates" note-status notifications to push notifications when an admin acknowledges a note
- Wrote the user manual with app screenshots and prepared the app for production deployment

## Thuan Nguyen (Emma)
- Built the Map View tab and added parking lot markers/pins
- Designed and implemented the Admin Dashboard tabs and profile tab
- Added the app top bar, EagleEye logo, and calendar/event display
- Fixed Android tab icons and cleaned up overall UI/UX consistency
- Replaced map pins with lot name labels and added the hazard report icon/subtab
- Connected the Add Event form to the backend and filtered events by selected date on the calendar
- Added contact details and a ticketing disclaimer to the Note to Admin feature

## Aaditya Yadav
- Built the Lots tab UI: search, status badges, filters, permit badges, and redesigned lot cards
- Implemented the admin Hazards tab (list, detail, and post-alert screens)
- Added the functional Edit Profile screen with permit card and saved lots
- Redesigned the Profile screen with Profile Settings and a color-coded permit card
- Built the commuter-side Note to Admin form and matched the admin Note to Admin UI to the approved prototype
- Added "My Updates" to notify students when admins review their submissions

## Alperen Dalkir
- Implemented the forgot/reset password flow, including one-time expiring codes emailed via Gmail SMTP and a 6-digit OTP input screen
- Built hazard reporting and the admin review/approval flow for hazards and alerts, including photo upload (with HEIC-to-JPEG conversion) and photo replacement during approval
- Updated parking occupancy handling to use ParkZen's real LPR-based measurement data
- Implemented the lot details bottom sheet, "Get Directions" map-app picker, and distance formatting on the map and lots tab
- Fixed campus/permit dropdown behavior and CORS configuration on the backend
- Added the AlertsBadge context for unread-alert badges in the Alerts screen and top bar

## Luis Lozano
- Added the Alerts screen and bell-icon navigation from other tabs
- Added pagination to the Lots page for a cleaner list view
- Consolidated reserved/street lot emblems and fixed the Lots tab permit filter dropdown
- Added "Near you" permit ordering and made Day/Night mode follow the clock

## How to Contribute
See [docs/04-Guides/INITIAL_SETUP.md](./docs/04-Guides/INITIAL_SETUP.md) to get the project running locally before submitting changes.
