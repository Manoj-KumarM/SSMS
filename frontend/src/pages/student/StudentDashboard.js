import React, { useState, useEffect } from 'react';
import { api, useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QrCode, BarChart3, FileText, Megaphone, MessageSquare, BookOpen } from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);

  useEffect(() => { fetchAttendance(); }, []);

  const fetchAttendance = async () => {
    try { const { data } = await api.get('/api/student/attendance/percentage'); setAttendance(data); } catch (e) { console.error(e); }
  };

  const overallPercentage = attendance.length > 0
    ? (attendance.reduce((sum, a) => sum + a.percentage, 0) / attendance.length).toFixed(1)
    : 0;

  const cards = [
    { icon: QrCode, label: 'Submit Attendance', desc: 'Scan QR Code', path: '/student/attendance' },
    { icon: BarChart3, label: 'View Marks', desc: 'Exam scores', path: '/student/marks' },
    { icon: FileText, label: 'Notes', desc: 'Download materials', path: '/student/notes' },
    { icon: Megaphone, label: 'Announcements', desc: 'College updates', path: '/student/announcements' },
    { icon: MessageSquare, label: 'Feedback', desc: 'Submit feedback', path: '/student/feedback' }
  ];

  return (
    <div className="p-8" data-testid="student-dashboard">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">STUDENT DASHBOARD</h1>
        <p className="text-base text-zinc-600">Welcome, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="border border-zinc-200 p-6" data-testid="attendance-stat">
          <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-2">Overall Attendance</div>
          <div className={`text-5xl font-black ${parseFloat(overallPercentage) >= 75 ? 'text-black' : 'text-[#FF2A2A]'}`}>{overallPercentage}%</div>
        </div>
        <div className="border border-zinc-200 p-6" data-testid="subjects-stat">
          <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-2">Subjects</div>
          <div className="text-5xl font-black">{attendance.length}</div>
        </div>
        <div className="border border-zinc-200 p-6">
          <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-2">Classes Attended</div>
          <div className="text-5xl font-black">{attendance.reduce((s, a) => s + a.present, 0)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button key={card.label} onClick={() => navigate(card.path)} className="border border-zinc-200 p-6 hover:border-black duration-150 text-left" data-testid={`nav-${card.label.toLowerCase().replace(/ /g, '-')}`}>
              <Icon size={24} className="text-[#002FA7] mb-3" />
              <div className="font-black text-sm">{card.label}</div>
              <p className="text-xs text-zinc-400 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {attendance.length > 0 && (
        <div className="border border-zinc-200 p-6">
          <h2 className="text-2xl font-black tracking-tight mb-4">ATTENDANCE BREAKDOWN</h2>
          <div className="space-y-3">
            {attendance.map((a) => (
              <div key={a.subject?.id} className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <span className="font-bold">{a.subject?.subject_name}</span>
                  <span className="text-sm text-zinc-400 ml-3">{a.subject?.subject_code}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-400">{a.present}/{a.total_classes} classes</span>
                  <span className={`font-black ${a.percentage >= 75 ? 'text-black' : 'text-[#FF2A2A]'}`}>{a.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
