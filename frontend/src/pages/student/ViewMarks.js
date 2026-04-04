import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

const ViewMarks = () => {
  const [examData, setExamData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMarks(); }, []);

  const fetchMarks = async () => {
    try {
      const { data } = await api.get('/api/student/exam-marks');
      setExamData(data);
    } catch (e) { toast.error('Failed to fetch marks'); }
    setLoading(false);
  };

  const downloadCSV = async (examId) => {
    try {
      const params = examId ? `?exam_id=${examId}` : '';
      const response = await api.get(`/api/student/report-card/csv${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'report_card.csv');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('CSV report downloaded');
    } catch (e) { toast.error('Failed to download CSV'); }
  };

  const downloadPDF = async (examId) => {
    try {
      const params = examId ? `?exam_id=${examId}` : '';
      const response = await api.get(`/api/student/report-card/pdf${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'report_card.pdf');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('PDF report downloaded');
    } catch (e) { toast.error('Failed to download PDF'); }
  };

  if (loading) return <div className="p-8"><div className="text-lg font-bold">LOADING...</div></div>;

  return (
    <div className="p-8" data-testid="view-marks-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">MY MARKS</h1>
          <p className="text-base text-zinc-600">Exam results and performance</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => downloadPDF(null)} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="download-all-pdf">
            <FileText size={18} className="mr-2" /> PDF
          </Button>
          <Button onClick={() => downloadCSV(null)} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="download-all-csv">
            <Download size={18} className="mr-2" /> CSV
          </Button>
        </div>
      </div>

      {examData.length === 0 && (
        <div className="text-center p-12 text-zinc-400 border border-zinc-200" data-testid="no-marks-message">No exam marks available yet</div>
      )}

      {examData.map((ed) => {
        const exam = ed.exam;
        if (!exam) return null;
        return (
          <div key={exam.id} className="mb-8 border border-zinc-200" data-testid="exam-result-card">
            <div className="bg-zinc-50 p-6 border-b border-zinc-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-black">{exam.exam_name}</h2>
                    <span className="text-xs uppercase tracking-widest font-bold px-2 py-1 bg-white border border-zinc-200">{exam.exam_type}</span>
                  </div>
                  <div className="flex gap-4 text-xs uppercase tracking-widest font-bold text-zinc-400">
                    <span>{exam.date}</span><span>Max: {exam.max_marks}/subject</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-widest font-bold text-zinc-400">Overall</div>
                    <div className={`text-3xl font-black ${ed.overall_grade === 'F' ? 'text-[#FF2A2A]' : 'text-[#002FA7]'}`}>{ed.overall_percentage}%</div>
                    <div className="text-sm font-bold">{ed.overall_grade} - {ed.overall_grade_label}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button onClick={() => downloadPDF(exam.id)} size="sm" variant="outline" className="rounded-none border-black" data-testid="download-exam-pdf">
                      <FileText size={14} className="mr-1" /> PDF
                    </Button>
                    <Button onClick={() => downloadCSV(exam.id)} size="sm" variant="outline" className="rounded-none border-black" data-testid="download-exam-csv">
                      <Download size={14} className="mr-1" /> CSV
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full">
              <thead><tr className="border-b border-zinc-200">
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Subject</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Code</th>
                <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Marks</th>
                <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">%</th>
                <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Grade</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Remarks</th>
              </tr></thead>
              <tbody>
                {ed.marks.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-200 hover:bg-zinc-50" data-testid="marks-row">
                    <td className="p-4 font-medium">{m.subject_name}</td>
                    <td className="p-4 text-sm text-zinc-400">{m.subject_code}</td>
                    <td className="p-4 text-right">
                      <span className="text-xl font-black">{m.marks_obtained}</span>
                      <span className="text-sm text-zinc-400">/{m.max_marks}</span>
                    </td>
                    <td className="p-4 text-right font-bold">{m.percentage}%</td>
                    <td className="p-4 text-right">
                      <span className={`text-lg font-black ${m.grade === 'F' ? 'text-[#FF2A2A]' : 'text-[#002FA7]'}`}>{m.grade}</span>
                      <div className="text-xs text-zinc-400">{m.grade_label}</div>
                    </td>
                    <td className="p-4 text-sm text-zinc-600">{m.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-zinc-50 p-4 flex justify-between items-center border-t border-zinc-200">
              <span className="text-sm font-bold uppercase tracking-widest text-zinc-400">Total</span>
              <span className="text-lg font-black">{ed.total_obtained}/{ed.total_max}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ViewMarks;
