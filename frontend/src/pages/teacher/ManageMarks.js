import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, BarChart3, Check, Upload, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const ManageMarks = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [marksData, setMarksData] = useState({});
  const [remarksData, setRemarksData] = useState({});
  const [saving, setSaving] = useState(false);
  const [performanceView, setPerformanceView] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchExams(); }, []);

  const fetchExams = async () => {
    try { const { data } = await api.get('/api/teacher/exams'); setExams(data); } catch (e) { console.error(e); }
  };

  const loadStudents = async (exam, subjectId) => {
    try {
      const { data } = await api.get(`/api/teacher/exam-marks/${exam.id}/${subjectId}`);
      setStudents(data.students || []);
      const marks = {}; const remarks = {};
      (data.students || []).forEach(s => {
        if (s.marks_obtained !== null && s.marks_obtained !== undefined) marks[s.student_id] = String(s.marks_obtained);
        if (s.remarks) remarks[s.student_id] = s.remarks;
      });
      setMarksData(marks);
      setRemarksData(remarks);
    } catch (e) { toast.error('Failed to load students'); }
  };

  const handleExamSelect = (examId) => {
    const exam = exams.find(e => e.id === examId);
    setSelectedExam(exam);
    setSelectedSubject(null);
    setStudents([]);
    setMarksData({});
    setRemarksData({});
    setCsvResult(null);
  };

  const handleSubjectSelect = (subjectId) => {
    setSelectedSubject(subjectId);
    setCsvResult(null);
    if (selectedExam) loadStudents(selectedExam, subjectId);
  };

  const updateMark = (studentId, value) => {
    if (value === '') { setMarksData(prev => ({ ...prev, [studentId]: '' })); return; }
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= (selectedExam?.max_marks || 100)) {
      setMarksData(prev => ({ ...prev, [studentId]: value }));
    }
  };

  const saveBulkMarks = async () => {
    if (!selectedExam || !selectedSubject) return;
    setSaving(true);
    const entries = [];
    for (const s of students) {
      const val = marksData[s.student_id];
      if (val !== undefined && val !== '') {
        entries.push({
          student_id: s.student_id,
          marks_obtained: parseFloat(val),
          remarks: remarksData[s.student_id] || ''
        });
      }
    }
    if (entries.length === 0) { toast.error('Enter marks for at least one student'); setSaving(false); return; }
    try {
      const { data } = await api.post('/api/teacher/exam-marks/bulk', {
        exam_id: selectedExam.id,
        subject_id: selectedSubject,
        entries
      });
      toast.success(data.message);
      if (data.errors?.length > 0) toast.error(`Errors: ${data.errors.join(', ')}`);
      loadStudents(selectedExam, selectedSubject);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to save marks'); }
    setSaving(false);
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedExam || !selectedSubject) {
      toast.error('Select an exam and subject first');
      return;
    }
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are accepted');
      return;
    }

    setCsvUploading(true);
    setCsvResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(
        `/api/teacher/exam-marks/csv-upload?exam_id=${selectedExam.id}&subject_id=${selectedSubject}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setCsvResult(data);
      toast.success(data.message);
      loadStudents(selectedExam, selectedSubject);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'CSV upload failed');
    }
    setCsvUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadCsvTemplate = () => {
    const csv = 'USN,Marks,Remarks\n';
    const rows = students.map(s => `${s.usn},,`).join('\n');
    const blob = new Blob([csv + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks_template_${selectedExam?.exam_name || 'exam'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const viewPerformance = async (exam) => {
    try {
      const { data } = await api.get(`/api/teacher/exam-performance/${exam.id}`);
      setPerformance(data); setPerformanceView(exam);
    } catch (e) { toast.error('Failed to load performance'); }
  };

  if (performanceView && performance) {
    return (
      <div className="p-8" data-testid="teacher-performance-view">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">{performanceView.exam_name}</h1>
            <p className="text-base text-zinc-600">Class Performance Summary</p>
          </div>
          <Button onClick={() => { setPerformanceView(null); setPerformance(null); }} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="back-from-performance">BACK</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {performance.subject_stats.map((s, i) => (
            <div key={i} className="border border-zinc-200 p-6" data-testid="perf-card">
              <h3 className="font-black text-lg mb-1">{s.subject_name}</h3>
              <p className="text-xs text-zinc-400 mb-4">{s.subject_code} | {s.students_count} students</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs uppercase tracking-widest font-bold text-zinc-400 block">Average</span><span className="text-2xl font-black">{s.average}</span></div>
                <div><span className="text-xs uppercase tracking-widest font-bold text-zinc-400 block">Highest</span><span className="text-2xl font-black text-green-700">{s.highest}</span></div>
                <div><span className="text-xs uppercase tracking-widest font-bold text-zinc-400 block">Lowest</span><span className="text-2xl font-black text-[#FF2A2A]">{s.lowest}</span></div>
                <div><span className="text-xs uppercase tracking-widest font-bold text-zinc-400 block">Pass/Fail</span><span className="text-2xl font-black"><span className="text-green-700">{s.pass_count}</span>/<span className="text-[#FF2A2A]">{s.fail_count}</span></span></div>
              </div>
            </div>
          ))}
          {performance.subject_stats.length === 0 && <div className="text-zinc-400 p-6">No performance data yet</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="manage-marks-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">MANAGE MARKS</h1>
        <p className="text-base text-zinc-600">Enter and manage exam marks for your subjects</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border border-zinc-200 p-4">
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Select Exam</Label>
          <Select onValueChange={handleExamSelect}>
            <SelectTrigger className="rounded-none" data-testid="exam-select"><SelectValue placeholder="Choose exam" /></SelectTrigger>
            <SelectContent>
              {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.exam_name} ({e.exam_type}) - {e.branch} SEM{e.semester}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedExam && (
          <div>
            <Label className="text-xs uppercase tracking-widest font-bold">Select Subject</Label>
            <Select onValueChange={handleSubjectSelect}>
              <SelectTrigger className="rounded-none" data-testid="subject-select"><SelectValue placeholder="Choose subject" /></SelectTrigger>
              <SelectContent>
                {selectedExam.subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {exams.length > 0 && !selectedExam && (
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl font-black">YOUR EXAMS</h2>
          {exams.map(exam => (
            <div key={exam.id} className="border border-zinc-200 p-4 flex items-center justify-between hover:border-black duration-150" data-testid="exam-item">
              <div>
                <span className="font-black">{exam.exam_name}</span>
                <span className="text-xs uppercase tracking-widest font-bold text-zinc-400 ml-3">{exam.exam_type} | {exam.date} | Max: {exam.max_marks}</span>
              </div>
              <Button onClick={() => viewPerformance(exam)} size="sm" variant="outline" className="rounded-none border-black text-xs" data-testid="view-performance-button"><BarChart3 size={14} className="mr-1" /> PERFORMANCE</Button>
            </div>
          ))}
        </div>
      )}

      {students.length > 0 && selectedExam && selectedSubject && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-black">ENTER MARKS</h2>
              <p className="text-sm text-zinc-600">Max: {selectedExam.max_marks} | {students.length} students</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={downloadCsvTemplate} variant="outline" className="rounded-none border-black text-xs font-bold uppercase" data-testid="download-csv-template">
                <FileText size={14} className="mr-1" /> TEMPLATE
              </Button>
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  data-testid="csv-upload-input"
                />
                <Button variant="outline" className="rounded-none border-black text-xs font-bold uppercase pointer-events-none" disabled={csvUploading}>
                  <Upload size={14} className="mr-1" /> {csvUploading ? 'UPLOADING...' : 'CSV UPLOAD'}
                </Button>
              </div>
              <Button onClick={saveBulkMarks} disabled={saving} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase" data-testid="save-all-marks-button">
                <Save size={18} className="mr-2" /> {saving ? 'SAVING...' : 'SAVE ALL'}
              </Button>
            </div>
          </div>

          {csvResult && (
            <div className={`mb-4 p-4 border ${csvResult.failed_count > 0 ? 'border-yellow-400 bg-yellow-50' : 'border-green-400 bg-green-50'}`} data-testid="csv-result">
              <p className="font-bold text-sm">{csvResult.message}</p>
              {csvResult.failed_count > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-bold text-yellow-700 flex items-center gap-1"><AlertTriangle size={14} /> {csvResult.failed_count} rows failed:</p>
                  <ul className="text-xs mt-1 space-y-1">
                    {csvResult.failed_rows.map((f, i) => (
                      <li key={i} className="text-yellow-800">Row {f.row}: {f.usn ? `USN ${f.usn} - ` : ''}{f.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="border border-zinc-200 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b bg-zinc-50">
                <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">USN</th>
                <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Name</th>
                <th className="p-3 text-left text-xs uppercase tracking-widest font-bold w-32">Marks</th>
                <th className="p-3 text-left text-xs uppercase tracking-widest font-bold">Remarks</th>
                <th className="p-3 text-center text-xs uppercase tracking-widest font-bold w-16">Saved</th>
              </tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.student_id} className="border-b border-zinc-200" data-testid="student-marks-row">
                    <td className="p-3 font-medium">{s.usn}</td>
                    <td className="p-3">{s.name}</td>
                    <td className="p-3">
                      <Input
                        type="number"
                        min="0"
                        max={selectedExam.max_marks}
                        value={marksData[s.student_id] || ''}
                        onChange={(e) => updateMark(s.student_id, e.target.value)}
                        className="rounded-none w-28"
                        placeholder={`/ ${selectedExam.max_marks}`}
                        data-testid={`marks-input-${s.usn}`}
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        value={remarksData[s.student_id] || ''}
                        onChange={(e) => setRemarksData(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                        className="rounded-none"
                        placeholder="Optional remarks"
                        data-testid={`remarks-input-${s.usn}`}
                      />
                    </td>
                    <td className="p-3 text-center">
                      {s.marks_obtained !== null && s.marks_obtained !== undefined && <Check size={16} className="text-green-600 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMarks;
