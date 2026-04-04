import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';

import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import Students from './pages/admin/Students';
import Teachers from './pages/admin/Teachers';
import Subjects from './pages/admin/Subjects';
import Announcements from './pages/admin/Announcements';
import Feedback from './pages/admin/Feedback';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminExams from './pages/admin/AdminExams';

import TeacherLayout from './pages/teacher/TeacherLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TakeAttendance from './pages/teacher/TakeAttendance';
import AttendanceHistory from './pages/teacher/AttendanceHistory';
import ManageMarks from './pages/teacher/ManageMarks';
import ManageNotes from './pages/teacher/ManageNotes';

import StudentLayout from './pages/student/StudentLayout';
import StudentDashboard from './pages/student/StudentDashboard';
import SubmitAttendance from './pages/student/SubmitAttendance';
import ViewMarks from './pages/student/ViewMarks';
import ViewNotes from './pages/student/ViewNotes';
import StudentAnnouncements from './pages/student/StudentAnnouncements';
import SubmitFeedback from './pages/student/SubmitFeedback';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="exams" element={<AdminExams />} />
          </Route>

          <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/teacher/dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="attendance" element={<TakeAttendance />} />
            <Route path="attendance-history" element={<AttendanceHistory />} />
            <Route path="marks" element={<ManageMarks />} />
            <Route path="notes" element={<ManageNotes />} />
          </Route>

          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/student/dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="attendance" element={<SubmitAttendance />} />
            <Route path="marks" element={<ViewMarks />} />
            <Route path="notes" element={<ViewNotes />} />
            <Route path="announcements" element={<StudentAnnouncements />} />
            <Route path="feedback" element={<SubmitFeedback />} />
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
