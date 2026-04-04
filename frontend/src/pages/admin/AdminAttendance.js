import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AdminAttendance = () => {
  const [stats, setStats] = useState([]);
  const [records, setRecords] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ branch: '', semester: '', section: '', date: '', subject_id: '' });
  const [view, setView] = useState('stats');

  useEffect(() => { fetchSubjects(); fetchStats(); }, []);

  const fetchSubjects = async () => {
    try { const { data } = await api.get('/api/admin/subjects'); setSubjects(data); } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.branch) params.set('branch', filters.branch);
      if (filters.semester) params.set('semester', filters.semester);
      if (filters.section) params.set('section', filters.section);
      const { data } = await api.get(`/api/admin/attendance/stats?${params.toString()}`);
      setStats(data);
    } catch (e) { toast.error('Failed to fetch attendance stats'); }
  };

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.date) params.set('date', filters.date);
      if (filters.subject_id) params.set('subject_id', filters.subject_id);
      if (filters.branch) params.set('branch', filters.branch);
      const { data } = await api.get(`/api/admin/attendance/records?${params.toString()}`);
      setRecords(data);
    } catch (e) { toast.error('Failed to fetch records'); }
  };

  return (
    <div className="p-8" data-testid="admin-attendance-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">ATTENDANCE REPORTS</h1>
        <p className="text-base text-zinc-600">View all students' attendance data</p>
      </div>

      <div className="flex gap-3 mb-6">
        <Button onClick={() => setView('stats')} className={`rounded-none font-bold uppercase ${view === 'stats' ? 'bg-[#002FA7] text-white' : 'bg-white text-black border border-black'}`} data-testid="view-stats-button">STATISTICS</Button>
        <Button onClick={() => { setView('records'); fetchRecords(); }} className={`rounded-none font-bold uppercase ${view === 'records' ? 'bg-[#002FA7] text-white' : 'bg-white text-black border border-black'}`} data-testid="view-records-button">RECORDS</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 border border-zinc-200 p-4">
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Branch</Label>
          <Input value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} placeholder="CSE" className="rounded-none" data-testid="filter-branch" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Semester</Label>
          <Input type="number" value={filters.semester} onChange={(e) => setFilters({ ...filters, semester: e.target.value })} placeholder="5" className="rounded-none" data-testid="filter-semester" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Section</Label>
          <Input value={filters.section} onChange={(e) => setFilters({ ...filters, section: e.target.value })} placeholder="A" className="rounded-none" data-testid="filter-section" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Date</Label>
          <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} className="rounded-none" data-testid="filter-date" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => { view === 'stats' ? fetchStats() : fetchRecords(); }} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none w-full font-bold uppercase" data-testid="apply-filter-button">FILTER</Button>
        </div>
      </div>

      {view === 'stats' ? (
        <div className="border border-zinc-200 overflow-hidden">
          <table className="w-full" data-testid="stats-table">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">USN</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Name</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Branch</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Sem</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Sec</th>
                <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Present</th>
                <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Absent</th>
                <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Total</th>
                <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">%</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.student_id} className="border-b border-zinc-200 hover:bg-zinc-50" data-testid="stat-row">
                  <td className="p-4 font-medium">{s.usn}</td>
                  <td className="p-4">{s.name}</td>
                  <td className="p-4">{s.branch}</td>
                  <td className="p-4">{s.semester}</td>
                  <td className="p-4">{s.section}</td>
                  <td className="p-4 text-right text-green-700 font-bold">{s.present}</td>
                  <td className="p-4 text-right text-[#FF2A2A] font-bold">{s.absent}</td>
                  <td className="p-4 text-right">{s.total}</td>
                  <td className="p-4 text-right"><span className={`font-black ${s.percentage >= 75 ? 'text-black' : 'text-[#FF2A2A]'}`}>{s.percentage}%</span></td>
                </tr>
              ))}
              {stats.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-zinc-400">No data found. Try different filters.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-zinc-200 overflow-hidden">
          <table className="w-full" data-testid="records-table">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Date</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">USN</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Name</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Subject</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-zinc-200 hover:bg-zinc-50" data-testid="record-row">
                  <td className="p-4 text-sm">{r.date?.substring(0, 10)}</td>
                  <td className="p-4 font-medium">{r.usn || '-'}</td>
                  <td className="p-4">{r.student_name || '-'}</td>
                  <td className="p-4">{r.subject_name || '-'} {r.subject_code ? `(${r.subject_code})` : ''}</td>
                  <td className="p-4"><span className={`text-xs uppercase font-bold ${r.status === 'Present' ? 'text-green-700' : 'text-[#FF2A2A]'}`}>{r.status}</span></td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-zinc-400">No records found. Try different filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAttendance;
