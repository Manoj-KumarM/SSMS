# Smart Student Management System

A full-stack web application for engineering colleges that provides **QR + Location-based attendance**, **exam & marks tracking**, **announcements**, **notes sharing**, **feedback**, and **password reset** — all behind a role-based access system for **Admin**, **Teacher**, and **Student** users.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture)
3. [Real-Time Messaging Configuration](#3-real-time-messaging-configuration)
4. [Forgot Password System](#4-forgot-password-system)
5. [Local Development Setup](#5-local-development-setup)
6. [Environment Variables](#6-environment-variables)
7. [Project Structure](#7-project-structure)
8. [Summary](#8-summary)

---

## 1. System Overview

### Purpose

This system digitises daily college operations — attendance, exam management, result publishing, and communication — into a single web portal accessible to admins, teachers, and students.

### Key Features

| Feature | Admin | Teacher | Student |
|---|:---:|:---:|:---:|
| QR + Location Attendance (Haversine, 50 m radius) | View reports | Generate QR / Manual mark | Scan QR to submit |
| Exam Management (CRUD) | Create / Edit / Delete | View assigned exams | — |
| Marks Entry (manual + CSV bulk upload) | View all marks | Enter & edit marks | View own marks |
| Performance Analytics (pass/fail, toppers) | Full analytics | Class performance | — |
| Report Card Download (PDF & CSV) | CSV export | — | PDF & CSV download |
| Announcements (branch/semester/section) | Create / Edit / Delete | — | View |
| Notes Sharing | — | Upload notes | View & download |
| Feedback Forms | Create forms, view responses | — | Submit feedback |
| Password Reset (email or code hint) | Yes | Yes | Yes |

### Workflow

```
User (Browser)
  │
  ├──▶  Login  ──▶  JWT access token (24 h) + refresh token (30 d) stored in localStorage
  │
  ├──▶  Role-based dashboard rendered by React Router
  │         Admin  ──▶  /admin/*
  │         Teacher ──▶  /teacher/*
  │         Student ──▶  /student/*
  │
  ├──▶  Every API call includes  Authorization: Bearer <token>
  │
  ├──▶  On 401 ──▶  Axios interceptor auto-refreshes token via /api/auth/refresh
  │
  └──▶  Backend (FastAPI) validates token, checks role, queries MongoDB, returns JSON
```

---

## 2. System Architecture

### High-Level Diagram

```
┌────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                    │
│                                                            │
│   React 19  +  Tailwind CSS  +  Shadcn/UI  +  Axios       │
│   Geolocation API  ·  html5-qrcode  ·  qrcode.react       │
│                                                            │
│   Port 3000 (dev)                                          │
└──────────────────────────┬─────────────────────────────────┘
                           │  HTTPS  (all paths prefixed /api)
                           ▼
┌────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + Uvicorn)              │
│                                                            │
│   JWT Auth  ·  Role guards  ·  Haversine distance calc     │
│   QR generation  ·  CSV parsing  ·  PDF generation         │
│   Resend email integration (optional)                      │
│                                                            │
│   Port 8001 (internal)                                     │
└──────────────────────────┬─────────────────────────────────┘
                           │  mongodb:// driver (Motor async)
                           ▼
┌────────────────────────────────────────────────────────────┐
│                    DATABASE (MongoDB)                       │
│                                                            │
│   Collections:                                             │
│     users · students · teachers · subjects                 │
│     teacher_subjects · attendance_sessions                 │
│     attendance_submissions · attendance_records             │
│     exams · exam_marks · marks · notes                     │
│     announcements · feedback_forms · feedback_responses     │
│     password_reset_codes                                   │
│                                                            │
│   Port 27017 (default)                                     │
└────────────────────────────────────────────────────────────┘
                           │
              (optional)   ▼
┌────────────────────────────────────────────────────────────┐
│               EMAIL SERVICE (Resend API)                   │
│                                                            │
│   Password reset codes  ·  Absence alerts to parents       │
│   Only active when RESEND_API_KEY is configured             │
└────────────────────────────────────────────────────────────┘
```

### Component Communication

| From | To | Protocol | Purpose |
|---|---|---|---|
| React frontend | FastAPI backend | HTTPS REST (`/api/*`) | All CRUD operations, auth, file uploads |
| FastAPI backend | MongoDB | TCP (Motor async driver) | Persistent data storage |
| FastAPI backend | Resend API | HTTPS | Send password reset emails & absence alerts |
| Browser | Browser Geolocation API | JS API | Get student/teacher lat/lng for attendance |
| FastAPI backend | Internal (geopy) | In-process | Haversine distance calculation |
| FastAPI backend | Internal (reportlab) | In-process | PDF report card generation |
| FastAPI backend | Internal (qrcode) | In-process | QR code image generation |

### Authentication System

1. **Login** — `POST /api/auth/login` validates credentials (bcrypt), returns `access_token` (JWT, 24 h) + `refresh_token` (JWT, 30 d).
2. **Storage** — Tokens are stored in `localStorage` on the client.
3. **Request interceptor** — Every Axios request attaches `Authorization: Bearer <access_token>`.
4. **Response interceptor** — On `401`, the client automatically calls `POST /api/auth/refresh` with the refresh token. If refresh succeeds, the original request is retried transparently.
5. **Role guard** — Backend uses a `require_role(['admin'])` dependency to restrict endpoints. Frontend uses `<ProtectedRoute allowedRoles={['admin']}>` to gate routes.

---

## 3. Real-Time Messaging Configuration

The system uses **Resend** (https://resend.com) as its email delivery service. SMS is not yet integrated but can be added via Twilio or a similar provider.

### 3.1 Email Notifications

Currently, the system sends emails for:

- **Password reset codes** — When a user requests a password reset.
- **Absence alerts to parents** — When an attendance session is closed, absent students' parents receive an email.

#### How it works

```python
# In server.py
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY
    # Emails are sent via: resend.Emails.send({...})
else:
    # Fallback: reset code is returned in the API response as code_hint
    # No email is sent
```

#### Configuring Email (Resend)

1. Sign up at [https://resend.com](https://resend.com).
2. Create an API key from the Resend dashboard.
3. (Optional) Verify your own domain for custom sender addresses.
4. Set the following in `backend/.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
SENDER_EMAIL=noreply@yourdomain.com
```

If `RESEND_API_KEY` is left empty, the system runs in **fallback mode**: password reset codes are shown directly on the UI and absence alerts are logged to the console but not emailed.

### 3.2 SMS Notifications (Future)

SMS to parent phone numbers is not yet integrated. To add it:

1. Choose a provider (e.g. Twilio, MessageBird).
2. Add the provider's API key to `backend/.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_PHONE_NUMBER=+1234567890
   ```
3. Install the SDK (`pip install twilio`).
4. Add a send function in `server.py` and call it alongside the email notification in the `close_session` endpoint.

---

## 4. Forgot Password System

### Flow

```
1. User clicks "Forgot Password" on the login page
          │
          ▼
2. User enters their email address
          │
          ▼
3. POST /api/auth/forgot-password
   ├── Generates a random 8-character uppercase code
   ├── Stores it in the  password_reset_codes  collection (expires in 10 min)
   ├── If RESEND_API_KEY is set:
   │      Sends the code to the user's email via Resend
   │      Frontend shows: "Reset code sent to your email"
   └── If RESEND_API_KEY is empty:
          Returns the code in the  code_hint  field of the response
          Frontend shows: "Reset code: XXXXXXXX (Email not configured)"
          │
          ▼
4. User enters the code + new password
          │
          ▼
5. POST /api/auth/reset-password
   ├── Validates the code (exists, not used, not expired)
   ├── Hashes the new password with bcrypt
   ├── Updates the user's  password_hash  in MongoDB
   └── Marks the code as  used: true
          │
          ▼
6. User is redirected to the login page
```

### Enabling Real Email Delivery

Set `RESEND_API_KEY` and `SENDER_EMAIL` in `backend/.env` as described in [Section 3.1](#31-email-notifications-resend). Once configured, the `code_hint` field is no longer returned and the code is sent exclusively via email.

---

## 5. Local Development Setup

### Prerequisites

| Software | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Frontend runtime |
| **Yarn** | 1.22+ | Frontend package manager |
| **Python** | 3.11+ | Backend runtime |
| **MongoDB** | 6.0+ | Database |
| **pip** | 23+ | Python package manager |

### Step-by-Step

```bash
# 1. Clone the repository
git clone <repo-url>
cd <repo-name>

# 2. Set up the backend
cd backend

# Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install Python dependencies
pip install -r requirements.txt

# Create backend .env (see Section 6 for all variables)
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, etc.

# 3. Start MongoDB (if not already running)
# macOS:  brew services start mongodb-community
# Linux:  sudo systemctl start mongod
# Docker: docker run -d -p 27017:27017 --name mongo mongo:6

# 4. Start the backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# The admin account is auto-created on first startup
# Default: admin@college.edu / admin123

# 5. Set up the frontend (new terminal)
cd ../frontend

# Install Node dependencies
yarn install

# Create frontend .env
cp .env.example .env
# Set REACT_APP_BACKEND_URL=http://localhost:8001

# 6. Start the frontend
yarn start
# Opens at http://localhost:3000
```

### First Login

Navigate to `http://localhost:3000`. Log in with the admin credentials configured in `backend/.env`:

- **Email**: `admin@college.edu`
- **Password**: `admin123`

From the admin dashboard you can then create teachers, students, subjects, and exams.

---

## 6. Environment Variables

### Backend (`backend/.env`)

```env
# ─── Database ───────────────────────────────────────────
MONGO_URL=mongodb://localhost:27017
DB_NAME=college_management

# ─── Authentication ─────────────────────────────────────
JWT_SECRET=change-this-to-a-long-random-string
ADMIN_EMAIL=admin@college.edu
ADMIN_PASSWORD=admin123

# ─── Email Service (Resend) ─────────────────────────────
# Leave RESEND_API_KEY empty to run without email (codes shown on screen)
RESEND_API_KEY=
SENDER_EMAIL=onboarding@resend.dev

# ─── CORS ───────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env`)

```env
# ─── Backend URL ────────────────────────────────────────
# For local dev, point to where uvicorn is running
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Variable Reference

| Variable | Required | Where | Description |
|---|:---:|---|---|
| `MONGO_URL` | Yes | Backend | MongoDB connection string |
| `DB_NAME` | Yes | Backend | Database name |
| `JWT_SECRET` | Yes | Backend | Secret key for signing JWTs — must be a long random string in production |
| `ADMIN_EMAIL` | Yes | Backend | Default admin account email (created on first startup) |
| `ADMIN_PASSWORD` | Yes | Backend | Default admin account password |
| `RESEND_API_KEY` | No | Backend | Resend API key — leave empty to disable email and show codes on screen |
| `SENDER_EMAIL` | No | Backend | "From" address for outgoing emails |
| `CORS_ORIGINS` | No | Backend | Comma-separated allowed origins (default `*`) |
| `REACT_APP_BACKEND_URL` | Yes | Frontend | Full URL of the backend (e.g. `http://localhost:8001`) |

---

## 7. Project Structure

```
/
├── backend/
│   ├── .env                        # Backend environment variables
│   ├── requirements.txt            # Python dependencies
│   ├── server.py                   # FastAPI app — all routes, models, startup logic
│   └── tests/
│       └── test_exam_marks.py      # Pytest tests for exam/marks endpoints
│
├── frontend/
│   ├── .env                        # Frontend environment variables
│   ├── package.json                # Node dependencies (use yarn)
│   ├── tailwind.config.js          # Tailwind CSS configuration
│   ├── craco.config.js             # CRA overrides (path aliases)
│   ├── public/                     # Static assets
│   └── src/
│       ├── App.js                  # React Router — all route definitions
│       ├── index.js                # Entry point
│       ├── index.css               # Global styles (Tailwind directives)
│       │
│       ├── contexts/
│       │   └── AuthContext.js      # Auth state, login/logout, Axios interceptors
│       │
│       ├── components/
│       │   ├── ProtectedRoute.js   # Role-gated route wrapper
│       │   └── ui/                 # Shadcn/UI components (button, input, dialog, select, etc.)
│       │
│       ├── pages/
│       │   ├── Login.js            # Login page
│       │   ├── ForgotPassword.js   # Forgot password flow (2-step: send code → reset)
│       │   │
│       │   ├── admin/
│       │   │   ├── AdminLayout.js      # Sidebar + Outlet for admin pages
│       │   │   ├── AdminDashboard.js   # Admin home
│       │   │   ├── Students.js         # CRUD students
│       │   │   ├── Teachers.js         # CRUD teachers
│       │   │   ├── Subjects.js         # CRUD subjects + assign to teachers
│       │   │   ├── AdminExams.js       # Exam CRUD + analytics + marks view
│       │   │   ├── AdminAttendance.js  # Attendance reports with filters
│       │   │   ├── Announcements.js    # CRUD announcements
│       │   │   └── Feedback.js         # View feedback forms & responses
│       │   │
│       │   ├── teacher/
│       │   │   ├── TeacherLayout.js    # Sidebar + Outlet for teacher pages
│       │   │   ├── TeacherDashboard.js # Teacher home
│       │   │   ├── TakeAttendance.js   # Generate QR + live session management
│       │   │   ├── AttendanceHistory.js# Past sessions with modify capability
│       │   │   ├── ManageMarks.js      # Enter marks (manual + CSV upload)
│       │   │   └── ManageNotes.js      # Upload notes for subjects
│       │   │
│       │   └── student/
│       │       ├── StudentLayout.js      # Sidebar + Outlet for student pages
│       │       ├── StudentDashboard.js   # Student home
│       │       ├── SubmitAttendance.js   # Scan QR + geolocation submission
│       │       ├── ViewMarks.js          # View marks + download PDF/CSV report
│       │       ├── ViewNotes.js          # View & download notes
│       │       ├── StudentAnnouncements.js # View announcements
│       │       └── SubmitFeedback.js     # Submit feedback responses
│       │
│       ├── hooks/
│       │   └── use-toast.js        # Toast hook
│       ├── lib/
│       │   └── utils.js            # cn() utility for className merging
│       └── utils/
│           └── apiError.js         # API error formatting helper
│
└── memory/
    ├── PRD.md                      # Product requirements document
    └── test_credentials.md         # Test account credentials
```

### Key Files Explained

| File | Role |
|---|---|
| `backend/server.py` | Single-file FastAPI application containing all route handlers, Pydantic models, database operations, authentication logic, QR generation, PDF generation, and CSV parsing. |
| `frontend/src/contexts/AuthContext.js` | Creates the Axios instance with automatic token attachment (request interceptor) and token refresh on 401 (response interceptor). Exports the `api` object used by all pages. |
| `frontend/src/components/ProtectedRoute.js` | Checks `user` from `AuthContext`. Redirects to `/login` if unauthenticated or if the user's role is not in `allowedRoles`. |
| `frontend/src/App.js` | Defines all React Router routes grouped under `/admin`, `/teacher`, and `/student` with nested layouts and protected route wrappers. |

---

## 8. Summary

The Smart Student Management System is a **React + FastAPI + MongoDB** application built for engineering colleges. It combines:

- **QR + Geolocation Attendance** — Teachers generate a QR code tied to their GPS coordinates. Students scan it within 50 metres to mark attendance. The Haversine formula validates proximity server-side.

- **Exam & Marks Management** — Admins create exams scoped to branch/semester/section. Teachers enter marks manually or via CSV upload (with row-level validation). Students view their marks grouped by exam with automatic grade calculation and can download dynamic PDF or CSV report cards.

- **Role-Based Security** — Every API endpoint is protected by JWT authentication and role checks (`admin`, `teacher`, `student`). The frontend mirrors this with guarded routes, and the Axios interceptor transparently handles token refresh so users stay logged in.

- **Communication** — Announcements target specific classes. Feedback forms allow students to rate events. When configured, Resend sends password reset codes and absence alerts to parent emails.

All data is persisted in MongoDB. The system runs without any external services (email is optional) and can be deployed locally with just Node.js, Python, and MongoDB.

---

### Default Test Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@college.edu` | `admin123` |
| Teacher | `john@college.edu` | `teacher123` |
| Student | `alice@college.edu` | `student123` |

> **Note**: The admin account is automatically created on first backend startup. Teacher and student accounts must be created by an admin through the dashboard (default passwords are `teacher123` and `student123` respectively).
