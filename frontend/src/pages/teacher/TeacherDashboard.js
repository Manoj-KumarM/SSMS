import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QrCode, FileText, BookOpen, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TeacherDashboard = () => {
  const [subjects, setSubjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { fetchSubjects(); }, []);

  const fetchSubjects = async () => {
    try { const { data } = await api.get('/api/teacher/subjects'); setSubjects(data); } catch (e) { console.error(e); }
  };

  return (
    <div className="p-8" data-testid="teacher-dashboard">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">TEACHER DASHBOARD</h1>
        <p className="text-base text-zinc-600">Your teaching portal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <button onClick={() => navigate('/teacher/attendance')} className="border border-zinc-200 p-6 hover:border-black duration-150 text-left" data-testid="take-attendance-card">
          <QrCode size={32} className="text-[#002FA7] mb-4" />
          <div className="text-xl font-black">TAKE ATTENDANCE</div>
          <p className="text-sm text-zinc-600 mt-1">QR + Location</p>
        </button>
        <button onClick={() => navigate('/teacher/marks')} className="border border-zinc-200 p-6 hover:border-black duration-150 text-left" data-testid="manage-marks-card">
          <ClipboardList size={32} className="text-[#002FA7] mb-4" />
          <div className="text-xl font-black">UPLOAD MARKS</div>
          <p className="text-sm text-zinc-600 mt-1">Exam scores</p>
        </button>
        <button onClick={() => navigate('/teacher/notes')} className="border border-zinc-200 p-6 hover:border-black duration-150 text-left" data-testid="manage-notes-card">
          <FileText size={32} className="text-[#002FA7] mb-4" />
          <div className="text-xl font-black">UPLOAD NOTES</div>
          <p className="text-sm text-zinc-600 mt-1">Course materials</p>
        </button>
        <div className="border border-zinc-200 p-6">
          <BookOpen size={32} className="text-[#002FA7] mb-4" />
          <div className="text-xl font-black">{subjects.length}</div>
          <p className="text-xs uppercase tracking-widest font-bold text-zinc-600 mt-1">Assigned Subjects</p>
        </div>
      </div>

      {subjects.length > 0 && (
        <div className="border border-zinc-200 p-6">
          <h2 className="text-2xl font-black tracking-tight mb-4">MY SUBJECTS</h2>
          <div className="space-y-2">
            {subjects.map((a) => (
              <div key={a.id} className="flex justify-between items-center border-b border-zinc-100 py-3">
                <div>
                  <span className="font-bold">{a.subject?.subject_name}</span>
                  <span className="text-sm text-zinc-400 ml-3">{a.subject?.subject_code}</span>
                </div>
                <span className="text-xs uppercase tracking-widest text-zinc-400">{a.subject?.branch} | SEM {a.subject?.semester} | SEC {a.subject?.section}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
