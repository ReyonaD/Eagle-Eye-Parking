# Contributions

Major features, documents, and project work each team member contributed to EagleEyes Parking (Group 3), compiled from the git history, the team's Work Assignment tracker, and sprint reports (Spring 2026 through Fall 2026 Capstone 2).

| Member | GitHub |
|---|---|
| Nhan Vu (Team Lead) | MonicaVu04080918 |
| Thuan Nguyen (Emma) | nthtemma03 |
| Luis Lozano | LuisEnriqueLozano |
| Alperen Dalkir | ReyonaD |
| Aaditya Yadav | aky0037 |

## Nhan Vu (Team Lead)

**Leadership & integration**
- Ran weekly team meetings and task assignment; led stakeholder communication, including setup sessions with ParkZen
- Reviewed, revised, and submitted the team's documents each sprint
- Merged everyone's branches each sprint week and resolved conflicts; reviewed and merged PRs #21, #22, and #24–#29

**Software**
- Set up the project skeleton (FastAPI backend, Expo/React Native frontend), emulator setup docs, and local connectivity
- Integrated ParkZen for live UNT lot data; configured iOS/Android builds for ParkZenCore; upgraded to ParkZen SDK 1.0.4
- Built full-stack authentication, role-based login, admin role levels, and the admin dashboard backend
- Migrated the database to Neon serverless; fixed early logouts caused by token expiry
- Analyzed UNT's lot naming and permit hierarchy to implement daytime "park-down" permit rules, then added night-time rules, permit hours, grouped permit pickers, and reserved-permit matching
- Redesigned the Map View and Lots tab (mobile and web); fixed ParkZen lot filtering that hid real lots; fixed map panning/zooming on iPhone
- Built the web admin layout, account-based profiles, event scheduling, and hazard/note review; fixed Note to Admin end to end
- Added hazard report photo attachments (admins can remove/replace them) and the "Other" hazard type; redesigned the Alerts page; fixed duplicate-hazard logic
- Fixed web-only issues (map imports, dialogs, logout, image upload format, ngrok interference, login and admin approval)
- Showed lot closures, events, and hazards on the map; added Premium Parking payment links; limited dark mode to the map
- Set up push notifications (Firebase for Android, APNs for iOS), including "My Updates" pushes when an admin acknowledges a note
- Made admin access changes take effect immediately (live role checks, live Admin Management, auto-logout for revoked admins)
- Blocked hazard reports on closed lots and warned admins about events or hazards on closed lots
- Added lot search and nearest-first sorting to the lot picker; required a location on hazard reports; validated license plates
- Prepared the app for production deployment

**Documentation**
- Project Plan 1.1 & 1.2 (Fall update: 1.8); WBS design
- SRS: Other Nonfunctional Requirements, Other Requirements, and Appendices A/B/C (Sections 5–6)
- Design Docs: Class Diagram and System Architecture Diagram; Non-Interactive Prototype (all updated for Capstone 2)
- Test Plan: Milestones/Deliverables; Test Schedule and Test Plan Tracker
- Assignment 0: new feature ideas and the change control process for the approved feature
- ATP: Test Environment, Acceptance Criteria, Acceptance Test Cases, Defects Found, Test Summary, and execution screenshots (Sections 4–8, Appendix)
- User Acceptance Procedure; in-class peer testing form for Team 2 (revised and submitted)
- ParkZen data: permit entry, on-street parking spaces, and QA of entered dashboard data
- User manual with screenshots, README, `docs/` guides, and the testing folder

## Thuan Nguyen (Emma)

**Software**
- Built the Map View frontend; replaced pins with lot names on the map and redesigned its look
- Designed and implemented the Admin Dashboard tabs and profile tab; redesigned the admin profile menu with quick actions
- Added the top bar, EagleEyes logo, and event calendar; improved the Add Event form after backend hookup and filtered events by date
- Added the hazard report icon/subtab and a report option in Help & Support
- Implemented UI/UX updates across all tabs (with Aaditya), including Lot tab filter and Add Report button cleanup
- Implemented dark mode
- Added contact details and a ticketing disclaimer to Note to Admin
- Fixed Android tab icons

**Documentation**
- Project Charter 1.1 & 1.2; Project Plan 1.8 & 1.9 (Fall update: 1.1); WBS design
- SRS: Introduction (Fall update: title page, version control, purpose, scope)
- Design Docs: Use Case Diagram; wireframes (draft and digital, updated for commuter and admin); project logo
- Non-interactive prototype for the alert/notification feature; Figma designs for profile, Map View, and Lot tab
- Test Plan: Introduction & Scope
- Assignment 0: feasibility study and change request for Roadside Assistance
- ATP: Purpose, Client/Stakeholder Acceptance, Roles and Responsibilities (Sections 2, 9, 10)
- Peer testing form: Feature Verification, Usability & UX, Team Summary
- ParkZen data entry: rows 63-100 (Lots 63-86, HSG, DP); permit revamp for Lots 81 and 91; Trello upkeep

## Luis Lozano

**Software**
- Built the Alerts page frontend and bell-icon navigation; debugged frontend-backend connection issues
- Converted ParkZen permit data into each user's permits in the Lots tab
- Added Lots tab pagination; consolidated A-Reserved, Resident Reserved, and street lot emblems; fixed the permit filter dropdown
- Added location-based ("Near you") permit ordering and made Day/Night follow the clock

**Documentation**
- Project Plan 1.11 & 1.12 (Fall update: 1.10)
- SRS: Overall Description (Fall update: new feature requirements, user story, constraints, assumptions)
- Design Docs: Data Flow Diagram (updated for Capstone 2); wireframe draft
- Test Plan: Test Approach; Test Plan Tracker updates
- Assignment 0: feasibility study and change request for the EV Charger Locator
- ATP: Scope (Section 3)
- Peer testing form: Functional Testing Checklist
- ParkZen data entry: rows 3-22 (Lots 1-19); Trello upkeep

## Alperen Dalkir

**Software**
- Built the backend for the Android app and fixed the Android Map View; stabilized frontend-backend integration
- Deployed the backend on Railway
- Implemented forgot/reset password with emailed one-time codes (Gmail SMTP) and a 6-digit code screen
- Built hazard reporting and admin review/approval, including photo upload (HEIC-to-JPEG) and photo replacement
- Worked on the alert/notification feature; added unread-alert badges on the Alerts page and top bar
- Switched occupancy to ParkZen's LPR-based measurements
- Built the lot details sheet, "Get Directions" map-app picker, and distance display; fixed campus/permit dropdowns and CORS
- Maintained the branch used for integration (PRs #25 and #27–#29)

**Documentation**
- Project Plan 1.3, 1.4 & 1.5
- SRS: System Features (Fall update: new feature section with testable requirements)
- Design Docs: State Transition Diagram (updated for Capstone 2)
- Test Plan: Test Environment
- Assignment 0: feasibility study and change request for Note to Admin
- Peer testing form: Defect Log
- ParkZen data entry: Lot 20 and rows 23-42 (Lots 20-35); permit revamp for Lots 20, 23, 27, and 29

## Aaditya Yadav

**Software**
- Built the Lots tab UI: search, status badges, filters, permit badges, and lot cards; improved UI responsiveness
- Implemented the admin Hazards tab (list, detail, post-alert)
- Built the Edit Profile and Profile Settings screens with the color-coded permit card and saved lots
- Built the commuter Note to Admin form, matched the admin side to the prototype, and moved notes into their own backend model
- Added "My Updates" so students are notified when admins review their submissions

**Documentation**
- Project Plan 1.6 & 1.7 (Fall update: 1.6)
- SRS: External Interface Requirements (updated for Capstone 2)
- Design Docs: Entity-Relationship Diagram (updated for Capstone 2)
- Test Plan: Assumptions and Risks
- Assignment 0: change control process for rejected features
- ParkZen data entry: rows 43-62 (Lots 36-59); permit revamp for Lots 34, 37, 44, and 53

## How to Contribute
See [docs/04-Guides/INITIAL_SETUP.md](./docs/04-Guides/INITIAL_SETUP.md) to get the project running locally before submitting changes.
