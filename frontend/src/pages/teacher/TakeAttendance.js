import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin, QrCode, X, Download, Check, RefreshCw, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const TakeAttendance = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchSubjects(); checkActiveSession(); }, []);

  const fetchSubjects = async () => {
    try { const { data } = await api.get('/api/teacher/subjects'); setSubjects(data); } catch (e) { console.error(e); }
  };

  const checkActiveSession = async () => {
    try {
      const { data } = await api.get('/api/teacher/attendance/active-session');
      if (data) {
        setActiveSession(data);
        fetchSubmissions(data.id);
      }
    } catch (e) { console.error(e); }
  };

  const fetchSubmissions = useCallback(async (sessionId) => {
    try { const { data } = await api.get(`/api/teacher/attendance/session/${sessionId}`); setSubmissions(data); } catch (e) { console.error(e); }
  }, []);

  const getLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGettingLocation(false); toast.success('Location captured'); },
        (err) => { setGettingLocation(false); toast.error('Failed to get location. Please enable GPS.'); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setGettingLocation(false);
      toast.error('Geolocation not supported');
    }
  };

  const generateQR = async () => {
    if (!selectedSubject || !location) { toast.error('Select subject and capture location first'); return; }
    setLoading(true);
    try {
      const subjectInfo = subjects.find(s => s.subject_id === selectedSubject)?.subject;
      const { data } = await api.post('/api/teacher/attendance/create-session', {
        subject_id: selectedSubject,
        branch: subjectInfo?.branch || '',
        semester: subjectInfo?.semester || 1,
        section: subjectInfo?.section || '',
        teacher_latitude: location.lat,
        teacher_longitude: location.lng
      });
      setActiveSession(data.session);
      setClassStudents(data.students || []);
      toast.success('QR Code generated! Students can now scan.');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create session'); }
    setLoading(false);
  };

  const closeSession = async () => {
    if (!activeSession) return;
    if (!window.confirm('Close this session? All students who did not submit will be marked ABSENT.')) return;
    try {
      const { data } = await api.post(`/api/teacher/attendance/close-session/${activeSession.id}`);
      toast.success(`Session closed. ${data.absent_count} students marked absent.`);
      setActiveSession(null);
      setSubmissions([]);
      setClassStudents([]);
      setLocation(null);
    } catch (error) { toast.error('Failed to close session'); }
  };

  const manualMark = async (studentId, status) => {
    if (!activeSession) return;
    try {
      await api.post(`/api/teacher/attendance/manual-mark/${activeSession.id}`, {
        student_id: studentId,
        status: status
      });
      toast.success(`Student marked as ${status}`);
      fetchSubmissions(activeSession.id);
    } catch (error) { toast.error('Failed to mark attendance'); }
  };

  const downloadCSV = async () => {
    if (!activeSession) return;
    try {
      const response = await api.get(`/api/teacher/attendance/csv?subject_id=${activeSession.subject_id}`, { responseType: 'blob' });
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

  // Auto-refresh submissions every 5 seconds when session is active
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => fetchSubmissions(activeSession.id), 5000);
    return () => clearInterval(interval);
  }, [activeSession, fetchSubmissions]);

  if (activeSession) {
    const submittedIds = submissions.filter(s => s.status === 'Present').map(s => s.student_id);
    
    return (
      <div className="p-8" data-testid="active-session-page">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">ATTENDANCE SESSION</h1>
            <p className="text-base text-zinc-600">
              {activeSession.subject?.subject_name || 'Subject'} | {activeSession.branch} | SEM {activeSession.semester} | SEC {activeSession.section}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={downloadCSV} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="download-csv-button">
              <Download size={18} className="mr-2" /> CSV
            </Button>
            <Button onClick={closeSession} className="bg-[#FF2A2A] hover:bg-red-700 text-white rounded-none font-bold uppercase" data-testid="close-session-button">
              <X size={18} className="mr-2" /> CLOSE SESSION
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="border-4 border-black p-8 flex flex-col items-center justify-center mb-6" data-testid="qr-code-display">
              <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-4">SCAN THIS QR CODE</div>
              <QRCodeSVG value={activeSession.session_code} size={280} level="H" />
              <div className="mt-4 text-3xl font-black tracking-[0.3em] text-[#002FA7]" data-testid="session-code">{activeSession.session_code}</div>
              <div className="mt-2 text-xs text-zinc-400">Session Code | Radius: {activeSession.allowed_radius}m</div>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-black">QR SUBMISSIONS ({submissions.length})</h2>
              <Button onClick={() => fetchSubmissions(activeSession.id)} variant="outline" className="rounded-none border-black text-sm" data-testid="refresh-button"><RefreshCw size={14} className="mr-1" /> REFRESH</Button>
            </div>
            <div className="border border-zinc-200 overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr className="border-b border-zinc-200">
                    <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Name</th>
                    <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">USN</th>
                    <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Dist</th>
                    <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="border-b border-zinc-200" data-testid="submission-row">
                      <td className="p-3 text-sm">{sub.student_name || '-'}</td>
                      <td className="p-3 text-sm">{sub.usn || '-'}</td>
                      <td className="p-3 text-sm">{sub.distance?.toFixed(1)}m</td>
                      <td className="p-3"><span className={`text-xs uppercase font-bold ${sub.status === 'Present' ? 'text-green-700' : 'text-[#FF2A2A]'}`}>{sub.status}</span></td>
                    </tr>
                  ))}
                  {submissions.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-zinc-400 text-sm">Waiting for students...</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <UserCheck size={20} className="text-[#002FA7]" />
              <h2 className="text-xl font-black">MANUAL MARKING ({classStudents.length} students)</h2>
            </div>
            <p className="text-sm text-zinc-600 mb-4">Use this for students with network issues</p>
            <div className="border border-zinc-200 overflow-hidden max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr className="border-b border-zinc-200">
                    <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">USN</th>
                    <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Name</th>
                    <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s) => {
                    const isPresent = submittedIds.includes(s.student_id);
                    return (
                      <tr key={s.student_id} className={`border-b border-zinc-200 ${isPresent ? 'bg-green-50' : ''}`} data-testid="manual-student-row">
                        <td className="p-3 font-medium text-sm">{s.usn}</td>
                        <td className="p-3 text-sm">{s.name}</td>
                        <td className="p-3 text-right">
                          {isPresent ? (
                            <span className="text-xs uppercase font-bold text-green-700">PRESENT (QR)</span>
                          ) : (
                            <Button size="sm" onClick={() => manualMark(s.student_id, 'Present')} className="rounded-none bg-[#002FA7] hover:bg-[#00227A] text-white text-xs" data-testid="manual-present-button">MARK PRESENT</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {classStudents.length === 0 && <tr><td colSpan="3" className="p-6 text-center text-zinc-400 text-sm">No students in this class</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="take-attendance-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">TAKE ATTENDANCE</h1>
        <p className="text-base text-zinc-600">QR + Location based attendance system (50m radius)</p>
      </div>

      <div className="max-w-xl space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold mb-2 block">SELECT SUBJECT</Label>
          <Select onValueChange={(v) => setSelectedSubject(v)}>
            <SelectTrigger className="rounded-none" data-testid="subject-select">
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((a) => (
                <SelectItem key={a.subject_id} value={a.subject_id}>
                  {a.subject?.subject_name} ({a.subject?.subject_code}) - {a.subject?.branch} SEM{a.subject?.semester} SEC{a.subject?.section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <MapPin size={20} className="text-[#002FA7]" />
              <div className="text-sm font-bold uppercase tracking-widest">LOCATION</div>
            </div>
            {location && <Check size={20} className="text-green-600" />}
          </div>
          {location ? (
            <div className="text-sm text-zinc-600 mb-4">Lat: {location.lat.toFixed(6)} | Lng: {location.lng.toFixed(6)}</div>
          ) : (
            <p className="text-sm text-zinc-400 mb-4">Click below to capture your current location</p>
          )}
          <Button onClick={getLocation} disabled={gettingLocation} variant="outline" className="rounded-none border-black w-full font-bold uppercase" data-testid="get-location-button">
            {gettingLocation ? 'GETTING LOCATION...' : location ? 'UPDATE LOCATION' : 'GET LOCATION'}
          </Button>
        </div>

        <Button onClick={generateQR} disabled={!selectedSubject || !location || loading} className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-14 font-bold uppercase tracking-wider text-lg" data-testid="generate-qr-button">
          <QrCode size={24} className="mr-3" /> {loading ? 'GENERATING...' : 'GENERATE QR CODE'}
        </Button>
      </div>
    </div>
  );
};

export default TakeAttendance;
