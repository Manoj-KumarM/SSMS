import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  useEffect(() => { fetchTeachers(); }, []);

  const fetchTeachers = async () => {
    try {
      const { data } = await api.get('/api/admin/teachers');
      setTeachers(data);
    } catch (error) { toast.error('Failed to fetch teachers'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTeacher) {
        await api.put(`/api/admin/teachers/${editingTeacher.id}`, { name: formData.name, phone: formData.phone });
        toast.success('Teacher updated');
      } else {
        await api.post('/api/admin/teachers', formData);
        toast.success('Teacher created (default password: teacher123)');
      }
      setIsDialogOpen(false);
      setEditingTeacher(null);
      setFormData({ name: '', email: '', phone: '' });
      fetchTeachers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher?')) return;
    try {
      await api.delete(`/api/admin/teachers/${id}`);
      toast.success('Teacher deleted');
      fetchTeachers();
    } catch (error) { toast.error('Failed to delete teacher'); }
  };

  return (
    <div className="p-8" data-testid="teachers-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">TEACHERS</h1>
          <p className="text-base text-zinc-600">Manage teacher accounts</p>
        </div>
        <Button onClick={() => { setEditingTeacher(null); setFormData({ name: '', email: '', phone: '' }); setIsDialogOpen(true); }} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase" data-testid="add-teacher-button">
          <Plus size={18} className="mr-2" /> ADD TEACHER
        </Button>
      </div>

      <div className="border border-zinc-200 overflow-hidden">
        <table className="w-full" data-testid="teachers-table">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Name</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Email</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Phone</th>
              <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id} className="border-b border-zinc-200 hover:bg-zinc-50" data-testid="teacher-row">
                <td className="p-4 font-medium">{teacher.name}</td>
                <td className="p-4 text-sm text-zinc-600">{teacher.email}</td>
                <td className="p-4">{teacher.phone}</td>
                <td className="p-4 text-right">
                  <button onClick={() => { setEditingTeacher(teacher); setFormData({ name: teacher.name || '', email: teacher.email || '', phone: teacher.phone || '' }); setIsDialogOpen(true); }} className="p-2 hover:bg-zinc-100 duration-150" data-testid="edit-teacher-button"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(teacher.id)} className="p-2 hover:bg-red-50 text-[#FF2A2A] duration-150" data-testid="delete-teacher-button"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-zinc-400">No teachers found</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white border-4 border-black rounded-none" data-testid="teacher-dialog">
          <DialogHeader><DialogTitle className="text-2xl font-black">{editingTeacher ? 'EDIT TEACHER' : 'ADD TEACHER'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label className="text-xs uppercase tracking-widest font-bold">Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="rounded-none" data-testid="teacher-name-input" /></div>
            {!editingTeacher && <div><Label className="text-xs uppercase tracking-widest font-bold">Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="rounded-none" data-testid="teacher-email-input" /></div>}
            <div><Label className="text-xs uppercase tracking-widest font-bold">Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required className="rounded-none" data-testid="teacher-phone-input" /></div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" onClick={() => setIsDialogOpen(false)} variant="outline" className="rounded-none border-black">CANCEL</Button>
              <Button type="submit" className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none" data-testid="save-teacher-button">{editingTeacher ? 'UPDATE' : 'CREATE'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Teachers;
