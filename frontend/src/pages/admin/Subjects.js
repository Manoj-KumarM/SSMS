import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Link } from 'lucide-react';
import { toast } from 'sonner';

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [assignData, setAssignData] = useState({ teacher_id: '', subject_id: '' });
  const [assignments, setAssignments] = useState([]);
  const [formData, setFormData] = useState({ subject_name: '', subject_code: '', branch: '', semester: '', section: '' });

  useEffect(() => { fetchSubjects(); fetchTeachers(); }, []);

  const fetchSubjects = async () => {
    try { const { data } = await api.get('/api/admin/subjects'); setSubjects(data); } catch (e) { toast.error('Failed to fetch subjects'); }
  };
  const fetchTeachers = async () => {
    try { const { data } = await api.get('/api/admin/teachers'); setTeachers(data); } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, semester: parseInt(formData.semester) };
      if (editingSubject) {
        await api.put(`/api/admin/subjects/${editingSubject.id}`, payload);
        toast.success('Subject updated');
      } else {
        await api.post('/api/admin/subjects', payload);
        toast.success('Subject created');
      }
      setIsDialogOpen(false);
      setEditingSubject(null);
      setFormData({ subject_name: '', subject_code: '', branch: '', semester: '', section: '' });
      fetchSubjects();
    } catch (error) { toast.error(error.response?.data?.detail || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    try { await api.delete(`/api/admin/subjects/${id}`); toast.success('Subject deleted'); fetchSubjects(); } catch (e) { toast.error('Failed to delete subject'); }
  };

  const handleAssign = async () => {
    try {
      await api.post('/api/admin/assign-subject', assignData);
      toast.success('Subject assigned to teacher');
      setIsAssignOpen(false);
      setAssignData({ teacher_id: '', subject_id: '' });
    } catch (error) { toast.error(error.response?.data?.detail || 'Assignment failed'); }
  };

  return (
    <div className="p-8" data-testid="subjects-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">SUBJECTS</h1>
          <p className="text-base text-zinc-600">Manage subjects and assignments</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setIsAssignOpen(true)} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="assign-subject-button">
            <Link size={18} className="mr-2" /> ASSIGN TO TEACHER
          </Button>
          <Button onClick={() => { setEditingSubject(null); setFormData({ subject_name: '', subject_code: '', branch: '', semester: '', section: '' }); setIsDialogOpen(true); }} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase" data-testid="add-subject-button">
            <Plus size={18} className="mr-2" /> ADD SUBJECT
          </Button>
        </div>
      </div>

      <div className="border border-zinc-200 overflow-hidden">
        <table className="w-full" data-testid="subjects-table">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Code</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Name</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Branch</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Sem</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Section</th>
              <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.id} className="border-b border-zinc-200 hover:bg-zinc-50" data-testid="subject-row">
                <td className="p-4 font-medium">{subject.subject_code}</td>
                <td className="p-4">{subject.subject_name}</td>
                <td className="p-4">{subject.branch}</td>
                <td className="p-4">{subject.semester}</td>
                <td className="p-4">{subject.section}</td>
                <td className="p-4 text-right">
                  <button onClick={() => { setEditingSubject(subject); setFormData({ subject_name: subject.subject_name, subject_code: subject.subject_code, branch: subject.branch, semester: String(subject.semester), section: subject.section }); setIsDialogOpen(true); }} className="p-2 hover:bg-zinc-100"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(subject.id)} className="p-2 hover:bg-red-50 text-[#FF2A2A]"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-zinc-400">No subjects found</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white border-4 border-black rounded-none">
          <DialogHeader><DialogTitle className="text-2xl font-black">{editingSubject ? 'EDIT SUBJECT' : 'ADD SUBJECT'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label className="text-xs uppercase tracking-widest font-bold">Subject Name</Label><Input value={formData.subject_name} onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })} required className="rounded-none" data-testid="subject-name-input" /></div>
            <div><Label className="text-xs uppercase tracking-widest font-bold">Subject Code</Label><Input value={formData.subject_code} onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })} required={!editingSubject} disabled={!!editingSubject} className="rounded-none" data-testid="subject-code-input" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-xs uppercase tracking-widest font-bold">Branch</Label><Input value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} required className="rounded-none" data-testid="subject-branch-input" /></div>
              <div><Label className="text-xs uppercase tracking-widest font-bold">Semester</Label><Input type="number" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })} required className="rounded-none" data-testid="subject-semester-input" /></div>
              <div><Label className="text-xs uppercase tracking-widest font-bold">Section</Label><Input value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} required className="rounded-none" data-testid="subject-section-input" /></div>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" onClick={() => setIsDialogOpen(false)} variant="outline" className="rounded-none border-black">CANCEL</Button>
              <Button type="submit" className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none" data-testid="save-subject-button">{editingSubject ? 'UPDATE' : 'CREATE'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md bg-white border-4 border-black rounded-none" data-testid="assign-dialog">
          <DialogHeader><DialogTitle className="text-2xl font-black">ASSIGN SUBJECT</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest font-bold">Teacher</Label>
              <Select onValueChange={(v) => setAssignData({ ...assignData, teacher_id: v })}>
                <SelectTrigger className="rounded-none" data-testid="assign-teacher-select"><SelectValue placeholder="Select Teacher" /></SelectTrigger>
                <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest font-bold">Subject</Label>
              <Select onValueChange={(v) => setAssignData({ ...assignData, subject_id: v })}>
                <SelectTrigger className="rounded-none" data-testid="assign-subject-select"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" onClick={() => setIsAssignOpen(false)} variant="outline" className="rounded-none border-black">CANCEL</Button>
              <Button onClick={handleAssign} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none" data-testid="confirm-assign-button">ASSIGN</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Subjects;
