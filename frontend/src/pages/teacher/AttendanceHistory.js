import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, History, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const AttendanceHistory = () => {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [modifySession, setModifySession] = useState(null);
  const [sessionRecords, setSessionRecords] = useState([]);

  useEffect(() => { fetchSubjects(); fetchHistory(); }, []);

  const fetchSubjects = async () => {
    try { const { data } = await api.get('/api/teacher/subjects'); setSubjects(data); } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSubject) params.set('subject_id', selectedSubject);
      if (filterDate) params.set('date', filterDate);
      const { data } = await api.get(`/api/teacher/attendance/history?${params.toString()}`);
      setSessions(data);
    } catch (e) { toast.error('Failed to fetch history'); }
  };

  const downloadCSV = async (subjectId) => {
    try {
      const params = new URLSearchParams({ subject_id: subjectId });
      if (filterDate) params.set('date', filterDate);
      const response = await api.get(`/api/teacher/attendance/csv?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'attendance.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV downloaded');
    } catch (e) { toast.error('Failed to download CSV'); }
  };

  const openModify = async (session) => {
    try {
      const { data } = await api.get(`/api/teacher/attendance/records/${session.id}`);
      setModifySession(session);
      setSessionRecords(data.records || []);
    } catch (e) { toast.error('Failed to load records'); }
  };

  const handleModifyStatus = async (studentId, newStatus) => {
    try {
      await api.post(`/api/teacher/attendance/modify/${modifySession.id}`, {
        student_id: studentId,
        status: newStatus
      });
      toast.success('Attendance updated');
      // Refresh records
      const { data } = await api.get(`/api/teacher/attendance/records/${modifySession.id}`);
      setSessionRecords(data.records || []);
    } catch (e) { toast.error('Failed to modify attendance'); }
  };

  return (
    <div className="p-8" data-testid="attendance-history-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">ATTENDANCE HISTORY</h1>
        <p className="text-base text-zinc-600">View and modify past attendance sessions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 border border-zinc-200 p-4">
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Subject</Label>
          <Select onValueChange={(v) => setSelectedSubject(v)}>
            <SelectTrigger className="rounded-none" data-testid="history-subject-select"><SelectValue placeholder="All Subjects" /></SelectTrigger>
            <SelectContent>
              {subjects.map((a) => <SelectItem key={a.subject_id} value={a.subject_id}>{a.subject?.subject_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Date</Label>
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="rounded-none" data-testid="history-date-filter" />
        </div>
        <div className="flex items-end">
          <Button onClick={fetchHistory} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none w-full font-bold uppercase" data-testid="search-history-button">SEARCH</Button>
        </div>
        <div className="flex items-end">
          {selectedSubject && <Button onClick={() => downloadCSV(selectedSubject)} variant="outline" className="rounded-none border-black w-full font-bold uppercase" data-testid="download-csv-button"><Download size={16} className="mr-2" /> CSV</Button>}
        </div>
      </div>

      <div className="border border-zinc-200 overflow-hidden">
        <table className="w-full" data-testid="history-table">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Date</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Subject</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Class</th>
              <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Present</th>
              <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Absent</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Status</th>
              <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-zinc-200 hover:bg-zinc-50" data-testid="history-row">
                <td className="p-4 text-sm">{s.created_at?.substring(0, 10)}</td>
                <td className="p-4 font-medium">{s.subject?.subject_name || '-'}</td>
                <td className="p-4 text-sm">{s.branch} SEM{s.semester} SEC{s.section}</td>
                <td className="p-4 text-right text-green-700 font-bold">{s.present_count}</td>
                <td className="p-4 text-right text-[#FF2A2A] font-bold">{s.absent_count}</td>
                <td className="p-4"><span className={`text-xs uppercase font-bold ${s.is_active ? 'text-green-700' : 'text-zinc-400'}`}>{s.is_active ? 'ACTIVE' : 'CLOSED'}</span></td>
                <td className="p-4 text-right">
                  <button onClick={() => openModify(s)} className="p-2 hover:bg-zinc-100 duration-150" data-testid="modify-attendance-button"><Pencil size={16} /></button>
                  <button onClick={() => downloadCSV(s.subject_id)} className="p-2 hover:bg-zinc-100 duration-150" data-testid="download-session-csv"><Download size={16} /></button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-zinc-400">No attendance sessions found</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!modifySession} onOpenChange={() => setModifySession(null)}>
        <DialogContent className="max-w-2xl bg-white border-4 border-black rounded-none" data-testid="modify-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">MODIFY ATTENDANCE</DialogTitle>
            <p className="text-sm text-zinc-600">{modifySession?.subject?.subject_name} | {modifySession?.created_at?.substring(0, 10)}</p>
          </DialogHeader>
          <div className="border border-zinc-200 overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">USN</th>
                  <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Name</th>
                  <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Status</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessionRecords.map((r) => (
                  <tr key={r.student_id} className="border-b border-zinc-200" data-testid="modify-row">
                    <td className="p-3 font-medium">{r.usn}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3"><span className={`text-xs uppercase font-bold ${r.status === 'Present' ? 'text-green-700' : r.status === 'Absent' ? 'text-[#FF2A2A]' : 'text-zinc-400'}`}>{r.status}</span></td>
                    <td className="p-3 text-right flex justify-end gap-2">
                      <Button size="sm" onClick={() => handleModifyStatus(r.student_id, 'Present')} className={`rounded-none text-xs ${r.status === 'Present' ? 'bg-green-700' : 'bg-zinc-200 text-black hover:bg-green-100'}`}>P</Button>
                      <Button size="sm" onClick={() => handleModifyStatus(r.student_id, 'Absent')} className={`rounded-none text-xs ${r.status === 'Absent' ? 'bg-[#FF2A2A]' : 'bg-zinc-200 text-black hover:bg-red-100'}`}>A</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceHistory;
