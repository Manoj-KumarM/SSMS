# Smart Student Management System - PRD

## Original Problem Statement
Smart Student Management System for an Engineering College with QR + Location attendance, student/teacher/subject management, marks, notes, announcements, feedback, and password reset. Enhanced with a comprehensive Exam and Marks Tracking module.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async)
- **Auth**: JWT Bearer (24hr access + 30d refresh tokens, localStorage)
- **Email**: Resend (needs API key, shows code_hint when unconfigured)
- **QR**: qrcode.react (frontend), qrcode lib (backend)
- **Location**: Browser Geolocation + Haversine (geopy), 50m radius
- **PDF**: reportlab for report card generation

## User Roles
- **Admin**: Full access - manage students, teachers, subjects, exams, announcements, feedback, attendance reports
- **Teacher**: Take attendance (QR), manage marks (manual + CSV upload), view class performance
- **Student**: Submit attendance, view marks, download report cards (PDF/CSV), view notes/announcements, submit feedback

## What's Implemented

### Iteration 1 (MVP) - 2026-03-30
- Full backend API, JWT auth with 3 roles, admin CRUD, QR attendance, marks, notes, announcements, feedback

### Iteration 2 (Fixes & Enhancements) - 2026-03-30
1. Session persistence - 24hr access tokens + refresh endpoint + auto-refresh interceptor
2. Token refresh on page reload
3. QR code instant generation
4. Location radius 50m with high accuracy
5. CSV download fixed (UTF-8-sig encoding)
6. Admin attendance reports with filters
7. Student max 3 attempts per session
8. Teacher manual attendance marking
9. Modify attendance with audit log
10. Announcement edit/delete
11. Forgot password code_hint when no email configured
12. Teacher attendance history page

### Iteration 3 (Exam & Marks Module) - 2026-04-01
- **Admin**: Full exam CRUD (create/read/update/delete), exam analytics (subject-wise stats, toppers, pass/fail rates), marks view, CSV download
- **Teacher**: View assigned exams, enter marks per exam/subject, bulk save, CSV upload with validation (rejects invalid rows with reasons), download CSV template, view class performance summary
- **Student**: View marks grouped by exam with percentages/grades, download PDF report card (dynamic with student info, subjects, totals), download CSV report card
- **Routing**: Added /admin/exams route, Exams & Marks nav link in admin sidebar
- **Validation**: Marks cannot exceed max, negative marks rejected, required fields enforced
- **Security**: Role-based access control on all endpoints
- **Error Handling**: Proper HTTP status codes (400, 403, 404), toast messages on frontend

## Key API Endpoints
- Auth: POST /api/auth/login, GET /api/auth/me, POST /api/auth/refresh
- Admin Exams: POST/GET/PUT/DELETE /api/admin/exams, GET /api/admin/exam-marks, GET /api/admin/exam-analytics, GET /api/admin/exam-marks/csv
- Teacher Marks: GET /api/teacher/exams, POST /api/teacher/exam-marks, POST /api/teacher/exam-marks/bulk, POST /api/teacher/exam-marks/csv-upload, GET /api/teacher/exam-marks/{exam_id}/{subject_id}, GET /api/teacher/exam-performance/{exam_id}
- Student Marks: GET /api/student/exam-marks, GET /api/student/report-card/pdf, GET /api/student/report-card/csv

### Documentation - 2026-04-01
- Comprehensive README.md with 8 sections: System Overview, Architecture, Messaging Config, Forgot Password, Local Setup, Env Variables, Project Structure, Summary
- Created .env.example files for both backend and frontend

## P0 Remaining
- Resend API key for live email delivery (forgot password + absent alerts)

## P1 Remaining
- File upload for notes (currently URL-based)
- Student profile read-only page
- Change Password UI page

## P2 Enhancements
- WebSocket real-time attendance counter
- Dashboard charts/performance trends
- Mobile-optimized QR scanner
