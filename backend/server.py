from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
import secrets
import qrcode
from io import BytesIO, StringIO
import base64
from geopy.distance import geodesic
import resend
import asyncio
import csv
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-change-in-production')
JWT_ALGORITHM = 'HS256'
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@college.edu')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@smartcampusportal.online')

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Password helpers
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# JWT helpers - Increased access token to 24 hours for better session persistence
def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=24),
        'type': 'access'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=30),
        'type': 'refresh'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Auth dependency
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get('access_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'access':
            raise HTTPException(status_code=401, detail='Invalid token type')
        user = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        user.pop('password_hash', None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

# Role check
def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get('role') not in allowed_roles:
            raise HTTPException(status_code=403, detail='Access forbidden')
        return current_user
    return role_checker

# ============== MODELS ==============
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    code: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class StudentCreate(BaseModel):
    name: str
    usn: str
    branch: str
    semester: int
    section: str
    email: EmailStr
    phone: str
    parent_phone: str
    parent_email: EmailStr

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    phone: Optional[str] = None
    parent_phone: Optional[str] = None
    parent_email: Optional[EmailStr] = None

class TeacherCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str

class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class SubjectCreate(BaseModel):
    subject_name: str
    subject_code: str
    branch: str
    semester: int
    section: str

class SubjectUpdate(BaseModel):
    subject_name: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None

class AssignSubjectRequest(BaseModel):
    teacher_id: str
    subject_id: str

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    branch: str
    semester: int
    section: str

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None

class FeedbackFormCreate(BaseModel):
    event_name: str
    questions: List[str]

class FeedbackResponseCreate(BaseModel):
    form_id: str
    rating: int = Field(ge=1, le=5)
    comments: Optional[str] = None

class AttendanceSessionCreate(BaseModel):
    subject_id: str
    branch: str
    semester: int
    section: str
    teacher_latitude: float
    teacher_longitude: float

class AttendanceSubmit(BaseModel):
    session_code: str
    student_latitude: float
    student_longitude: float

class AttendanceModify(BaseModel):
    student_id: str
    status: str

class MarksUpload(BaseModel):
    subject_id: str
    exam_name: str
    student_usn: str
    marks: float

class NotesUpload(BaseModel):
    subject_id: str
    title: str
    file_url: str

# ============== EXAM & MARKS MODELS ==============
class ExamCreate(BaseModel):
    exam_name: str
    exam_type: str  # Midterm, Final, Unit Test, Quiz, Assignment
    date: str
    branch: str
    semester: int
    section: str
    subject_ids: List[str]
    max_marks: float = 100

class ExamUpdate(BaseModel):
    exam_name: Optional[str] = None
    exam_type: Optional[str] = None
    date: Optional[str] = None
    max_marks: Optional[float] = None

class ExamMarksEntry(BaseModel):
    exam_id: str
    subject_id: str
    student_id: str
    marks_obtained: float
    remarks: Optional[str] = None

class BulkMarksEntry(BaseModel):
    exam_id: str
    subject_id: str
    entries: List[dict]  # [{student_id, marks_obtained, remarks}]

# Grading helper
def calculate_grade(percentage: float) -> str:
    if percentage >= 90: return 'O'
    if percentage >= 80: return 'A+'
    if percentage >= 70: return 'A'
    if percentage >= 60: return 'B+'
    if percentage >= 50: return 'B'
    if percentage >= 40: return 'C'
    return 'F'

def get_grade_label(grade: str) -> str:
    labels = {'O': 'Outstanding', 'A+': 'Excellent', 'A': 'Very Good', 'B+': 'Good', 'B': 'Above Average', 'C': 'Average', 'F': 'Fail'}
    return labels.get(grade, '')

# ============== AUTH ENDPOINTS ==============
@api_router.post('/auth/login')
async def login(request: LoginRequest):
    email = request.email.lower()
    user = await db.users.find_one({'email': email}, {'_id': 0})
    if not user or not verify_password(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid email or password')
    
    user.pop('password_hash', None)
    access_token = create_access_token(user['id'], user['email'], user['role'])
    refresh_token = create_refresh_token(user['id'])
    
    return {'user': user, 'access_token': access_token, 'refresh_token': refresh_token, 'message': 'Login successful'}

@api_router.post('/auth/refresh')
async def refresh_token(request: RefreshTokenRequest):
    try:
        payload = jwt.decode(request.refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'refresh':
            raise HTTPException(status_code=401, detail='Invalid token type')
        user = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        
        access_token = create_access_token(user['id'], user['email'], user['role'])
        new_refresh = create_refresh_token(user['id'])
        user.pop('password_hash', None)
        return {'access_token': access_token, 'refresh_token': new_refresh, 'user': user}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Refresh token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid refresh token')

@api_router.post('/auth/logout')
async def logout(current_user: dict = Depends(get_current_user)):
    return {'message': 'Logged out successfully'}

@api_router.get('/auth/me')
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post('/auth/forgot-password')
async def forgot_password(request: ForgotPasswordRequest):
    email = request.email.lower()
    user = await db.users.find_one({'email': email}, {'_id': 0})
    if not user:
        return {'message': 'If the email exists, a reset code has been sent'}
    
    code = secrets.token_urlsafe(32)[:8].upper()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.password_reset_codes.insert_one({
        'id': str(uuid.uuid4()),
        'user_id': user['id'],
        'email': email,
        'code': code,
        'expires_at': expires_at.isoformat(),
        'used': False
    })
    
    if RESEND_API_KEY:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000;">
            <h2 style="color: #000; text-align: center;">Password Reset Code</h2>
            <p style="font-size: 16px; color: #000;">Your password reset code is:</p>
            <p style="font-size: 32px; font-weight: bold; text-align: center; color: #002FA7; letter-spacing: 4px;">{code}</p>
            <p style="font-size: 14px; color: #52525B;">This code will expire in 10 minutes.</p>
        </div>
        """
        try:
            await asyncio.to_thread(resend.Emails.send, {
                'from': SENDER_EMAIL,
                'to': [email],
                'subject': 'Password Reset Code - College Management System',
                'html': html_content
            })
            logger.info(f'Password reset email sent to {email}')
        except Exception as e:
            logger.error(f'Failed to send email: {str(e)}')
            logger.info(f'Password reset code for {email}: {code}')
    else:
        logger.info(f'[NO EMAIL CONFIGURED] Password reset code for {email}: {code}')
    
    return {'message': 'If the email exists, a reset code has been sent', 'code_hint': code if not RESEND_API_KEY else None}

@api_router.post('/auth/reset-password')
async def reset_password(request: ResetPasswordRequest):
    reset_doc = await db.password_reset_codes.find_one({'code': request.code, 'used': False}, {'_id': 0})
    if not reset_doc:
        raise HTTPException(status_code=400, detail='Invalid or expired code')
    
    expires_at = datetime.fromisoformat(reset_doc['expires_at'])
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail='Code has expired')
    
    new_hash = hash_password(request.new_password)
    await db.users.update_one({'id': reset_doc['user_id']}, {'$set': {'password_hash': new_hash}})
    await db.password_reset_codes.update_one({'code': request.code}, {'$set': {'used': True}})
    
    return {'message': 'Password reset successfully'}

@api_router.post('/auth/change-password')
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({'id': current_user['id']}, {'_id': 0})
    if not verify_password(request.current_password, user['password_hash']):
        raise HTTPException(status_code=400, detail='Current password is incorrect')
    
    new_hash = hash_password(request.new_password)
    await db.users.update_one({'id': current_user['id']}, {'$set': {'password_hash': new_hash}})
    
    return {'message': 'Password changed successfully'}

# ============== ADMIN - STUDENT MANAGEMENT ==============
@api_router.post('/admin/students')
async def create_student(student: StudentCreate, current_user: dict = Depends(require_role(['admin']))):
    existing = await db.students.find_one({'usn': student.usn}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Student with this USN already exists')
    
    user_id = str(uuid.uuid4())
    student_id = str(uuid.uuid4())
    default_password = 'student123'
    
    user_doc = {
        'id': user_id,
        'email': student.email.lower(),
        'password_hash': hash_password(default_password),
        'name': student.name,
        'role': 'student',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    student_doc = {
        'id': student_id,
        'user_id': user_id,
        'usn': student.usn,
        'branch': student.branch,
        'semester': student.semester,
        'section': student.section,
        'phone': student.phone,
        'parent_phone': student.parent_phone,
        'parent_email': student.parent_email.lower(),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.students.insert_one(student_doc)
    
    student_doc.pop('_id', None)
    student_doc['name'] = student.name
    student_doc['email'] = student.email
    return {'student': student_doc, 'message': 'Student created successfully'}

@api_router.get('/admin/students')
async def get_students(current_user: dict = Depends(require_role(['admin']))):
    students = await db.students.find({}, {'_id': 0}).to_list(1000)
    for student in students:
        user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1, 'email': 1})
        if user:
            student['name'] = user['name']
            student['email'] = user['email']
    return students

@api_router.put('/admin/students/{student_id}')
async def update_student(student_id: str, update: StudentUpdate, current_user: dict = Depends(require_role(['admin']))):
    student = await db.students.find_one({'id': student_id}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student not found')
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if 'name' in update_data:
        await db.users.update_one({'id': student['user_id']}, {'$set': {'name': update_data.pop('name')}})
    if update_data:
        await db.students.update_one({'id': student_id}, {'$set': update_data})
    
    return {'message': 'Student updated successfully'}

@api_router.delete('/admin/students/{student_id}')
async def delete_student(student_id: str, current_user: dict = Depends(require_role(['admin']))):
    student = await db.students.find_one({'id': student_id}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student not found')
    
    await db.students.delete_one({'id': student_id})
    await db.users.delete_one({'id': student['user_id']})
    
    return {'message': 'Student deleted successfully'}

# ============== ADMIN - TEACHER MANAGEMENT ==============
@api_router.post('/admin/teachers')
async def create_teacher(teacher: TeacherCreate, current_user: dict = Depends(require_role(['admin']))):
    existing = await db.users.find_one({'email': teacher.email.lower()}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='User with this email already exists')
    
    user_id = str(uuid.uuid4())
    teacher_id = str(uuid.uuid4())
    default_password = 'teacher123'
    
    user_doc = {
        'id': user_id,
        'email': teacher.email.lower(),
        'password_hash': hash_password(default_password),
        'name': teacher.name,
        'role': 'teacher',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    teacher_doc = {
        'id': teacher_id,
        'user_id': user_id,
        'phone': teacher.phone,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.teachers.insert_one(teacher_doc)
    
    teacher_doc.pop('_id', None)
    teacher_doc['name'] = teacher.name
    teacher_doc['email'] = teacher.email
    return {'teacher': teacher_doc, 'message': 'Teacher created successfully'}

@api_router.get('/admin/teachers')
async def get_teachers(current_user: dict = Depends(require_role(['admin']))):
    teachers = await db.teachers.find({}, {'_id': 0}).to_list(1000)
    for teacher in teachers:
        user = await db.users.find_one({'id': teacher['user_id']}, {'_id': 0, 'name': 1, 'email': 1})
        if user:
            teacher['name'] = user['name']
            teacher['email'] = user['email']
    return teachers

@api_router.put('/admin/teachers/{teacher_id}')
async def update_teacher(teacher_id: str, update: TeacherUpdate, current_user: dict = Depends(require_role(['admin']))):
    teacher = await db.teachers.find_one({'id': teacher_id}, {'_id': 0})
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher not found')
    
    if update.phone:
        await db.teachers.update_one({'id': teacher_id}, {'$set': {'phone': update.phone}})
    if update.name:
        await db.users.update_one({'id': teacher['user_id']}, {'$set': {'name': update.name}})
    
    return {'message': 'Teacher updated successfully'}

@api_router.delete('/admin/teachers/{teacher_id}')
async def delete_teacher(teacher_id: str, current_user: dict = Depends(require_role(['admin']))):
    teacher = await db.teachers.find_one({'id': teacher_id}, {'_id': 0})
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher not found')
    
    await db.teachers.delete_one({'id': teacher_id})
    await db.users.delete_one({'id': teacher['user_id']})
    await db.teacher_subjects.delete_many({'teacher_id': teacher_id})
    
    return {'message': 'Teacher deleted successfully'}

# ============== ADMIN - SUBJECT MANAGEMENT ==============
@api_router.post('/admin/subjects')
async def create_subject(subject: SubjectCreate, current_user: dict = Depends(require_role(['admin']))):
    subject_id = str(uuid.uuid4())
    subject_doc = {
        'id': subject_id,
        'subject_name': subject.subject_name,
        'subject_code': subject.subject_code,
        'branch': subject.branch,
        'semester': subject.semester,
        'section': subject.section,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.subjects.insert_one(subject_doc)
    subject_doc.pop('_id', None)
    return {'subject': subject_doc, 'message': 'Subject created successfully'}

@api_router.get('/admin/subjects')
async def get_subjects(current_user: dict = Depends(require_role(['admin']))):
    return await db.subjects.find({}, {'_id': 0}).to_list(1000)

@api_router.put('/admin/subjects/{subject_id}')
async def update_subject(subject_id: str, update: SubjectUpdate, current_user: dict = Depends(require_role(['admin']))):
    subject = await db.subjects.find_one({'id': subject_id}, {'_id': 0})
    if not subject:
        raise HTTPException(status_code=404, detail='Subject not found')
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.subjects.update_one({'id': subject_id}, {'$set': update_data})
    return {'message': 'Subject updated successfully'}

@api_router.delete('/admin/subjects/{subject_id}')
async def delete_subject(subject_id: str, current_user: dict = Depends(require_role(['admin']))):
    await db.subjects.delete_one({'id': subject_id})
    await db.teacher_subjects.delete_many({'subject_id': subject_id})
    return {'message': 'Subject deleted successfully'}

# ============== ADMIN - ASSIGN SUBJECTS ==============
@api_router.post('/admin/assign-subject')
async def assign_subject(request: AssignSubjectRequest, current_user: dict = Depends(require_role(['admin']))):
    existing = await db.teacher_subjects.find_one({
        'teacher_id': request.teacher_id, 'subject_id': request.subject_id
    }, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Subject already assigned to this teacher')
    
    assignment_doc = {
        'id': str(uuid.uuid4()),
        'teacher_id': request.teacher_id,
        'subject_id': request.subject_id,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.teacher_subjects.insert_one(assignment_doc)
    return {'message': 'Subject assigned successfully'}

@api_router.get('/admin/teacher-subjects/{teacher_id}')
async def get_teacher_subjects(teacher_id: str, current_user: dict = Depends(require_role(['admin']))):
    assignments = await db.teacher_subjects.find({'teacher_id': teacher_id}, {'_id': 0}).to_list(1000)
    for a in assignments:
        subject = await db.subjects.find_one({'id': a['subject_id']}, {'_id': 0})
        if subject:
            a['subject'] = subject
    return assignments

@api_router.delete('/admin/unassign-subject/{assignment_id}')
async def unassign_subject(assignment_id: str, current_user: dict = Depends(require_role(['admin']))):
    result = await db.teacher_subjects.delete_one({'id': assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Assignment not found')
    return {'message': 'Subject unassigned successfully'}

# ============== ADMIN - ANNOUNCEMENTS (with Edit/Delete) ==============
@api_router.post('/admin/announcements')
async def create_announcement(announcement: AnnouncementCreate, current_user: dict = Depends(require_role(['admin']))):
    announcement_doc = {
        'id': str(uuid.uuid4()),
        'title': announcement.title,
        'message': announcement.message,
        'branch': announcement.branch,
        'semester': announcement.semester,
        'section': announcement.section,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.announcements.insert_one(announcement_doc)
    announcement_doc.pop('_id', None)
    return {'announcement': announcement_doc, 'message': 'Announcement created successfully'}

@api_router.get('/admin/announcements')
async def get_all_announcements(current_user: dict = Depends(require_role(['admin']))):
    return await db.announcements.find({}, {'_id': 0}).sort('created_at', -1).to_list(1000)

@api_router.put('/admin/announcements/{announcement_id}')
async def update_announcement(announcement_id: str, update: AnnouncementUpdate, current_user: dict = Depends(require_role(['admin']))):
    existing = await db.announcements.find_one({'id': announcement_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail='Announcement not found')
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.announcements.update_one({'id': announcement_id}, {'$set': update_data})
    return {'message': 'Announcement updated successfully'}

@api_router.delete('/admin/announcements/{announcement_id}')
async def delete_announcement(announcement_id: str, current_user: dict = Depends(require_role(['admin']))):
    result = await db.announcements.delete_one({'id': announcement_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Announcement not found')
    return {'message': 'Announcement deleted successfully'}

# ============== ADMIN - FEEDBACK FORMS ==============
@api_router.post('/admin/feedback-forms')
async def create_feedback_form(form: FeedbackFormCreate, current_user: dict = Depends(require_role(['admin']))):
    form_doc = {
        'id': str(uuid.uuid4()),
        'event_name': form.event_name,
        'questions': form.questions,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.feedback_forms.insert_one(form_doc)
    form_doc.pop('_id', None)
    return {'form': form_doc, 'message': 'Feedback form created successfully'}

@api_router.get('/admin/feedback-forms')
async def get_feedback_forms(current_user: dict = Depends(require_role(['admin']))):
    return await db.feedback_forms.find({}, {'_id': 0}).to_list(1000)

@api_router.get('/admin/feedback-responses/{form_id}')
async def get_feedback_responses(form_id: str, current_user: dict = Depends(require_role(['admin']))):
    responses = await db.feedback_responses.find({'form_id': form_id}, {'_id': 0}).to_list(1000)
    for r in responses:
        student = await db.students.find_one({'id': r['student_id']}, {'_id': 0})
        if student:
            user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
            if user:
                r['student_name'] = user['name']
                r['usn'] = student['usn']
    return responses

# ============== ADMIN - ATTENDANCE VIEW ==============
@api_router.get('/admin/attendance/records')
async def admin_get_attendance_records(
    branch: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['admin']))
):
    query = {}
    if subject_id:
        query['subject_id'] = subject_id
    if student_id:
        query['student_id'] = student_id
    if date:
        query['date'] = {'$regex': f'^{date}'}
    
    records = await db.attendance_records.find(query, {'_id': 0}).sort('date', -1).to_list(5000)
    
    for record in records:
        student = await db.students.find_one({'id': record['student_id']}, {'_id': 0})
        if student:
            if branch and student.get('branch') != branch:
                records.remove(record)
                continue
            if semester and student.get('semester') != semester:
                records.remove(record)
                continue
            if section and student.get('section') != section:
                records.remove(record)
                continue
            user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
            record['student_name'] = user['name'] if user else '-'
            record['usn'] = student['usn']
            record['branch'] = student['branch']
            record['semester'] = student['semester']
            record['section'] = student['section']
        subject = await db.subjects.find_one({'id': record.get('subject_id')}, {'_id': 0})
        if subject:
            record['subject_name'] = subject['subject_name']
            record['subject_code'] = subject['subject_code']
    
    return records

@api_router.get('/admin/attendance/stats')
async def admin_get_attendance_stats(
    branch: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['admin']))
):
    student_query = {}
    if branch:
        student_query['branch'] = branch
    if semester:
        student_query['semester'] = semester
    if section:
        student_query['section'] = section
    
    students = await db.students.find(student_query, {'_id': 0}).to_list(5000)
    
    stats = []
    for student in students:
        user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
        total = await db.attendance_records.count_documents({'student_id': student['id']})
        present = await db.attendance_records.count_documents({'student_id': student['id'], 'status': 'Present'})
        absent = await db.attendance_records.count_documents({'student_id': student['id'], 'status': 'Absent'})
        percentage = round((present / total * 100), 2) if total > 0 else 0
        
        stats.append({
            'student_id': student['id'],
            'name': user['name'] if user else '-',
            'usn': student['usn'],
            'branch': student['branch'],
            'semester': student['semester'],
            'section': student['section'],
            'total': total,
            'present': present,
            'absent': absent,
            'percentage': percentage
        })
    
    return stats

# ============== TEACHER - SUBJECTS ==============
@api_router.get('/teacher/subjects')
async def get_my_subjects(current_user: dict = Depends(require_role(['teacher']))):
    teacher = await db.teachers.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher profile not found')
    
    assignments = await db.teacher_subjects.find({'teacher_id': teacher['id']}, {'_id': 0}).to_list(1000)
    for a in assignments:
        subject = await db.subjects.find_one({'id': a['subject_id']}, {'_id': 0})
        if subject:
            a['subject'] = subject
    return assignments

# ============== TEACHER - ATTENDANCE ==============
@api_router.post('/teacher/attendance/create-session')
async def create_attendance_session(session: AttendanceSessionCreate, current_user: dict = Depends(require_role(['teacher']))):
    teacher = await db.teachers.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher profile not found')
    
    # Close any existing active sessions for this teacher
    await db.attendance_sessions.update_many(
        {'teacher_id': teacher['id'], 'is_active': True},
        {'$set': {'is_active': False}}
    )
    
    session_code = secrets.token_urlsafe(16)[:8].upper()
    session_id = str(uuid.uuid4())
    
    session_doc = {
        'id': session_id,
        'subject_id': session.subject_id,
        'teacher_id': teacher['id'],
        'branch': session.branch,
        'semester': session.semester,
        'section': session.section,
        'teacher_latitude': session.teacher_latitude,
        'teacher_longitude': session.teacher_longitude,
        'session_code': session_code,
        'allowed_radius': 50,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'is_active': True
    }
    await db.attendance_sessions.insert_one(session_doc)
    session_doc.pop('_id', None)
    
    # Get student list for this class
    students = await db.students.find({
        'branch': session.branch,
        'semester': session.semester,
        'section': session.section
    }, {'_id': 0}).to_list(1000)
    
    student_list = []
    for s in students:
        user = await db.users.find_one({'id': s['user_id']}, {'_id': 0, 'name': 1})
        student_list.append({
            'student_id': s['id'],
            'name': user['name'] if user else '-',
            'usn': s['usn']
        })
    
    return {'session': session_doc, 'students': student_list, 'message': 'Attendance session created successfully'}

@api_router.get('/teacher/attendance/qr/{session_code}')
async def get_qr_code(session_code: str, current_user: dict = Depends(require_role(['teacher']))):
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(session_code)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return StreamingResponse(buf, media_type='image/png')

@api_router.get('/teacher/attendance/active-session')
async def get_active_session(current_user: dict = Depends(require_role(['teacher']))):
    teacher = await db.teachers.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher profile not found')
    
    session = await db.attendance_sessions.find_one(
        {'teacher_id': teacher['id'], 'is_active': True}, {'_id': 0}
    )
    if session:
        subject = await db.subjects.find_one({'id': session['subject_id']}, {'_id': 0})
        if subject:
            session['subject'] = subject
    return session

@api_router.post('/teacher/attendance/close-session/{session_id}')
async def close_session(session_id: str, current_user: dict = Depends(require_role(['teacher']))):
    session = await db.attendance_sessions.find_one({'id': session_id}, {'_id': 0})
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    
    await db.attendance_sessions.update_one({'id': session_id}, {'$set': {'is_active': False}})
    
    students = await db.students.find({
        'branch': session['branch'],
        'semester': session['semester'],
        'section': session['section']
    }, {'_id': 0}).to_list(1000)
    
    submissions = await db.attendance_submissions.find({'session_id': session_id}, {'_id': 0}).to_list(1000)
    submitted_student_ids = [sub['student_id'] for sub in submissions if sub.get('status') == 'Present']
    
    absent_students = [s for s in students if s['id'] not in submitted_student_ids]
    
    for student in absent_students:
        existing = await db.attendance_records.find_one({'session_id': session_id, 'student_id': student['id']}, {'_id': 0})
        if not existing:
            record_doc = {
                'id': str(uuid.uuid4()),
                'student_id': student['id'],
                'subject_id': session['subject_id'],
                'session_id': session_id,
                'date': datetime.now(timezone.utc).isoformat(),
                'status': 'Absent'
            }
            await db.attendance_records.insert_one(record_doc)
        
        user = await db.users.find_one({'id': student['user_id']}, {'_id': 0})
        if user and RESEND_API_KEY:
            subject_doc = await db.subjects.find_one({'id': session['subject_id']}, {'_id': 0})
            subject_name = subject_doc['subject_name'] if subject_doc else 'Unknown'
            try:
                await asyncio.to_thread(resend.Emails.send, {
                    'from': SENDER_EMAIL,
                    'to': [student['parent_email']],
                    'subject': f'Absence Alert - {user["name"]}',
                    'html': f'<div style="font-family:Arial;padding:20px;border:1px solid #000"><h2 style="color:#FF2A2A">Attendance Alert</h2><p>Dear Parent, your child <b>{user["name"]}</b> was marked ABSENT for <b>{subject_name}</b> on {datetime.now(timezone.utc).strftime("%Y-%m-%d")}.</p></div>'
                })
            except Exception as e:
                logger.error(f'Failed to send absence email: {str(e)}')
    
    return {'message': 'Session closed successfully', 'absent_count': len(absent_students)}

@api_router.get('/teacher/attendance/session/{session_id}')
async def get_session_attendance(session_id: str, current_user: dict = Depends(require_role(['teacher']))):
    submissions = await db.attendance_submissions.find({'session_id': session_id}, {'_id': 0}).to_list(1000)
    for sub in submissions:
        student = await db.students.find_one({'id': sub['student_id']}, {'_id': 0})
        if student:
            user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
            if user:
                sub['student_name'] = user['name']
                sub['usn'] = student['usn']
    return submissions

# Teacher - Get students for a class (for manual marking)
@api_router.get('/teacher/attendance/class-students')
async def get_class_students(
    branch: str = Query(...),
    semester: int = Query(...),
    section: str = Query(...),
    current_user: dict = Depends(require_role(['teacher']))
):
    students = await db.students.find({
        'branch': branch, 'semester': semester, 'section': section
    }, {'_id': 0}).to_list(1000)
    
    result = []
    for s in students:
        user = await db.users.find_one({'id': s['user_id']}, {'_id': 0, 'name': 1})
        result.append({
            'student_id': s['id'],
            'name': user['name'] if user else '-',
            'usn': s['usn']
        })
    return result

# Teacher - Manual mark attendance
@api_router.post('/teacher/attendance/manual-mark/{session_id}')
async def manual_mark_attendance(session_id: str, modification: AttendanceModify, current_user: dict = Depends(require_role(['teacher']))):
    session = await db.attendance_sessions.find_one({'id': session_id}, {'_id': 0})
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    
    existing_record = await db.attendance_records.find_one({
        'session_id': session_id, 'student_id': modification.student_id
    }, {'_id': 0})
    
    audit_entry = {
        'modified_by': current_user['id'],
        'modified_at': datetime.now(timezone.utc).isoformat(),
        'new_status': modification.status,
        'old_status': existing_record['status'] if existing_record else None
    }
    
    if existing_record:
        await db.attendance_records.update_one(
            {'id': existing_record['id']},
            {'$set': {'status': modification.status}, '$push': {'audit_log': audit_entry}}
        )
    else:
        record_doc = {
            'id': str(uuid.uuid4()),
            'student_id': modification.student_id,
            'subject_id': session['subject_id'],
            'session_id': session_id,
            'date': datetime.now(timezone.utc).isoformat(),
            'status': modification.status,
            'audit_log': [audit_entry]
        }
        await db.attendance_records.insert_one(record_doc)
    
    return {'message': f'Student marked as {modification.status}'}

# Teacher - Modify attendance (same as manual-mark but accessible for past sessions too)
@api_router.post('/teacher/attendance/modify/{session_id}')
async def modify_attendance(session_id: str, modification: AttendanceModify, current_user: dict = Depends(require_role(['teacher']))):
    session = await db.attendance_sessions.find_one({'id': session_id}, {'_id': 0})
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    
    existing_record = await db.attendance_records.find_one({
        'session_id': session_id, 'student_id': modification.student_id
    }, {'_id': 0})
    
    audit_entry = {
        'modified_by': current_user['id'],
        'modified_at': datetime.now(timezone.utc).isoformat(),
        'new_status': modification.status,
        'old_status': existing_record['status'] if existing_record else None
    }
    
    if existing_record:
        await db.attendance_records.update_one(
            {'id': existing_record['id']},
            {'$set': {'status': modification.status}, '$push': {'audit_log': audit_entry}}
        )
    else:
        record_doc = {
            'id': str(uuid.uuid4()),
            'student_id': modification.student_id,
            'subject_id': session['subject_id'],
            'session_id': session_id,
            'date': datetime.now(timezone.utc).isoformat(),
            'status': modification.status,
            'audit_log': [audit_entry]
        }
        await db.attendance_records.insert_one(record_doc)
    
    return {'message': 'Attendance modified successfully'}

# Teacher - Get attendance history (past sessions)
@api_router.get('/teacher/attendance/history')
async def get_attendance_history(
    subject_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['teacher']))
):
    teacher = await db.teachers.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher profile not found')
    
    query = {'teacher_id': teacher['id']}
    if subject_id:
        query['subject_id'] = subject_id
    if date:
        query['created_at'] = {'$regex': f'^{date}'}
    
    sessions = await db.attendance_sessions.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for s in sessions:
        subject = await db.subjects.find_one({'id': s['subject_id']}, {'_id': 0})
        if subject:
            s['subject'] = subject
        present_count = await db.attendance_records.count_documents({'session_id': s['id'], 'status': 'Present'})
        absent_count = await db.attendance_records.count_documents({'session_id': s['id'], 'status': 'Absent'})
        s['present_count'] = present_count
        s['absent_count'] = absent_count
    
    return sessions

# Teacher - Get attendance records for a session (for modify page)
@api_router.get('/teacher/attendance/records/{session_id}')
async def get_session_records(session_id: str, current_user: dict = Depends(require_role(['teacher']))):
    session = await db.attendance_sessions.find_one({'id': session_id}, {'_id': 0})
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    
    students = await db.students.find({
        'branch': session['branch'], 'semester': session['semester'], 'section': session['section']
    }, {'_id': 0}).to_list(1000)
    
    result = []
    for s in students:
        user = await db.users.find_one({'id': s['user_id']}, {'_id': 0, 'name': 1})
        record = await db.attendance_records.find_one({
            'session_id': session_id, 'student_id': s['id']
        }, {'_id': 0})
        
        result.append({
            'student_id': s['id'],
            'name': user['name'] if user else '-',
            'usn': s['usn'],
            'status': record['status'] if record else 'Not Recorded',
            'audit_log': record.get('audit_log', []) if record else []
        })
    
    return {'session': session, 'records': result}

# Teacher - Upload marks
@api_router.post('/teacher/marks')
async def upload_marks(marks: MarksUpload, current_user: dict = Depends(require_role(['teacher']))):
    student = await db.students.find_one({'usn': marks.student_usn}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student not found')
    
    marks_doc = {
        'id': str(uuid.uuid4()),
        'student_id': student['id'],
        'subject_id': marks.subject_id,
        'exam_name': marks.exam_name,
        'marks': marks.marks,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.marks.insert_one(marks_doc)
    return {'message': 'Marks uploaded successfully'}

# Teacher - Upload notes
@api_router.post('/teacher/notes')
async def upload_notes(notes: NotesUpload, current_user: dict = Depends(require_role(['teacher']))):
    notes_doc = {
        'id': str(uuid.uuid4()),
        'subject_id': notes.subject_id,
        'title': notes.title,
        'file_url': notes.file_url,
        'uploaded_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.notes.insert_one(notes_doc)
    return {'message': 'Notes uploaded successfully'}

# Teacher - Download attendance CSV (FIXED: proper encoding)
@api_router.get('/teacher/attendance/csv')
async def download_attendance_csv(
    subject_id: str = Query(...),
    date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['teacher']))
):
    query = {'subject_id': subject_id}
    if date:
        query['date'] = {'$regex': f'^{date}'}
    
    records = await db.attendance_records.find(query, {'_id': 0}).to_list(10000)
    
    string_output = StringIO()
    writer = csv.writer(string_output)
    writer.writerow(['Student Name', 'USN', 'Branch', 'Semester', 'Section', 'Date', 'Status'])
    
    for record in records:
        student = await db.students.find_one({'id': record['student_id']}, {'_id': 0})
        if student:
            user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
            if user:
                writer.writerow([
                    user['name'],
                    student['usn'],
                    student['branch'],
                    student['semester'],
                    student['section'],
                    record['date'][:10] if record.get('date') else '-',
                    record['status']
                ])
    
    bytes_output = BytesIO(string_output.getvalue().encode('utf-8-sig'))
    bytes_output.seek(0)
    
    return StreamingResponse(
        bytes_output,
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=attendance.csv'}
    )

# ============== STUDENT - ATTENDANCE ==============
@api_router.post('/student/attendance/submit')
async def submit_attendance(submission: AttendanceSubmit, current_user: dict = Depends(require_role(['student']))):
    session = await db.attendance_sessions.find_one(
        {'session_code': submission.session_code, 'is_active': True}, {'_id': 0}
    )
    if not session:
        raise HTTPException(status_code=400, detail='Invalid or expired session code')
    
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    
    # Check max 3 attempts
    attempt_count = await db.attendance_submissions.count_documents({
        'session_id': session['id'], 'student_id': student['id']
    })
    if attempt_count >= 3:
        raise HTTPException(status_code=400, detail='Maximum 3 attempts exceeded for this session')
    
    # Check if already marked present
    existing_present = await db.attendance_submissions.find_one({
        'session_id': session['id'], 'student_id': student['id'], 'status': 'Present'
    }, {'_id': 0})
    if existing_present:
        raise HTTPException(status_code=400, detail='Attendance already marked as Present')
    
    teacher_coords = (session['teacher_latitude'], session['teacher_longitude'])
    student_coords = (submission.student_latitude, submission.student_longitude)
    distance = geodesic(teacher_coords, student_coords).meters
    
    status = 'Present' if distance <= session['allowed_radius'] else 'Invalid'
    
    submission_doc = {
        'id': str(uuid.uuid4()),
        'session_id': session['id'],
        'student_id': student['id'],
        'student_latitude': submission.student_latitude,
        'student_longitude': submission.student_longitude,
        'distance': distance,
        'status': status,
        'attempt_number': attempt_count + 1,
        'submitted_at': datetime.now(timezone.utc).isoformat()
    }
    await db.attendance_submissions.insert_one(submission_doc)
    
    if status == 'Present':
        existing_record = await db.attendance_records.find_one({
            'session_id': session['id'], 'student_id': student['id']
        }, {'_id': 0})
        if not existing_record:
            record_doc = {
                'id': str(uuid.uuid4()),
                'student_id': student['id'],
                'subject_id': session['subject_id'],
                'session_id': session['id'],
                'date': datetime.now(timezone.utc).isoformat(),
                'status': 'Present'
            }
            await db.attendance_records.insert_one(record_doc)
    
    remaining_attempts = 3 - (attempt_count + 1)
    return {
        'message': f'Attendance submitted: {status}',
        'distance': round(distance, 2),
        'status': status,
        'attempt_number': attempt_count + 1,
        'remaining_attempts': remaining_attempts
    }

@api_router.get('/student/attendance/percentage')
async def get_attendance_percentage(current_user: dict = Depends(require_role(['student']))):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    
    subjects = await db.subjects.find({
        'branch': student['branch'], 'semester': student['semester'], 'section': student['section']
    }, {'_id': 0}).to_list(1000)
    
    result = []
    for subject in subjects:
        total = await db.attendance_records.count_documents({'student_id': student['id'], 'subject_id': subject['id']})
        present = await db.attendance_records.count_documents({'student_id': student['id'], 'subject_id': subject['id'], 'status': 'Present'})
        percentage = round((present / total * 100), 2) if total > 0 else 0
        result.append({
            'subject': subject,
            'total_classes': total,
            'present': present,
            'percentage': percentage
        })
    return result

@api_router.get('/student/marks')
async def get_student_marks(current_user: dict = Depends(require_role(['student']))):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    marks = await db.marks.find({'student_id': student['id']}, {'_id': 0}).to_list(1000)
    for mark in marks:
        subject = await db.subjects.find_one({'id': mark['subject_id']}, {'_id': 0})
        if subject:
            mark['subject'] = subject
    return marks

@api_router.get('/student/notes')
async def get_notes(current_user: dict = Depends(require_role(['student']))):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    subjects = await db.subjects.find({
        'branch': student['branch'], 'semester': student['semester'], 'section': student['section']
    }, {'_id': 0}).to_list(1000)
    subject_ids = [s['id'] for s in subjects]
    notes = await db.notes.find({'subject_id': {'$in': subject_ids}}, {'_id': 0}).to_list(1000)
    for note in notes:
        subject = await db.subjects.find_one({'id': note['subject_id']}, {'_id': 0})
        if subject:
            note['subject'] = subject
    return notes

@api_router.get('/student/announcements')
async def get_student_announcements(current_user: dict = Depends(require_role(['student']))):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    return await db.announcements.find({
        'branch': student['branch'], 'semester': student['semester'], 'section': student['section']
    }, {'_id': 0}).sort('created_at', -1).to_list(1000)

@api_router.get('/student/feedback-forms')
async def get_student_feedback_forms(current_user: dict = Depends(require_role(['student']))):
    return await db.feedback_forms.find({}, {'_id': 0}).to_list(1000)

@api_router.post('/student/feedback')
async def submit_feedback(feedback: FeedbackResponseCreate, current_user: dict = Depends(require_role(['student']))):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    feedback_doc = {
        'id': str(uuid.uuid4()),
        'form_id': feedback.form_id,
        'student_id': student['id'],
        'rating': feedback.rating,
        'comments': feedback.comments,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.feedback_responses.insert_one(feedback_doc)
    return {'message': 'Feedback submitted successfully'}

# ============== EXAM MANAGEMENT (ADMIN) ==============
@api_router.post('/admin/exams')
async def create_exam(exam: ExamCreate, current_user: dict = Depends(require_role(['admin']))):
    exam_doc = {
        'id': str(uuid.uuid4()),
        'exam_name': exam.exam_name,
        'exam_type': exam.exam_type,
        'date': exam.date,
        'branch': exam.branch,
        'semester': exam.semester,
        'section': exam.section,
        'subject_ids': exam.subject_ids,
        'max_marks': exam.max_marks,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.exams.insert_one(exam_doc)
    exam_doc.pop('_id', None)
    return {'exam': exam_doc, 'message': 'Exam created successfully'}

@api_router.get('/admin/exams')
async def get_exams(
    branch: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['admin']))
):
    query = {}
    if branch: query['branch'] = branch
    if semester: query['semester'] = semester
    if section: query['section'] = section
    exams = await db.exams.find(query, {'_id': 0}).sort('date', -1).to_list(1000)
    for exam in exams:
        subjects = []
        for sid in exam.get('subject_ids', []):
            subj = await db.subjects.find_one({'id': sid}, {'_id': 0})
            if subj: subjects.append(subj)
        exam['subjects'] = subjects
    return exams

@api_router.put('/admin/exams/{exam_id}')
async def update_exam(exam_id: str, update: ExamUpdate, current_user: dict = Depends(require_role(['admin']))):
    existing = await db.exams.find_one({'id': exam_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail='Exam not found')
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.exams.update_one({'id': exam_id}, {'$set': update_data})
    return {'message': 'Exam updated successfully'}

@api_router.delete('/admin/exams/{exam_id}')
async def delete_exam(exam_id: str, current_user: dict = Depends(require_role(['admin']))):
    result = await db.exams.delete_one({'id': exam_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Exam not found')
    await db.exam_marks.delete_many({'exam_id': exam_id})
    return {'message': 'Exam and associated marks deleted'}

# Admin - View all exam marks with filters
@api_router.get('/admin/exam-marks')
async def admin_get_exam_marks(
    exam_id: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['admin']))
):
    query = {}
    if exam_id: query['exam_id'] = exam_id
    if subject_id: query['subject_id'] = subject_id
    
    marks_list = await db.exam_marks.find(query, {'_id': 0}).to_list(10000)
    
    result = []
    for m in marks_list:
        student = await db.students.find_one({'id': m['student_id']}, {'_id': 0})
        if student:
            if branch and student.get('branch') != branch: continue
            if semester and student.get('semester') != semester: continue
            if section and student.get('section') != section: continue
            user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
            m['student_name'] = user['name'] if user else '-'
            m['usn'] = student['usn']
            m['branch'] = student['branch']
        exam = await db.exams.find_one({'id': m['exam_id']}, {'_id': 0})
        if exam:
            m['exam_name'] = exam['exam_name']
            m['exam_type'] = exam['exam_type']
            m['max_marks'] = exam['max_marks']
        subject = await db.subjects.find_one({'id': m['subject_id']}, {'_id': 0})
        if subject:
            m['subject_name'] = subject['subject_name']
            m['subject_code'] = subject['subject_code']
        pct = (m['marks_obtained'] / m.get('max_marks', 100)) * 100 if m.get('max_marks', 100) > 0 else 0
        m['percentage'] = round(pct, 2)
        m['grade'] = calculate_grade(pct)
        result.append(m)
    
    return result

# Admin - Performance analytics
@api_router.get('/admin/exam-analytics')
async def admin_exam_analytics(
    exam_id: str = Query(...),
    current_user: dict = Depends(require_role(['admin']))
):
    exam = await db.exams.find_one({'id': exam_id}, {'_id': 0})
    if not exam:
        raise HTTPException(status_code=404, detail='Exam not found')
    
    marks_list = await db.exam_marks.find({'exam_id': exam_id}, {'_id': 0}).to_list(10000)
    
    # Subject-wise analytics
    subject_stats = {}
    student_totals = {}
    
    for m in marks_list:
        sid = m['subject_id']
        stid = m['student_id']
        obtained = m['marks_obtained']
        max_m = m.get('max_marks', exam['max_marks'])
        
        if sid not in subject_stats:
            subj = await db.subjects.find_one({'id': sid}, {'_id': 0})
            subject_stats[sid] = {
                'subject_name': subj['subject_name'] if subj else '-',
                'subject_code': subj['subject_code'] if subj else '-',
                'total_students': 0, 'total_marks': 0, 'max_marks': max_m,
                'highest': 0, 'lowest': float('inf'), 'pass_count': 0, 'fail_count': 0
            }
        
        ss = subject_stats[sid]
        ss['total_students'] += 1
        ss['total_marks'] += obtained
        ss['highest'] = max(ss['highest'], obtained)
        ss['lowest'] = min(ss['lowest'], obtained)
        pct = (obtained / max_m) * 100 if max_m > 0 else 0
        if pct >= 40: ss['pass_count'] += 1
        else: ss['fail_count'] += 1
        
        if stid not in student_totals:
            student_totals[stid] = {'total_obtained': 0, 'total_max': 0, 'subjects': 0}
        student_totals[stid]['total_obtained'] += obtained
        student_totals[stid]['total_max'] += max_m
        student_totals[stid]['subjects'] += 1
    
    for sid, ss in subject_stats.items():
        if ss['total_students'] > 0:
            ss['average'] = round(ss['total_marks'] / ss['total_students'], 2)
        else:
            ss['average'] = 0
        if ss['lowest'] == float('inf'):
            ss['lowest'] = 0
    
    # Class toppers
    toppers = []
    for stid, totals in student_totals.items():
        student = await db.students.find_one({'id': stid}, {'_id': 0})
        if student:
            user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
            pct = (totals['total_obtained'] / totals['total_max']) * 100 if totals['total_max'] > 0 else 0
            toppers.append({
                'student_id': stid,
                'name': user['name'] if user else '-',
                'usn': student['usn'],
                'total_obtained': totals['total_obtained'],
                'total_max': totals['total_max'],
                'percentage': round(pct, 2),
                'grade': calculate_grade(pct)
            })
    
    toppers.sort(key=lambda x: x['percentage'], reverse=True)
    
    overall_pass = sum(1 for t in toppers if t['percentage'] >= 40)
    overall_fail = len(toppers) - overall_pass
    
    return {
        'exam': exam,
        'subject_stats': list(subject_stats.values()),
        'toppers': toppers[:10],
        'all_students': toppers,
        'overall': {
            'total_students': len(toppers),
            'pass_count': overall_pass,
            'fail_count': overall_fail,
            'pass_percentage': round((overall_pass / len(toppers)) * 100, 2) if toppers else 0
        }
    }

# Admin - Download exam marks CSV
@api_router.get('/admin/exam-marks/csv')
async def admin_download_marks_csv(
    exam_id: str = Query(...),
    current_user: dict = Depends(require_role(['admin']))
):
    exam = await db.exams.find_one({'id': exam_id}, {'_id': 0})
    if not exam:
        raise HTTPException(status_code=404, detail='Exam not found')
    
    marks_list = await db.exam_marks.find({'exam_id': exam_id}, {'_id': 0}).to_list(10000)
    
    string_output = StringIO()
    writer = csv.writer(string_output)
    writer.writerow(['USN', 'Student Name', 'Subject', 'Subject Code', 'Marks Obtained', 'Max Marks', 'Percentage', 'Grade', 'Remarks'])
    
    for m in marks_list:
        student = await db.students.find_one({'id': m['student_id']}, {'_id': 0})
        user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1}) if student else None
        subject = await db.subjects.find_one({'id': m['subject_id']}, {'_id': 0})
        max_m = m.get('max_marks', exam['max_marks'])
        pct = round((m['marks_obtained'] / max_m) * 100, 2) if max_m > 0 else 0
        
        writer.writerow([
            student['usn'] if student else '-',
            user['name'] if user else '-',
            subject['subject_name'] if subject else '-',
            subject['subject_code'] if subject else '-',
            m['marks_obtained'],
            max_m,
            pct,
            calculate_grade(pct),
            m.get('remarks', '')
        ])
    
    bytes_output = BytesIO(string_output.getvalue().encode('utf-8-sig'))
    bytes_output.seek(0)
    fname = f"{exam['exam_name'].replace(' ', '_')}_marks.csv"
    return StreamingResponse(bytes_output, media_type='text/csv', headers={'Content-Disposition': f'attachment; filename={fname}'})

# ============== EXAM MANAGEMENT (TEACHER) ==============
@api_router.get('/teacher/exams')
async def teacher_get_exams(current_user: dict = Depends(require_role(['teacher']))):
    teacher = await db.teachers.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher profile not found')
    
    assignments = await db.teacher_subjects.find({'teacher_id': teacher['id']}, {'_id': 0}).to_list(1000)
    assigned_subject_ids = [a['subject_id'] for a in assignments]
    
    # Get exams that include any of the teacher's assigned subjects
    all_exams = await db.exams.find({}, {'_id': 0}).sort('date', -1).to_list(1000)
    filtered = []
    for exam in all_exams:
        matching_subjects = [sid for sid in exam.get('subject_ids', []) if sid in assigned_subject_ids]
        if matching_subjects:
            subjects = []
            for sid in matching_subjects:
                subj = await db.subjects.find_one({'id': sid}, {'_id': 0})
                if subj: subjects.append(subj)
            exam['subjects'] = subjects
            exam['teacher_subject_ids'] = matching_subjects
            filtered.append(exam)
    return filtered

@api_router.post('/teacher/exam-marks')
async def teacher_enter_marks(entry: ExamMarksEntry, current_user: dict = Depends(require_role(['teacher']))):
    exam = await db.exams.find_one({'id': entry.exam_id}, {'_id': 0})
    if not exam:
        raise HTTPException(status_code=404, detail='Exam not found')
    
    if entry.marks_obtained < 0:
        raise HTTPException(status_code=400, detail='Marks cannot be negative')
    if entry.marks_obtained > exam['max_marks']:
        raise HTTPException(status_code=400, detail=f'Marks cannot exceed maximum ({exam["max_marks"]})')
    
    # Check duplicate
    existing = await db.exam_marks.find_one({
        'exam_id': entry.exam_id, 'subject_id': entry.subject_id, 'student_id': entry.student_id
    }, {'_id': 0})
    
    if existing:
        await db.exam_marks.update_one(
            {'id': existing['id']},
            {'$set': {
                'marks_obtained': entry.marks_obtained,
                'max_marks': exam['max_marks'],
                'remarks': entry.remarks,
                'updated_at': datetime.now(timezone.utc).isoformat(),
                'updated_by': current_user['id']
            }}
        )
        return {'message': 'Marks updated successfully'}
    
    marks_doc = {
        'id': str(uuid.uuid4()),
        'exam_id': entry.exam_id,
        'subject_id': entry.subject_id,
        'student_id': entry.student_id,
        'marks_obtained': entry.marks_obtained,
        'max_marks': exam['max_marks'],
        'remarks': entry.remarks,
        'entered_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.exam_marks.insert_one(marks_doc)
    return {'message': 'Marks entered successfully'}

@api_router.post('/teacher/exam-marks/bulk')
async def teacher_bulk_marks(bulk: BulkMarksEntry, current_user: dict = Depends(require_role(['teacher']))):
    exam = await db.exams.find_one({'id': bulk.exam_id}, {'_id': 0})
    if not exam:
        raise HTTPException(status_code=404, detail='Exam not found')
    
    success_count = 0
    errors = []
    for entry in bulk.entries:
        sid = entry.get('student_id')
        obtained = entry.get('marks_obtained')
        remarks = entry.get('remarks', '')
        
        if obtained is None or sid is None:
            errors.append(f'Missing data for entry')
            continue
        if obtained < 0 or obtained > exam['max_marks']:
            errors.append(f'Invalid marks {obtained} for student {sid}')
            continue
        
        existing = await db.exam_marks.find_one({
            'exam_id': bulk.exam_id, 'subject_id': bulk.subject_id, 'student_id': sid
        }, {'_id': 0})
        
        if existing:
            await db.exam_marks.update_one(
                {'id': existing['id']},
                {'$set': {'marks_obtained': obtained, 'max_marks': exam['max_marks'], 'remarks': remarks, 'updated_at': datetime.now(timezone.utc).isoformat(), 'updated_by': current_user['id']}}
            )
        else:
            await db.exam_marks.insert_one({
                'id': str(uuid.uuid4()),
                'exam_id': bulk.exam_id,
                'subject_id': bulk.subject_id,
                'student_id': sid,
                'marks_obtained': obtained,
                'max_marks': exam['max_marks'],
                'remarks': remarks,
                'entered_by': current_user['id'],
                'created_at': datetime.now(timezone.utc).isoformat()
            })
        success_count += 1
    
    return {'message': f'{success_count} marks saved', 'errors': errors}

# Teacher - Get marks for a specific exam/subject (for viewing/editing)
@api_router.get('/teacher/exam-marks/{exam_id}/{subject_id}')
async def teacher_get_exam_marks(exam_id: str, subject_id: str, current_user: dict = Depends(require_role(['teacher']))):
    exam = await db.exams.find_one({'id': exam_id}, {'_id': 0})
    if not exam:
        raise HTTPException(status_code=404, detail='Exam not found')
    
    # Get all students of that class
    students = await db.students.find({
        'branch': exam['branch'], 'semester': exam['semester'], 'section': exam['section']
    }, {'_id': 0}).to_list(1000)
    
    result = []
    for s in students:
        user = await db.users.find_one({'id': s['user_id']}, {'_id': 0, 'name': 1})
        existing_mark = await db.exam_marks.find_one({
            'exam_id': exam_id, 'subject_id': subject_id, 'student_id': s['id']
        }, {'_id': 0})
        
        result.append({
            'student_id': s['id'],
            'name': user['name'] if user else '-',
            'usn': s['usn'],
            'marks_obtained': existing_mark['marks_obtained'] if existing_mark else None,
            'remarks': existing_mark.get('remarks', '') if existing_mark else '',
            'max_marks': exam['max_marks']
        })
    
    return {'exam': exam, 'students': result}

# Teacher - Class performance summary for an exam
@api_router.get('/teacher/exam-performance/{exam_id}')
async def teacher_exam_performance(exam_id: str, current_user: dict = Depends(require_role(['teacher']))):
    exam = await db.exams.find_one({'id': exam_id}, {'_id': 0})
    if not exam:
        raise HTTPException(status_code=404, detail='Exam not found')
    
    teacher = await db.teachers.find_one({'user_id': current_user['id']}, {'_id': 0})
    assignments = await db.teacher_subjects.find({'teacher_id': teacher['id']}, {'_id': 0}).to_list(1000)
    assigned_ids = [a['subject_id'] for a in assignments]
    
    subject_stats = {}
    for sid in exam.get('subject_ids', []):
        if sid not in assigned_ids: continue
        subj = await db.subjects.find_one({'id': sid}, {'_id': 0})
        marks = await db.exam_marks.find({'exam_id': exam_id, 'subject_id': sid}, {'_id': 0}).to_list(1000)
        
        if marks:
            obtained_list = [m['marks_obtained'] for m in marks]
            pass_count = sum(1 for m in marks if (m['marks_obtained'] / exam['max_marks']) * 100 >= 40)
            subject_stats[sid] = {
                'subject_name': subj['subject_name'] if subj else '-',
                'subject_code': subj['subject_code'] if subj else '-',
                'students_count': len(marks),
                'average': round(sum(obtained_list) / len(obtained_list), 2),
                'highest': max(obtained_list),
                'lowest': min(obtained_list),
                'pass_count': pass_count,
                'fail_count': len(marks) - pass_count
            }
    
    return {'exam': exam, 'subject_stats': list(subject_stats.values())}

# ============== STUDENT - EXAM MARKS ==============
@api_router.get('/student/exam-marks')
async def student_get_exam_marks(current_user: dict = Depends(require_role(['student']))):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    
    all_marks = await db.exam_marks.find({'student_id': student['id']}, {'_id': 0}).to_list(1000)
    
    # Group by exam
    exams_map = {}
    for m in all_marks:
        eid = m['exam_id']
        if eid not in exams_map:
            exam = await db.exams.find_one({'id': eid}, {'_id': 0})
            exams_map[eid] = {
                'exam': exam,
                'marks': [],
                'total_obtained': 0,
                'total_max': 0
            }
        subject = await db.subjects.find_one({'id': m['subject_id']}, {'_id': 0})
        pct = (m['marks_obtained'] / m.get('max_marks', 100)) * 100 if m.get('max_marks', 100) > 0 else 0
        entry = {
            **m,
            'subject_name': subject['subject_name'] if subject else '-',
            'subject_code': subject['subject_code'] if subject else '-',
            'percentage': round(pct, 2),
            'grade': calculate_grade(pct),
            'grade_label': get_grade_label(calculate_grade(pct))
        }
        exams_map[eid]['marks'].append(entry)
        exams_map[eid]['total_obtained'] += m['marks_obtained']
        exams_map[eid]['total_max'] += m.get('max_marks', 100)
    
    # Calculate overall for each exam
    result = []
    for eid, data in exams_map.items():
        overall_pct = (data['total_obtained'] / data['total_max']) * 100 if data['total_max'] > 0 else 0
        data['overall_percentage'] = round(overall_pct, 2)
        data['overall_grade'] = calculate_grade(overall_pct)
        data['overall_grade_label'] = get_grade_label(calculate_grade(overall_pct))
        result.append(data)
    
    result.sort(key=lambda x: x['exam']['date'] if x['exam'] else '', reverse=True)
    return result

# Student - Download report card CSV
@api_router.get('/student/report-card/csv')
async def student_report_card_csv(
    exam_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['student']))
):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')
    
    user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
    
    query = {'student_id': student['id']}
    if exam_id: query['exam_id'] = exam_id
    all_marks = await db.exam_marks.find(query, {'_id': 0}).to_list(1000)
    
    string_output = StringIO()
    writer = csv.writer(string_output)
    writer.writerow([f"Report Card - {user['name'] if user else '-'} ({student['usn']})"])
    writer.writerow([f"Branch: {student['branch']} | Semester: {student['semester']} | Section: {student['section']}"])
    writer.writerow([])
    writer.writerow(['Exam', 'Subject', 'Subject Code', 'Marks Obtained', 'Max Marks', 'Percentage', 'Grade', 'Remarks'])
    
    for m in all_marks:
        exam = await db.exams.find_one({'id': m['exam_id']}, {'_id': 0})
        subject = await db.subjects.find_one({'id': m['subject_id']}, {'_id': 0})
        max_m = m.get('max_marks', 100)
        pct = round((m['marks_obtained'] / max_m) * 100, 2) if max_m > 0 else 0
        writer.writerow([
            exam['exam_name'] if exam else '-',
            subject['subject_name'] if subject else '-',
            subject['subject_code'] if subject else '-',
            m['marks_obtained'],
            max_m,
            pct,
            calculate_grade(pct),
            m.get('remarks', '')
        ])
    
    bytes_output = BytesIO(string_output.getvalue().encode('utf-8-sig'))
    bytes_output.seek(0)
    return StreamingResponse(bytes_output, media_type='text/csv', headers={'Content-Disposition': f'attachment; filename=report_card_{student["usn"]}.csv'})

# Teacher - Upload marks via CSV file
@api_router.post('/teacher/exam-marks/csv-upload')
async def teacher_csv_upload_marks(
    exam_id: str = Query(...),
    subject_id: str = Query(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(['teacher']))
):
    exam = await db.exams.find_one({'id': exam_id}, {'_id': 0})
    if not exam:
        raise HTTPException(status_code=404, detail='Exam not found')

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail='Only CSV files are accepted')

    content = await file.read()
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = content.decode('latin-1')

    reader = csv.DictReader(StringIO(text))
    success_count = 0
    failed_rows = []

    for row_num, row in enumerate(reader, start=2):
        usn = (row.get('USN') or row.get('usn') or '').strip()
        marks_str = (row.get('Marks') or row.get('marks') or row.get('marks_obtained') or row.get('Marks Obtained') or '').strip()
        remarks = (row.get('Remarks') or row.get('remarks') or '').strip()

        if not usn:
            failed_rows.append({'row': row_num, 'reason': 'Missing USN'})
            continue
        if not marks_str:
            failed_rows.append({'row': row_num, 'usn': usn, 'reason': 'Missing marks'})
            continue

        try:
            marks_val = float(marks_str)
        except ValueError:
            failed_rows.append({'row': row_num, 'usn': usn, 'reason': f'Invalid marks value: {marks_str}'})
            continue

        if marks_val < 0:
            failed_rows.append({'row': row_num, 'usn': usn, 'reason': 'Marks cannot be negative'})
            continue
        if marks_val > exam['max_marks']:
            failed_rows.append({'row': row_num, 'usn': usn, 'reason': f'Marks exceed max ({exam["max_marks"]})'})
            continue

        student = await db.students.find_one({'usn': usn.upper()}, {'_id': 0})
        if not student:
            student = await db.students.find_one({'usn': usn}, {'_id': 0})
        if not student:
            failed_rows.append({'row': row_num, 'usn': usn, 'reason': 'Student not found'})
            continue

        existing = await db.exam_marks.find_one({
            'exam_id': exam_id, 'subject_id': subject_id, 'student_id': student['id']
        }, {'_id': 0})

        if existing:
            await db.exam_marks.update_one(
                {'id': existing['id']},
                {'$set': {
                    'marks_obtained': marks_val,
                    'max_marks': exam['max_marks'],
                    'remarks': remarks,
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                    'updated_by': current_user['id']
                }}
            )
        else:
            await db.exam_marks.insert_one({
                'id': str(uuid.uuid4()),
                'exam_id': exam_id,
                'subject_id': subject_id,
                'student_id': student['id'],
                'marks_obtained': marks_val,
                'max_marks': exam['max_marks'],
                'remarks': remarks,
                'entered_by': current_user['id'],
                'created_at': datetime.now(timezone.utc).isoformat()
            })
        success_count += 1

    return {
        'message': f'{success_count} marks uploaded successfully',
        'success_count': success_count,
        'failed_count': len(failed_rows),
        'failed_rows': failed_rows
    }

# Student - Download PDF report card
@api_router.get('/student/report-card/pdf')
async def student_report_card_pdf(
    exam_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(['student']))
):
    student = await db.students.find_one({'user_id': current_user['id']}, {'_id': 0})
    if not student:
        raise HTTPException(status_code=404, detail='Student profile not found')

    user = await db.users.find_one({'id': student['user_id']}, {'_id': 0, 'name': 1})
    student_name = user['name'] if user else '-'

    query = {'student_id': student['id']}
    if exam_id:
        query['exam_id'] = exam_id
    all_marks = await db.exam_marks.find(query, {'_id': 0}).to_list(1000)

    if not all_marks:
        raise HTTPException(status_code=404, detail='No marks found')

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, spaceAfter=6, textColor=colors.HexColor('#002FA7'))
    elements.append(Paragraph('REPORT CARD', title_style))

    # Student info
    info_style = ParagraphStyle('Info', parent=styles['Normal'], fontSize=11, spaceAfter=4)
    elements.append(Paragraph(f'<b>Name:</b> {student_name}', info_style))
    elements.append(Paragraph(f'<b>USN:</b> {student["usn"]}', info_style))
    elements.append(Paragraph(f'<b>Branch:</b> {student["branch"]} | <b>Semester:</b> {student["semester"]} | <b>Section:</b> {student["section"]}', info_style))
    elements.append(Spacer(1, 10*mm))

    # Group marks by exam
    exams_map = {}
    for m in all_marks:
        eid = m['exam_id']
        if eid not in exams_map:
            exam = await db.exams.find_one({'id': eid}, {'_id': 0})
            exams_map[eid] = {'exam': exam, 'marks': [], 'total_obtained': 0, 'total_max': 0}
        subject = await db.subjects.find_one({'id': m['subject_id']}, {'_id': 0})
        max_m = m.get('max_marks', 100)
        pct = round((m['marks_obtained'] / max_m) * 100, 2) if max_m > 0 else 0
        grade = calculate_grade(pct)
        exams_map[eid]['marks'].append({
            'subject_name': subject['subject_name'] if subject else '-',
            'subject_code': subject['subject_code'] if subject else '-',
            'marks_obtained': m['marks_obtained'],
            'max_marks': max_m,
            'percentage': pct,
            'grade': grade,
            'remarks': m.get('remarks', '')
        })
        exams_map[eid]['total_obtained'] += m['marks_obtained']
        exams_map[eid]['total_max'] += max_m

    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Heading2'], fontSize=13, spaceAfter=4, textColor=colors.HexColor('#09090B'))

    for eid, data in exams_map.items():
        exam = data['exam']
        exam_label = f"{exam['exam_name']} ({exam['exam_type']})" if exam else 'Unknown Exam'
        elements.append(Paragraph(exam_label, subtitle_style))
        if exam:
            elements.append(Paragraph(f"Date: {exam.get('date', '-')}", info_style))

        table_data = [['Subject', 'Code', 'Marks', 'Max', '%', 'Grade', 'Remarks']]
        for mk in data['marks']:
            table_data.append([
                mk['subject_name'], mk['subject_code'],
                str(mk['marks_obtained']), str(mk['max_marks']),
                f"{mk['percentage']}%", mk['grade'], mk['remarks'] or '-'
            ])

        overall_pct = round((data['total_obtained'] / data['total_max']) * 100, 2) if data['total_max'] > 0 else 0
        overall_grade = calculate_grade(overall_pct)
        table_data.append(['TOTAL', '', str(data['total_obtained']), str(data['total_max']), f"{overall_pct}%", overall_grade, ''])

        t = Table(table_data, colWidths=[90, 55, 45, 40, 45, 45, 120])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#09090B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (2, 0), (5, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d4d4d8')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f4f4f5')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#fafafa')]),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 8*mm))

    doc.build(elements)
    buffer.seek(0)

    fname = f"report_card_{student['usn']}.pdf"
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename={fname}'}
    )

# ============== STARTUP ==============
@app.on_event('startup')
async def startup_event():
    await db.users.create_index('email', unique=True)
    await db.students.create_index('usn', unique=True)
    
    admin_email = ADMIN_EMAIL.lower()
    existing = await db.users.find_one({'email': admin_email}, {'_id': 0})
    if existing is None:
        hashed = hash_password(ADMIN_PASSWORD)
        await db.users.insert_one({
            'id': str(uuid.uuid4()),
            'email': admin_email,
            'password_hash': hashed,
            'name': 'Admin',
            'role': 'admin',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        logger.info(f'Admin user created: {admin_email}')
    elif not verify_password(ADMIN_PASSWORD, existing['password_hash']):
        await db.users.update_one(
            {'email': admin_email},
            {'$set': {'password_hash': hash_password(ADMIN_PASSWORD)}}
        )
        logger.info(f'Admin password updated: {admin_email}')

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # temporarily allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
