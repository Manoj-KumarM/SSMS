import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Megaphone } from 'lucide-react';
import { toast } from 'sonner';

const StudentAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async () => {
    try { const { data } = await api.get('/api/student/announcements'); setAnnouncements(data); } catch (e) { toast.error('Failed to fetch announcements'); }
  };

  return (
    <div className="p-8" data-testid="student-announcements-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">ANNOUNCEMENTS</h1>
        <p className="text-base text-zinc-600">College news and updates</p>
      </div>

      {announcements.length === 0 && (
        <div className="text-center p-12 text-zinc-400 border border-zinc-200">No announcements for your class</div>
      )}

      <div className="space-y-4">
        {announcements.map((a) => (
          <div key={a.id} className="border border-zinc-200 p-6 hover:border-black duration-150" data-testid="announcement-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#002FA7] flex items-center justify-center flex-shrink-0">
                <Megaphone size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black">{a.title}</h3>
                <p className="text-zinc-600 mt-1">{a.message}</p>
                <p className="text-xs text-zinc-400 mt-3">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentAnnouncements;
