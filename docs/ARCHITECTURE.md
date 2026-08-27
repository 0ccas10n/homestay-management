# Homestay Management System — Architecture

## 1. Architecture Summary

The application is a **Vite + React + TypeScript frontend** with **Vercel Serverless Functions** acting as the backend/API layer.

Google Sheets is the initial persistence layer.

```text
                         INTERNET
                            |
             +--------------+--------------+
             |                             |
             v                             v
      Public Website                 Internal Web App
       React/Vite                    React/Vite
             |                             |
             +--------------+--------------+
                            |
                            v
                   Vercel API Functions
                            |
              +-------------+-------------+
              |                           |
              v                           v
        Authentication              Application Services
              |                           |
              +-------------+-------------+
                            |
                            v
                    Google Sheets Service
                            |
                            v
                    Google Sheets API
                            |
                            v
                  Private Google Sheet
```

---

## 2. Technology Stack

### Frontend

- Vite
- React
- TypeScript
- React Router
- CSS/Tailwind or the styling system already present in the project

Do not replace the existing Figma-generated frontend unless necessary.

### Backend

- Vercel Serverless Functions
- TypeScript
- Google Sheets API
- Server-side validation
- HTTP-only authentication/session mechanism

### Database

- Google Sheets for MVP.

### Hosting

- Vercel.

### Source Control

- GitHub.

---

## 3. Recommended Project Structure

```text
homestay-app/
|
├── public/
|
├── src/
|   ├── components/
|   |   ├── ui/
|   |   ├── layout/
|   |   ├── calendar/
|   |   └── room/
|   |
|   ├── pages/
|   |   ├── public/
|   |   |   ├── Home.tsx
|   |   |   ├── Rooms.tsx
|   |   |   ├── Availability.tsx
|   |   |   ├── Locations.tsx
|   |   |   └── Contact.tsx
|   |   |
|   |   └── admin/
|   |       ├── Login.tsx
|   |       ├── Dashboard.tsx
|   |       ├── Calendar.tsx
|   |       ├── Rooms.tsx
|   |       ├── Bookings.tsx
|   |       ├── Cleaning.tsx
|   |       └── Settings.tsx
|   |
|   ├── features/
|   |   ├── rooms/
|   |   ├── bookings/
|   |   ├── availability/
|   |   ├── cleaning/
|   |   └── auth/
|   |
|   ├── services/
|   |   ├── api.ts
|   |   ├── rooms.service.ts
|   |   ├── bookings.service.ts
|   |   ├── availability.service.ts
|   |   └── cleaning.service.ts
|   |
|   ├── hooks/
|   ├── types/
|   ├── utils/
|   ├── constants/
|   ├── App.tsx
|   ├── main.tsx
|   └── index.css
|
├── api/
|   ├── auth/
|   |   ├── login.ts
|   |   └── logout.ts
|   ├── rooms/
|   |   ├── index.ts
|   |   └── [id].ts
|   ├── bookings/
|   |   ├── index.ts
|   |   └── [id].ts
|   ├── availability.ts
|   ├── cleaning/
|   |   ├── index.ts
|   |   └── [id].ts
|   └── locations.ts
|
├── lib/
|   ├── google-sheets/
|   |   ├── client.ts
|   |   ├── rooms.repository.ts
|   |   ├── bookings.repository.ts
|   |   ├── cleaning.repository.ts
|   |   ├── locations.repository.ts
|   |   └── users.repository.ts
|   |
|   ├── auth/
|   |   ├── session.ts
|   |   ├── password.ts
|   |   └── authorization.ts
|   |
|   └── validation/
|
├── docs/
|   ├── PRODUCT.md
|   ├── ARCHITECTURE.md
|   ├── DATABASE.md
|   └── API.md
|
├── .env.local
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

The exact structure may be adapted to the existing project. Do not blindly move files if doing so would break the Figma-generated frontend.

---

## 4. Request Flow

### Public request

```text
Browser
  |
  | GET /api/availability
  v
Vercel Function
  |
  | Validate date/room parameters
  | Query only public fields
  v
Google Sheets Repository
  |
  v
Google Sheets API
  |
  v
Private Spreadsheet
```

The response is filtered before it reaches the browser.

### Internal request

```text
Browser
  |
  | GET /api/bookings
  | Cookie: session=...
  v
Vercel Function
  |
  | Authenticate
  | Authorize
  | Validate input
  v
Repository
  |
  v
Google Sheets API
```

---

## 5. Separation of Responsibilities

### React frontend

Responsible for:

- Rendering UI.
- Client-side navigation.
- Form interaction.
- Calling APIs.
- Displaying loading/error states.

It must NOT:

- Store Google private credentials.
- Call Google Sheets API directly.
- Decide whether a user is authorized.
- Return private database records to the user.

### API layer

Responsible for:

- Authentication.
- Authorization.
- Validation.
- Business rules.
- Public/private data filtering.
- Calling repositories.
- Consistent error responses.

### Repository layer

Responsible for:

- Reading/writing Google Sheets.
- Converting rows into typed objects.
- Mapping typed objects back to rows.

Business authorization logic should not be placed inside the repository.

---

## 6. Authentication

The internal app requires authentication.

The authentication design should use:

- Password hashes, never plaintext passwords.
- A signed session token or equivalent.
- HTTP-only cookie.
- Secure cookie in production.
- SameSite protection.
- Server-side authorization on every protected API.

Suggested roles:

```text
staff
admin
```

The client may hide UI controls based on role, but the server must enforce the permission.

---

## 7. Environment Variables

Example:

```text
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
SESSION_SECRET=
```

These values must only be available to server-side code.

Never prefix private secrets with `VITE_`.

Never commit `.env.local`.

Provide `.env.example` containing variable names but no real secrets.

---

## 8. Google Service Account

Recommended setup:

1. Create a Google Cloud project.
2. Enable Google Sheets API.
3. Create a service account.
4. Create a private Google Spreadsheet.
5. Share the spreadsheet with the service account email.
6. Give only the required spreadsheet permission.
7. Store credentials in Vercel Environment Variables.

The service account should not be exposed to the browser.

---

## 9. Data Access Abstraction

Frontend code should not know that Google Sheets is the database.

Use:

```text
API
 ↓
Service / Business Logic
 ↓
Repository Interface
 ↓
Google Sheets Repository
```

This allows future migration:

```text
Google Sheets Repository
          ↓
     PostgreSQL Repository
```

without rewriting the entire frontend.

---

## 10. Concurrency Limitation

Google Sheets is not a full relational database.

The MVP must assume:

- Small number of simultaneous staff users.
- Moderate data volume.
- Occasional concurrent updates.

For operations where duplicate/conflicting updates are possible, the application should re-read relevant data immediately before writing when practical.

If the system grows significantly, migrate the persistence layer to PostgreSQL/Supabase.

---

## 11. Error Handling

API responses should use predictable JSON:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date range"
  }
}
```

Do not return:

- Stack traces.
- Google credentials.
- Private spreadsheet errors containing sensitive information.
- Internal implementation details.

---

## 12. Logging

Log server-side operational errors.

Avoid logging:

- Passwords.
- Session tokens.
- Google private keys.
- Lockbox passwords.
- Full customer private data unless necessary.

---

## 13. Deployment

```text
Developer
   |
   v
GitHub
   |
   v
Vercel
   |
   +--> Static Vite frontend
   |
   +--> Serverless API functions
   |
   v
Google Sheets API
```

Production secrets are configured in Vercel.

---

## 14. Security Boundary

The most important boundary is:

```text
PUBLIC BROWSER
      |
      | Only approved public data
      v
VERCEL API
      |
      | Private credentials
      v
GOOGLE SHEETS
```

The browser must never receive direct access to the private spreadsheet.
