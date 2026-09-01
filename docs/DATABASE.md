# Homestay Management System — Database Design

## 1. Database Choice

The initial database is **Google Sheets**.

The spreadsheet is private and is accessed only through the server-side Google Sheets API.

```text
Browser
  ↓
Vercel API
  ↓
Google Sheets API
  ↓
Private Spreadsheet
```

Do not expose the spreadsheet URL or service-account credentials through public APIs.

---

## 2. Spreadsheet Structure

Use one Google Spreadsheet with separate worksheets:

```text
Locations
Rooms
Bookings
Customers
Cleaning
Users
```

Optional future sheets:

```text
AuditLogs
Settings
RoomAmenities
```

---

## 3. Locations Sheet

Worksheet name:

```text
Locations
```

Columns:

| Column | Type | Required | Description |
|---|---|---:|---|
| location_id | string | Yes | Unique location ID |
| name | string | Yes | Public location name |
| description | string | No | Public description |
| public_address | string | No | Public address/area |
| phone | string | No | Public contact phone |
| active | boolean | Yes | Whether location is active |
| created_at | datetime | Yes | Creation time |
| updated_at | datetime | Yes | Last update |

Example:

```text
L001 | Downtown | Main location | ... | true
L002 | Beach | Beach location | ... | true
```

Do not store sensitive security information in fields returned to the public.

---

## 4. Rooms Sheet

Worksheet name:

```text
Rooms
```

Columns:

| Column | Type | Required | Description |
|---|---|---:|---|
| room_id | string | Yes | Unique room ID |
| location_id | string | Yes | Related location |
| name | string | Yes | Room name |
| description | string | No | Public description |
| capacity | number | Yes | Maximum guest capacity |
| price_display | string | No | Public price text if applicable |
| status | enum | Yes | Current operational status |
| active | boolean | Yes | Whether room is active |
| image_url | string | No | Public image URL |
| created_at | datetime | Yes | Creation time |
| updated_at | datetime | Yes | Last update |

Room status:

```text
available
occupied
cleaning
maintenance
inactive
```

Sensitive fields such as lockbox passwords must NOT be stored in a sheet that is ever exposed through public APIs.

If operational access information is needed later, keep it in a separate private sheet/table with a separate repository and strict authorization.

---

## 5. Customers Sheet

Worksheet name:

```text
Customers
```

Columns:

| Column | Type | Required | Description |
|---|---|---:|---|
| customer_id | string | Yes | Unique customer ID |
| name | string | Yes | Customer name |
| phone | string | No | Customer phone |
| email | string | No | Customer email |
| note | string | No | Internal note |
| created_at | datetime | Yes | Creation time |
| updated_at | datetime | Yes | Last update |

This sheet is PRIVATE.

Never return Customers rows from public endpoints.

---

## 6. Bookings Sheet

Worksheet name:

```text
Bookings
```

Columns:

| Column | Type | Required | Description |
|---|---|---:|---|
| booking_id | string | Yes | Unique booking ID |
| room_id | string | Yes | Related room |
| customer_id | string | Yes | Related customer |
| checkInAt | datetime | Yes | Exact check-in timestamp (ISO 8601, e.g. `2026-08-28T14:00:00+07:00`) |
| expectedCheckOutAt | datetime | Yes | Expected check-out timestamp (set at booking time) |
| actualCheckOutAt | datetime | No | Recorded at check-out; empty until guest departs |
| status | enum | Yes | Booking status |
| ratePlanId | string | Yes | Associated rate plan |
| expectedDurationMinutes | number | Yes | Calculated: minutes between checkInAt and expectedCheckOutAt |
| baseAmount | number | Yes | Base charge for expectedDurationMinutes |
| overtimeMinutes | number | No | Minutes past expectedCheckOutAt at actual departure |
| overtimeAmount | number | No | Charge for overtimeMinutes |
| totalAmount | number | Yes | baseAmount + overtimeAmount |
| numGuests | number | No | Number of guests |
| note | string | No | Internal note |
| created_by | string | Yes | Staff user ID |
| created_at | datetime | Yes | Creation time |
| updated_at | datetime | Yes | Last update |

Booking status:

```text
inquiry
confirmed
checked_in
checked_out
cancelled
no_show
```

Booking source:

```text
phone
zalo
walk_in
other
```

The public website does not create bookings.

**Note on stay types:** Short-stay (< 12h), overnight, and multi-day stays are all represented by the same booking record. The duration is derived from `checkInAt` / `expectedCheckOutAt`. There are no hardcoded overnight start/end hours in the data model.

---

## 7. Cleaning Sheet

Worksheet name:

```text
Cleaning
```

Columns:

| Column | Type | Required | Description |
|---|---|---:|---|
| cleaning_id | string | Yes | Unique cleaning ID |
| room_id | string | Yes | Related room |
| booking_id | string | No | Related booking |
| scheduledAt | datetime | Yes | Scheduled cleaning timestamp (ISO 8601) |
| status | enum | Yes | Cleaning status |
| assigned_to | string | No | Staff user ID |
| started_at | datetime | No | Actual start time |
| completed_at | datetime | No | Completion time |
| note | string | No | Internal note |
| created_at | datetime | Yes | Creation time |
| updated_at | datetime | Yes | Last update |

Cleaning status:

```text
pending
in_progress
completed
cancelled
```

The `scheduledAt` field is driven by the `expectedCheckOutAt` timestamp of the related booking — staff schedule cleaning immediately after a guest's expected departure time.

---

## 8. Users Sheet

Worksheet name:

```text
Users
```

Columns:

| Column | Type | Required | Description |
|---|---|---:|---|
| user_id | string | Yes | Unique user ID |
| name | string | Yes | Staff name |
| email | string | Yes | Login email |
| password_hash | string | Yes | Password hash |
| role | enum | Yes | User role |
| active | boolean | Yes | Whether account is active |
| created_at | datetime | Yes | Creation time |
| updated_at | datetime | Yes | Last update |

Roles:

```text
staff
admin
```

Never store plaintext passwords.

---

## 9. Relationships

```text
Locations
    |
    | 1-to-many
    v
Rooms
    |
    | 1-to-many
    v
Bookings
    |
    | many-to-one
    v
Customers

Rooms
    |
    | 1-to-many
    v
Cleaning
```

Logical relationships:

```text
Rooms.location_id → Locations.location_id
Bookings.room_id → Rooms.room_id
Bookings.customer_id → Customers.customer_id
Cleaning.room_id → Rooms.room_id
Cleaning.booking_id → Bookings.booking_id
Cleaning.assigned_to → Users.user_id
Bookings.created_by → Users.user_id
```

Google Sheets does not enforce foreign keys. The application must validate references.

---

## 10. Availability Calculation

Do not store a permanent `available=true/false` value for every date.

Availability should be calculated.

For a room and requested time window:

```text
Room is available if:

1. Room is active.
2. Room is not in maintenance/inactive status.
3. No non-cancelled booking overlaps the requested time window.
```

DateTime overlap rule (ISO 8601 timestamps):

```text
Existing booking:   [checkInAt, expectedCheckOutAt)
Requested stay:     [requestedCheckIn, requestedCheckOut)

They overlap when:

checkInAt < requestedCheckOut
AND
expectedCheckOutAt > requestedCheckIn
```

The open interval `[checkInAt, expectedCheckOutAt)` means a guest who checks out at exactly the same moment another checks in is not an overlap. This is equivalent to checking out "by" X and checking in "from" X.

When recording actual overtime at checkout:

```text
If actualCheckOutAt > expectedCheckOutAt:
    overtimeMinutes = actualCheckOutAt - expectedCheckOutAt (in minutes)
    overtimeAmount  = ceil(overtimeMinutes / 60) × hourly_overtime_rate
```

All datetime comparisons must account for timezone. Use ISO 8601 strings with explicit offsets (e.g., `+07:00`) or store all times in a consistent timezone. Do not mix naive datetimes with timezone-aware datetimes.

---

## 11. Public Data Projection

The public API should create a safe projection instead of returning raw spreadsheet rows.

Example public room:

```json
{
  "roomId": "R001",
  "locationId": "L001",
  "name": "Room 01",
  "description": "Private room",
  "capacity": 2,
  "imageUrl": "..."
}
```

Example public availability query (datetime-based):

```json
// GET /api/availability?roomId=ROOM-0001&checkIn=2026-08-28T14:00:00%2B07:00&checkOut=2026-08-28T16:00:00%2B07:00
{
  "roomId": "ROOM-0001",
  "checkIn": "2026-08-28T14:00:00+07:00",
  "checkOut": "2026-08-28T16:00:00+07:00",
  "available": true
}
```

The availability check must be calculated server-side by checking overlapping bookings with exact datetime comparison. Never trust client-side availability calculations.

Never return raw `Customers`, `Users`, or private booking fields from public endpoints.

---

## 12. IDs

Use application-generated stable IDs.

Recommended format:

```text
LOC-0001
ROOM-0001
BOOK-0001
CUS-0001
CLN-0001
USR-0001
```

IDs must never depend on spreadsheet row numbers because rows may be reordered or deleted.

---

## 13. Timestamps

Store timestamps in a consistent ISO-style format.

Example:

```text
2026-08-27T13:30:00+07:00
```

The application should use the homestay's configured timezone for business operations.

Do not mix local dates and UTC timestamps without a clear conversion rule.

---

## 14. Future Migration

Keep database-specific logic inside:

```text
lib/google-sheets/
```

The rest of the application should interact with typed repositories/services.

Future:

```text
GoogleSheetsRoomsRepository
        ↓
RoomsRepository interface
        ↓
PostgresRoomsRepository
```

This makes migration to PostgreSQL/Supabase easier.
