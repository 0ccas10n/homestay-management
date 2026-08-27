# Homestay Management System — API Specification

## 1. API Principles

Base path:

```text
/api
```

The frontend communicates with the backend through these endpoints.

The browser must never call Google Sheets API directly.

```text
Browser
  ↓
/api/*
  ↓
Vercel Function
  ↓
Repository
  ↓
Google Sheets API
```

---

## 2. Response Format

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Do not expose stack traces or internal credentials.

---

## 3. Authentication

Protected endpoints require a valid authenticated session.

Authentication should use an HTTP-only cookie.

Example:

```text
Cookie: session=<signed-session-token>
```

The frontend should not store authentication tokens in localStorage if an HTTP-only cookie can be used.

Protected API authorization must happen server-side.

---

# 4. Authentication Endpoints

## POST /api/auth/login

Purpose:

Authenticate an internal staff member.

Request:

```json
{
  "email": "staff@example.com",
  "password": "password"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "USR-0001",
      "name": "Staff",
      "email": "staff@example.com",
      "role": "staff"
    }
  }
}
```

The response must NOT include:

- password hash
- session secret
- private credentials

---

## POST /api/auth/logout

Purpose:

Invalidate the current session.

Authentication:

```text
Required
```

Response:

```json
{
  "success": true,
  "data": null
}
```

---

## GET /api/auth/me

Purpose:

Return the current authenticated user.

Authentication:

```text
Required
```

Response:

```json
{
  "success": true,
  "data": {
    "userId": "USR-0001",
    "name": "Staff",
    "email": "staff@example.com",
    "role": "staff"
  }
}
```

---

# 5. Public Location API

## GET /api/locations

Authentication:

```text
Public
```

Purpose:

Return active locations and only their public fields.

Response:

```json
{
  "success": true,
  "data": [
    {
      "locationId": "LOC-0001",
      "name": "Downtown",
      "description": "Main location",
      "publicAddress": "..."
    }
  ]
}
```

---

# 6. Public Room API

## GET /api/rooms

Authentication:

```text
Public
```

Optional query parameters:

```text
locationId
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "roomId": "ROOM-0001",
      "locationId": "LOC-0001",
      "name": "Room 01",
      "description": "Private room",
      "capacity": 2,
      "imageUrl": "..."
    }
  ]
}
```

Do not return:

- customer data
- internal notes
- booking IDs
- lockbox information
- staff information

---

# 7. Public Availability API

## GET /api/availability

Authentication:

```text
Public
```

Query parameters:

```text
roomId
checkIn     (ISO 8601 datetime, e.g. 2026-08-28T14:00:00%2B07:00)
checkOut    (ISO 8601 datetime)
```

Example:

```text
/api/availability?roomId=ROOM-0001&checkIn=2026-08-28T14:00:00%2B07:00&checkOut=2026-08-28T16:00:00%2B07:00
```

Response:

```json
{
  "success": true,
  "data": {
    "roomId": "ROOM-0001",
    "checkIn": "2026-08-28T14:00:00+07:00",
    "checkOut": "2026-08-28T16:00:00+07:00",
    "available": true
  }
}
```

The endpoint must calculate availability by checking for overlapping bookings using exact datetime comparison. It must not return private booking details.

---

# 8. Internal Room API

All endpoints in this section require authentication.

## GET /api/rooms

Purpose:

Return rooms for the internal application.

May include internal operational status.

Response:

```json
{
  "success": true,
  "data": [
    {
      "roomId": "ROOM-0001",
      "locationId": "LOC-0001",
      "name": "Room 01",
      "status": "available",
      "active": true
    }
  ]
}
```

---

## POST /api/rooms

Purpose:

Create a room.

Required role:

```text
admin
```

Request:

```json
{
  "locationId": "LOC-0001",
  "name": "Room 03",
  "description": "Private room",
  "capacity": 2
}
```

The server generates `roomId`.

---

## PATCH /api/rooms/:id

Purpose:

Update room information/status.

Required role:

```text
staff or admin
```

Only approved fields may be modified.

---

## DELETE /api/rooms/:id

Purpose:

Deactivate a room.

Preferred behavior:

```text
soft delete
```

Set:

```text
active = false
status = inactive
```

Do not physically delete historical data unless explicitly required.

---

# 9. Internal Booking API

## GET /api/bookings

Authentication:

```text
Required
```

Optional filters:

```text
roomId
locationId
status
from        (ISO 8601 datetime — filter checkInAt >= from)
to          (ISO 8601 datetime — filter expectedCheckOutAt <= to)
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "bookingId": "BOOK-0001",
      "roomId": "ROOM-0001",
      "customerId": "CUS-0001",
      "checkInAt": "2026-08-28T14:00:00+07:00",
      "expectedCheckOutAt": "2026-08-28T16:00:00+07:00",
      "status": "confirmed",
      "source": "phone"
    }
  ]
}
```

Customer details should only be included when the authenticated user has permission to view them.

---

## GET /api/bookings/:id

Authentication:

```text
Required
```

Returns one booking and permitted customer information.

Never expose the booking through public APIs.

---

## POST /api/bookings

Authentication:

```text
Required
```

Request:

```json
{
  "roomId": "ROOM-0001",
  "customer": {
    "name": "Customer",
    "phone": "..."
  },
  "checkInAt": "2026-08-28T14:00:00+07:00",
  "expectedCheckOutAt": "2026-08-28T16:00:00+07:00",
  "status": "confirmed",
  "source": "phone",
  "ratePlanId": "RP-0001",
  "note": ""
}
```

Server responsibilities:

1. Authenticate user.
2. Validate all fields (required, datetime format, enum values).
3. Validate room exists.
4. Validate rate plan exists.
5. Validate datetime range (checkInAt < expectedCheckOutAt).
6. **Re-validate availability on the server** using exact datetime overlap check.
7. Create customer if required.
8. Calculate `expectedDurationMinutes` and `baseAmount` from rate plan.
9. Create booking with computed amount fields.
10. Return created booking.

Never trust an availability result calculated previously by the browser.

The server must use exact datetime comparison for overlap detection:

```text
existing.checkInAt < requested.expectedCheckOutAt
AND
existing.expectedCheckOutAt > requested.checkInAt
```

---

## PATCH /api/bookings/:id

Authentication:

```text
Required
```

Purpose:

Update booking status, dates, room, source, or permitted notes.

When `actualCheckOutAt` is provided (guest checking out):

```json
{
  "actualCheckOutAt": "2026-08-28T14:30:00+07:00"
}
```

The server must:

1. Compare `actualCheckOutAt` against `expectedCheckOutAt`.
2. If `actualCheckOutAt > expectedCheckOutAt`, compute `overtimeMinutes` and `overtimeAmount`.
3. Update `totalAmount = baseAmount + overtimeAmount`.
4. Set booking `status = 'checked_out'` and room `status = 'cleaning'`.

The server must revalidate any change that could cause an overlap (changing room or dates).

---

## DELETE /api/bookings/:id

Preferred behavior:

Do not physically delete.

Set:

```text
status = cancelled
```

This preserves operational history.

---

# 10. Cleaning API

## GET /api/cleaning

Authentication:

```text
Required
```

Optional filters:

```text
date
status
roomId
```

---

## POST /api/cleaning

Authentication:

```text
Required
```

Request:

```json
{
  "roomId": "ROOM-0001",
  "bookingId": "BOOK-0001",
  "scheduledAt": "2026-08-30T10:00:00+07:00",
  "assignedTo": "USR-0001"
}
```

---

## PATCH /api/cleaning/:id

Authentication:

```text
Required
```

Example:

```json
{
  "status": "completed"
}
```

When cleaning is completed, the application may update room status according to the defined business rules.

---

# 10b. Rate Plans API

Rate plans define pricing for bookings. They are referenced by bookings but managed independently.

## GET /api/rate-plans

Authentication:

```text
Required
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "ratePlanId": "RP-0001",
      "name": "Quick Stay",
      "type": "hourly",
      "baseMinutes": 120,
      "baseAmount": 25,
      "extraMinutePrice": 0.20,
      "overtimeMinutePrice": 0.20,
      "active": true
    }
  ]
}
```

Rate plan type:

```text
hourly      — short stay, charged per minute block
overnight   — flat rate for a defined window (e.g. 22:00–10:00)
daily       — flat rate per 24-hour period
```

The `extraMinutePrice` is charged for minutes beyond `baseMinutes` within the expected stay. The `overtimeMinutePrice` is charged for minutes past `expectedCheckOutAt`.

---

# 11. Dashboard API

## GET /api/dashboard

Authentication:

```text
Required
```

Purpose:

Return a compact operational summary.

Example:

```json
{
  "success": true,
  "data": {
    "todayCheckIns": 3,
    "todayCheckOuts": 2,
    "availableRooms": 8,
    "occupiedRooms": 5,
    "roomsToClean": 2,
    "upcomingBookings": []
  }
}
```

The dashboard should not require the frontend to download every booking and calculate everything itself.

For datetime-aware dashboard queries, use `from`/`to` datetime filters (ISO 8601) to scope "today's" check-ins and check-outs precisely, accounting for timezone.

---

# 12. Authorization Rules

Example:

| Endpoint | Public | Staff | Admin |
|---|---:|---:|---:|
| GET /api/locations | Yes | Yes | Yes |
| GET public rooms | Yes | Yes | Yes |
| GET /api/availability | Yes | Yes | Yes |
| GET internal bookings | No | Yes | Yes |
| POST booking | No | Yes | Yes |
| PATCH booking | No | Yes | Yes |
| Create room | No | No | Yes |
| Update room | No | Yes | Yes |
| Cleaning | No | Yes | Yes |
| User management | No | No | Yes |

These permissions must be enforced on the server.

---

# 13. Validation

Every endpoint must validate:

- Required fields.
- String lengths.
- Enum values.
- Date format.
- Check-in/check-out order.
- IDs.
- Role permissions.
- Resource existence.

Never rely only on frontend validation.

---

# 14. Rate Limiting / Abuse Protection

Public endpoints can be accessed by anyone.

For production, consider:

- Rate limiting.
- Request size limits.
- Basic abuse detection.
- Caching for public room/location data.
- Restricting expensive availability queries.

Do not create an endpoint that allows arbitrary spreadsheet queries.

---

# 15. Security Rules

Never:

```text
Browser → Google Sheets API
```

Always:

```text
Browser → Vercel API → Google Sheets API
```

Never send these to the browser:

```text
GOOGLE_PRIVATE_KEY
GOOGLE_SERVICE_ACCOUNT_EMAIL
SESSION_SECRET
password_hash
lockbox_password
internal_notes
private customer data
```

The server is the security boundary.

---

# 16. Future API Evolution

If the database changes from Google Sheets to PostgreSQL/Supabase, the public and internal API contracts should remain mostly unchanged.

```text
Frontend
   ↓
API
   ↓
Repository interface
   ↓
Google Sheets      PostgreSQL
```

This is a deliberate architectural goal.
