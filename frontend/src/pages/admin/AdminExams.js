import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Download, BarChart3, Trophy, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const AdminExams = () => {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [analyticsExam, setAnalyticsExam] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [marksView, setMarksView] = useState(null);
  const [marksList, setMarksList] = useState([]);
  const [editingExam, setEditingExam] = useState(null);
  const [formData, setFormData] = useState({
    exam_name: '', exam_type: 'Midterm', date: '', branch: '', semester: '', section: '', subject_ids: [], max_marks: '100'
  });

  useEffect(() => { fetchExams(); fetchSubjects(); }, []);

  const fetchExams = async () => {
    try { const { data } = await api.get('/api/admin/exams'); setExams(data); } catch (e) { toast.error('Failed to fetch exams'); }
  };
  const fetchSubjects = async () => {
    try { const { data } = await api.get('/api/admin/subjects'); setSubjects(data); } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, semester: parseInt(formData.semester), max_marks: parseFloat(formData.max_marks) };
      if (editingExam) {
        await api.put(`/api/admin/exams/${editingExam.id}`, { exam_name: payload.exam_name, exam_type: payload.exam_type, date: payload.date, max_marks: payload.max_marks });
        toast.success('Exam updated');
      } else {
        if (payload.subject_ids.length === 0) { toast.error('Select at least one subject'); return; }
        await api.post('/api/admin/exams', payload);
        toast.success('Exam created');
      }
      setIsDialogOpen(false); setEditingExam(null);
      setFormData({ exam_name: '', exam_type: 'Midterm', date: '', branch: '', semester: '', section: '', subject_ids: [], max_marks: '100' });
      fetchExams();
    } catch (error) { toast.error(error.response?.data?.detail || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam and all associated marks?')) return;
    try { await api.delete(`/api/admin/exams/${id}`); toast.success('Exam deleted'); fetchExams(); } catch (e) { toast.error('Failed'); }
  };

  const viewAnalytics = async (exam) => {
    try {
      const { data } = await api.get(`/api/admin/exam-analytics?exam_id=${exam.id}`);
      setAnalytics(data); setAnalyticsExam(exam);
    } catch (e) { toast.error('Failed to load analytics'); }
  };

  const viewMarks = async (exam) => {
    try {
      const { data } = await api.get(`/api/admin/exam-marks?exam_id=${exam.id}`);
      setMarksList(data); setMarksView(exam);
    } catch (e) { toast.error('Failed to load marks'); }
  };

  const downloadCSV = async (examId) => {
    try {
      const response = await api.get(`/api/admin/exam-marks/csv?exam_id=${examId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'exam_marks.csv');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('CSV downloaded');
    } catch (e) { toast.error('Failed to download CSV'); }
  };

  const toggleSubject = (sid) => {
    setFormData(prev => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(sid)
        ? prev.subject_ids.filter(id => id !== sid)
        : [...prev.subject_ids, sid]
    }));
  };

  const filteredSubjects = subjects.filter(s =>
    (!formData.branch || s.branch === formData.branch) &&
    (!formData.semester || s.semester === parseInt(formData.semester)) &&
    (!formData.section || s.section === formData.section)
  );

  // Analytics view
  if (analyticsExam && analytics) {
    return (
      <div className="p-8" data-testid="exam-analytics-page">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">{analyticsExam.exam_name}</h1>
            <p className="text-base text-zinc-600">{analyticsExam.exam_type} | {analyticsExam.branch} SEM{analyticsExam.semester} SEC{analyticsExam.section} | {analyticsExam.date}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => downloadCSV(analyticsExam.id)} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="download-analytics-csv"><Download size={16} className="mr-2" /> CSV</Button>
            <Button onClick={() => { setAnalyticsExam(null); setAnalytics(null); }} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="back-button">BACK</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="border border-zinc-200 p-6" data-testid="total-students-stat">
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-2">Total Students</div>
            <div className="text-4xl font-black">{analytics.overall.total_students}</div>
          </div>
          <div className="border border-zinc-200 p-6" data-testid="pass-stat">
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-2">Passed</div>
            <div className="text-4xl font-black text-green-700">{analytics.overall.pass_count}</div>
          </div>
          <div className="border border-zinc-200 p-6" data-testid="fail-stat">
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-2">Failed</div>
            <div className="text-4xl font-black text-[#FF2A2A]">{analytics.overall.fail_count}</div>
          </div>
          <div className="border border-zinc-200 p-6" data-testid="pass-pct-stat">
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-400 mb-2">Pass Rate</div>
            <div className="text-4xl font-black text-[#002FA7]">{analytics.overall.pass_percentage}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2"><TrendingUp size={24} /> SUBJECT STATS</h2>
            <div className="border border-zinc-200 overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b bg-zinc-50">
                  <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Subject</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Avg</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">High</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Low</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Pass</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Fail</th>
                </tr></thead>
                <tbody>
                  {analytics.subject_stats.map((s, i) => (
                    <tr key={i} className="border-b border-zinc-200" data-testid="subject-stat-row">
                      <td className="p-3 font-medium text-sm">{s.subject_name}<br/><span className="text-xs text-zinc-400">{s.subject_code}</span></td>
                      <td className="p-3 text-right font-bold">{s.average}</td>
                      <td className="p-3 text-right text-green-700">{s.highest}</td>
                      <td className="p-3 text-right text-[#FF2A2A]">{s.lowest}</td>
                      <td className="p-3 text-right text-green-700">{s.pass_count}</td>
                      <td className="p-3 text-right text-[#FF2A2A]">{s.fail_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2"><Trophy size={24} /> CLASS TOPPERS</h2>
            <div className="border border-zinc-200 overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-50"><tr className="border-b">
                  <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">#</th>
                  <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Student</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Total</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">%</th>
                  <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Grade</th>
                </tr></thead>
                <tbody>
                  {analytics.all_students.map((s, i) => (
                    <tr key={s.student_id} className={`border-b border-zinc-200 ${i < 3 ? 'bg-yellow-50' : ''}`} data-testid="topper-row">
                      <td className="p-3 font-black">{i + 1}</td>
                      <td className="p-3"><span className="font-medium">{s.name}</span><br/><span className="text-xs text-zinc-400">{s.usn}</span></td>
                      <td className="p-3 text-right">{s.total_obtained}/{s.total_max}</td>
                      <td className="p-3 text-right font-bold">{s.percentage}%</td>
                      <td className="p-3 text-right"><span className={`font-black ${s.grade === 'F' ? 'text-[#FF2A2A]' : 'text-[#002FA7]'}`}>{s.grade}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Marks view
  if (marksView) {
    return (
      <div className="p-8" data-testid="exam-marks-view">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">{marksView.exam_name} - MARKS</h1>
            <p className="text-base text-zinc-600">{marksView.exam_type} | Max: {marksView.max_marks}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => downloadCSV(marksView.id)} variant="outline" className="rounded-none border-black font-bold uppercase"><Download size={16} className="mr-2" /> CSV</Button>
            <Button onClick={() => { setMarksView(null); setMarksList([]); }} variant="outline" className="rounded-none border-black font-bold uppercase">BACK</Button>
          </div>
        </div>
        <div className="border border-zinc-200 overflow-hidden">
          <table className="w-full" data-testid="marks-table">
            <thead><tr className="border-b bg-zinc-50">
              <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">USN</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Student</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Subject</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Marks</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">%</th>
              <th className="p-3 text-right text-xs uppercase tracking-widest font-bold">Grade</th>
              <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Remarks</th>
            </tr></thead>
            <tbody>
              {marksList.map((m) => (
                <tr key={m.id} className="border-b border-zinc-200" data-testid="mark-row">
                  <td className="p-3 font-medium">{m.usn || '-'}</td>
                  <td className="p-3">{m.student_name || '-'}</td>
                  <td className="p-3 text-sm">{m.subject_name || '-'} ({m.subject_code || '-'})</td>
                  <td className="p-3 text-right font-bold">{m.marks_obtained}/{m.max_marks}</td>
                  <td className="p-3 text-right">{m.percentage}%</td>
                  <td className="p-3 text-right"><span className={`font-black ${m.grade === 'F' ? 'text-[#FF2A2A]' : 'text-[#002FA7]'}`}>{m.grade}</span></td>
                  <td className="p-3 text-sm text-zinc-600">{m.remarks || '-'}</td>
                </tr>
              ))}
              {marksList.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-zinc-400">No marks entered yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="admin-exams-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">EXAMS & MARKS</h1>
          <p className="text-base text-zinc-600">Create exams, view marks, and performance analytics</p>
        </div>
        <Button onClick={() => { setEditingExam(null); setFormData({ exam_name: '', exam_type: 'Midterm', date: '', branch: '', semester: '', section: '', subject_ids: [], max_marks: '100' }); setIsDialogOpen(true); }} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase" data-testid="create-exam-button">
          <Plus size={18} className="mr-2" /> NEW EXAM
        </Button>
      </div>

      <div className="space-y-4">
        {exams.map((exam) => (
          <div key={exam.id} className="border border-zinc-200 p-6 hover:border-black duration-150" data-testid="exam-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-black">{exam.exam_name}</h3>
                  <span className="text-xs uppercase tracking-widest font-bold px-2 py-1 bg-zinc-100 border border-zinc-200">{exam.exam_type}</span>
                </div>
                <div className="flex gap-4 text-xs uppercase tracking-widest font-bold text-zinc-400">
                  <span>{exam.branch}</span><span>SEM {exam.semester}</span><span>SEC {exam.section}</span>
                  <span>{exam.date}</span><span>MAX: {exam.max_marks}</span>
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  Subjects: {exam.subjects?.map(s => s.subject_name).join(', ') || '-'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => viewAnalytics(exam)} size="sm" className="rounded-none bg-[#002FA7] hover:bg-[#00227A] text-white text-xs" data-testid="view-analytics-button"><BarChart3 size={14} className="mr-1" /> ANALYTICS</Button>
                <Button onClick={() => viewMarks(exam)} size="sm" variant="outline" className="rounded-none border-black text-xs" data-testid="view-marks-button">MARKS</Button>
                <Button onClick={() => downloadCSV(exam.id)} size="sm" variant="outline" className="rounded-none border-black text-xs" data-testid="download-exam-csv"><Download size={14} /></Button>
                <button onClick={() => { setEditingExam(exam); setFormData({ ...formData, exam_name: exam.exam_name, exam_type: exam.exam_type, date: exam.date, max_marks: String(exam.max_marks) }); setIsDialogOpen(true); }} className="p-2 hover:bg-zinc-100"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(exam.id)} className="p-2 hover:bg-red-50 text-[#FF2A2A]"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {exams.length === 0 && <div className="text-center p-12 text-zinc-400 border border-zinc-200">No exams created yet</div>}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg bg-white border-4 border-black rounded-none" data-testid="exam-dialog">
          <DialogHeader><DialogTitle className="text-2xl font-black">{editingExam ? 'EDIT EXAM' : 'CREATE EXAM'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs uppercase tracking-widest font-bold">Exam Name</Label><Input value={formData.exam_name} onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })} required className="rounded-none" data-testid="exam-name-input" /></div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Type</Label>
                <Select value={formData.exam_type} onValueChange={(v) => setFormData({ ...formData, exam_type: v })}>
                  <SelectTrigger className="rounded-none" data-testid="exam-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Midterm', 'Final', 'Unit Test', 'Quiz', 'Assignment', 'Practical'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs uppercase tracking-widest font-bold">Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required className="rounded-none" data-testid="exam-date-input" /></div>
              <div><Label className="text-xs uppercase tracking-widest font-bold">Max Marks</Label><Input type="number" value={formData.max_marks} onChange={(e) => setFormData({ ...formData, max_marks: e.target.value })} required className="rounded-none" data-testid="exam-max-marks-input" /></div>
            </div>
            {!editingExam && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label className="text-xs uppercase tracking-widest font-bold">Branch</Label><Input value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} required className="rounded-none" data-testid="exam-branch-input" /></div>
                  <div><Label className="text-xs uppercase tracking-widest font-bold">Semester</Label><Input type="number" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })} required className="rounded-none" data-testid="exam-semester-input" /></div>
                  <div><Label className="text-xs uppercase tracking-widest font-bold">Section</Label><Input value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} required className="rounded-none" data-testid="exam-section-input" /></div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest font-bold mb-2 block">Select Subjects</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-zinc-200 p-3">
                    {filteredSubjects.length === 0 && <p className="text-sm text-zinc-400">Enter branch, semester, section to see subjects</p>}
                    {filteredSubjects.map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.subject_ids.includes(s.id)} onChange={() => toggleSubject(s.id)} className="rounded-none" />
                        <span className="text-sm">{s.subject_name} ({s.subject_code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" onClick={() => setIsDialogOpen(false)} variant="outline" className="rounded-none border-black">CANCEL</Button>
              <Button type="submit" className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none" data-testid="save-exam-button">{editingExam ? 'UPDATE' : 'CREATE'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminExams;
