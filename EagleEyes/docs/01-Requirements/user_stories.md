# 📋 EagleEye User Stories

This document outlines the core functional requirements for the **EagleEye** real-time parking application. Each story represents a specific feature prioritized for the Minimum Viable Product (MVP).

---

## 🚗 Student & Faculty Users
*Goal: To find parking efficiently and reduce time spent circling UNT lots.*

| ID | As a... | I want to... | So that... |
| :--- | :--- | :--- | :--- |
| **US-01** | UNT Student | See a live count of available spaces in a specific lot (e.g., Union Circle). | I can decide if it's worth driving there before I arrive. |
| **US-02** | Faculty Member | Filter search results by my specific permit type (A, P, or G). | I only see spots that I am legally allowed to park in. |
| **US-03** | Student | Receive a notification when a "watched" lot drops below 5 available spots. | I can pivot to a backup lot immediately. |
| **US-04** | User | Tap a "Navigate" button on a specific lot. | I can get GPS directions directly to the entrance via my preferred maps app. |

## 🛠️ System Administrators
*Goal: To ensure data accuracy and manage campus-wide parking status.*

| ID | As an... | I want to... | So that... |
| :--- | :--- | :--- | :--- |
| **US-05** | Admin | Manually override a lot's status to "Closed." | I can reflect temporary closures due to construction or UNT events. |
| **US-06** | Developer | Access an API endpoint that returns JSON data of all lot statuses. | The React Native frontend can display current information to users. |

---

## ✅ Acceptance Criteria Example (US-01)
To consider a story "Done," it must meet these technical requirements:
1. **Latency:** The "Live Count" must reflect sensor data changes within 10 seconds.
2. **Visuals:** The UI must use color-coding (Green/Yellow/Red) to indicate occupancy levels.
3. **Accessibility:** The count must be readable by screen readers for students with visual impairments.

---