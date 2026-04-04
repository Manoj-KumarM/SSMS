import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ students: 0, teachers: 0, subjects: 0 });
  const navigate = useNavigate();

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const [studentsRes, teachersRes, subjectsRes] = await Promise.all([
        api.get('/api/admin/students'),
        api.get('/api/admin/teachers'),
        api.get('/api/admin/subjects')
      ]);
      setStats({
        students: studentsRes.data.length,
        teachers: teachersRes.data.length,
        subjects: subjectsRes.data.length
      });
    } catch (error) { console.error('Failed to fetch stats:', error); }
  };

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: GraduationCap },
    { label: 'Total Teachers', value: stats.teachers, icon: Users },
    { label: 'Total Subjects', value: stats.subjects, icon: BookOpen }
  ];

  return (
    <div className="p-8" data-testid="admin-dashboard">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2" data-testid="dashboard-title">ADMIN DASHBOARD</h1>
        <p className="text-base text-zinc-600">Manage your college system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-zinc-200 p-6 bg-white hover:border-black duration-150" data-testid={`stat-${stat.label.toLowerCase().replace(/ /g, '-')}`}>
              <div className="mb-4"><Icon size={24} strokeWidth={2} className="text-[#002FA7]" /></div>
              <div className="text-4xl font-black mb-2">{stat.value}</div>
              <div className="text-xs uppercase tracking-widest font-bold text-zinc-600">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="border border-zinc-200 p-6">
        <h2 className="text-2xl font-black tracking-tight mb-4">QUICK ACTIONS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button onClick={() => navigate('/admin/students')} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-12 font-bold uppercase tracking-wider duration-150" data-testid="manage-students-button">Manage Students</Button>
          <Button onClick={() => navigate('/admin/teachers')} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-12 font-bold uppercase tracking-wider duration-150" data-testid="manage-teachers-button">Manage Teachers</Button>
          <Button onClick={() => navigate('/admin/announcements')} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-12 font-bold uppercase tracking-wider duration-150" data-testid="create-announcement-button">Create Announcement</Button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
