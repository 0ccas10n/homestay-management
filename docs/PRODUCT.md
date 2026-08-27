# Homestay Management System — Product Requirements

## 1. Product Overview

This project is a homestay management system with two interfaces:

1. **Public Website** — for customers/visitors.
2. **Internal Web App** — for staff/owners.

The system uses **Google Sheets as the initial database** and is deployed on **Vercel**.

### Core architecture

```text
Customer / Staff Browser
        |
        v
Vite + React + TypeScript
        |
        v
Vercel API / Serverless Functions
        |
        v
Google Sheets API
        |
        v
Private Google Spreadsheet
```

Google credentials must never be exposed to the browser.

---

## 2. Goals

### Public Website

Allow customers to:

- Learn about the homestay.
- View locations/branches.
- View rooms.
- View room availability (by exact date/time).
- Select dates and times to check availability.
- Contact the homestay by phone, Zalo, or another configured contact method.
- Understand that booking is completed through direct contact.

The public website must **not** provide online booking or customer account creation.

### Internal Web App

Allow authorized staff to:

- Log in securely.
- View an operational dashboard.
- View a calendar.
- Manage rooms.
- Manage bookings (hourly, overnight, or multi-day stays).
- Manage locations.
- Manage cleaning status.
- View customer information when authorized.
- Update booking and room status.
- Track exact check-in and check-out times.
- Handle overtime billing when guests stay past their expected checkout.
- Add internal notes.
- Manage basic staff access.

---

## 3. Non-Goals

The first version must NOT attempt to build:

- Online payment.
- Customer self-service accounts.
- Customer online booking.
- Complex accounting.
- Full hotel PMS functionality.
- Automated smart-lock control.
- Public display of lockbox passwords.
- Public display of customer names, phone numbers, or internal notes.
- Complex multi-property enterprise features.

---

## 4. User Roles

### Public Visitor

Can:

- View public information.
- View rooms.
- View availability.
- Contact the homestay.

Cannot:

- Access the admin area.
- View customer information.
- View internal notes.
- View lockbox information.
- Modify data.

### Staff

Can:

- Access the internal app after authentication.
- View and manage operational data according to permissions.

### Admin

Can:

- Do everything Staff can do.
- Manage staff access.
- Manage system configuration.

---

## 5. Public Availability Rules

The public website must expose only information that is safe to publish.

Public users may see:

- Room name.
- Location/branch.
- Room description.
- Public room photos.
- Public amenities.
- Whether a room is available for a selected date/date range.
- A configured contact method.

Public users must NOT see:

- Customer name.
- Customer phone number.
- Customer email.
- Booking ID.
- Internal booking notes.
- Staff notes.
- Lockbox password.
- Exact security/access instructions.
- Private operational information.

The UI should avoid exposing unnecessary patterns that could reveal sensitive operational information.

---

## 6. Booking Model

A booking is created and managed internally.

The public website does not create bookings.

Typical flow:

```text
Customer
  |
  v
Public Website
  |
  v
Check availability
  |
  v
Contact homestay
  |
  v
Staff confirms booking
  |
  v
Staff creates booking in Internal App
```

---

## 7. Room Status

Room status and booking status are different concepts.

### Room status

Recommended values:

- `available`
- `occupied`
- `cleaning`
- `maintenance`
- `inactive`

### Booking Status

Recommended values:

- `inquiry`
- `confirmed`
- `checked_in`
- `checked_out`
- `cancelled`
- `no_show`

The application must not assume that a room's current status alone determines date-range availability. Availability should be calculated from bookings plus room status.

---

## 7b. Hybrid Booking Model (Exact DateTime)

This system supports a **hybrid booking model** where guests can stay for a few hours, overnight, or multiple days.

### Core principle

Every booking has **exact check-in and check-out timestamps** (`checkInAt`, `checkOutAt` as ISO 8601 datetime strings). There are no hardcoded "check-in from 14:00" or "check-out by 11:00" rules baked into the data model — these are configurable display/business rules, not storage constraints.

### Stay types (derived from duration, not hardcoded)

| Duration | Classification | Example |
|---|---|---|
| < 12 hours | Short stay / Hourly | 2-hour meeting room use |
| 12–24 hours | Overnight | Check-in 22:00, check-out 10:00 next day |
| > 24 hours | Multi-day | Standard hotel-style stay |

The UI may classify and label stays for display purposes, but the data model stores exact datetimes only.

### Overtime

If a guest stays past their `checkOutAt`, the system calculates overtime based on the **actual check-out time recorded at departure** vs. the **expected check-out time**. Overtime is charged at an hourly rate defined per rate plan.

```text
expected checkout: 2026-08-28T12:00:00+07:00
actual checkout:   2026-08-28T14:30:00+07:00
overtime minutes:   150 minutes
overtime charge:    ceil(150 / 60) × hourly_rate
```

The system must not automatically extend `checkOutAt` — overtime is a separate financial record computed at check-out time.

---

## 8. Cleaning Workflow

Staff should be able to:

1. See upcoming check-outs (with exact checkout timestamps).
2. See rooms that require cleaning.
3. Mark a room as `cleaning`.
4. Complete cleaning.
5. Mark the room as ready/available.

Cleaning records should include:

- Room.
- Related booking when applicable.
- Scheduled date/time.
- Status.
- Assigned staff member.
- Completion time.
- Optional internal note.

The cleaning schedule is driven by `checkOutAt` timestamps on bookings, not by a fixed daily schedule.

---

## 9. Dashboard

The internal dashboard should provide a simple operational overview:

- Today's check-ins.
- Today's check-outs.
- Rooms needing cleaning.
- Current occupied rooms.
- Available rooms.
- Upcoming bookings.
- Alerts or important operational items.

The dashboard should prioritize clarity over visual complexity.

---

## 10. Calendar

The internal calendar should support:

- Day/week/month views where practical.
- Room-based booking display.
- Check-in/check-out visibility with exact times.
- Booking status.
- Filtering by location/branch.
- Clicking a booking to view details (including exact timestamps, rate plan, overtime status).

The public availability view should be simpler and must not expose internal booking details.

The calendar must display bookings with their exact `checkInAt` / `checkOutAt` timestamps, not date-only values.

---

## 11. Locations

The system may have multiple branches/locations.

Each location should contain:

- Location ID.
- Public name.
- Public address/area information.
- Public description.
- Active/inactive status.

Internal location data may contain additional operational fields that are never returned by public APIs.

---

## 12. Security Requirements

Security is a product requirement, not an optional feature.

### Mandatory

- Google Spreadsheet remains private.
- Google service-account credentials remain server-side.
- Secrets are stored in Vercel Environment Variables.
- No Google private key is committed to Git.
- Admin routes require authentication.
- Admin APIs require authentication and authorization.
- Public APIs return only explicitly approved public fields.
- Customer/private data must never be sent to public API responses.
- Lockbox passwords must never be returned by public APIs.
- Validate all API inputs.
- Do not trust client-side authorization checks.
- Log important admin actions where practical.

---

## 13. Performance Expectations

The first version is intended for a small homestay operation.

Priorities:

1. Correctness.
2. Security.
3. Simple maintenance.
4. Reasonable response time.
5. Good mobile and desktop usability.

Google Sheets is acceptable for the initial MVP, but the code should isolate database access so it can later be replaced by PostgreSQL/Supabase without rewriting the UI.

---

## 14. Product Principles

- Keep the public website simple.
- Keep the internal app operational and fast.
- Never expose internal information just because it exists in Google Sheets.
- Separate public data from private data at the API layer.
- Prefer reusable components.
- Prefer typed data models.
- Avoid hard-coded mock data in production paths.
- Do not introduce unnecessary dependencies.
- Do not rewrite working Figma-generated UI without a reason.

---

## 15. Definition of Done

The MVP is considered functional when:

- Public pages work.
- Public availability is loaded from the backend.
- Internal login works.
- Unauthorized users cannot access internal APIs.
- Staff can view rooms and bookings.
- Staff can create/update/cancel bookings.
- Staff can manage room status.
- Staff can manage cleaning status.
- Data persists in Google Sheets.
- Google credentials are server-side only.
- Public APIs cannot expose private customer or security data.
- The application can be deployed to Vercel.
