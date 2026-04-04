import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    usn: '',
    branch: '',
    semester: '',
    section: '',
    email: '',
    phone: '',
    parent_phone: '',
    parent_email: ''
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/api/admin/students');
      setStudents(data);
    } catch (error) {
      toast.error('Failed to fetch students');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        await api.put(`/api/admin/students/${editingStudent.id}`, formData);
        toast.success('Student updated successfully');
      } else {
        await api.post('/api/admin/students', formData);
        toast.success('Student created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/api/admin/students/${id}`);
      toast.success('Student deleted successfully');
      fetchStudents();
    } catch (error) {
      toast.error('Failed to delete student');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      usn: '',
      branch: '',
      semester: '',
      section: '',
      email: '',
      phone: '',
      parent_phone: '',
      parent_email: ''
    });
    setEditingStudent(null);
  };

  const openEditDialog = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name || '',
      usn: student.usn || '',
      branch: student.branch || '',
      semester: student.semester || '',
      section: student.section || '',
      email: student.email || '',
      phone: student.phone || '',
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || ''
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-8" data-testid="students-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">STUDENTS</h1>
          <p className="text-base text-zinc-600">Manage student records</p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase"
          data-testid="add-student-button"
        >
          <Plus size={18} className="mr-2" /> ADD STUDENT
        </Button>
      </div>

      <div className="border border-zinc-200 overflow-hidden">
        <table className="w-full" data-testid="students-table">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">USN</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Name</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Email</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Branch</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Sem</th>
              <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Section</th>
              <th className="p-4 text-right text-xs uppercase tracking-widest font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-b border-zinc-200 hover:bg-zinc-50" data-testid="student-row">
                <td className="p-4 font-medium">{student.usn}</td>
                <td className="p-4">{student.name}</td>
                <td className="p-4 text-sm text-zinc-600">{student.email}</td>
                <td className="p-4">{student.branch}</td>
                <td className="p-4">{student.semester}</td>
                <td className="p-4">{student.section}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => openEditDialog(student)}
                    className="p-2 hover:bg-zinc-100 duration-150"
                    data-testid="edit-student-button"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(student.id)}
                    className="p-2 hover:bg-red-50 text-[#FF2A2A] duration-150"
                    data-testid="delete-student-button"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-white border-4 border-black rounded-none" data-testid="student-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              {editingStudent ? 'EDIT STUDENT' : 'ADD STUDENT'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="rounded-none"
                  data-testid="student-name-input"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">USN</Label>
                <Input
                  value={formData.usn}
                  onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
                  required={!editingStudent}
                  disabled={!!editingStudent}
                  className="rounded-none"
                  data-testid="student-usn-input"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required={!editingStudent}
                  disabled={!!editingStudent}
                  className="rounded-none"
                  data-testid="student-email-input"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="rounded-none"
                  data-testid="student-phone-input"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Branch</Label>
                <Input
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  required
                  className="rounded-none"
                  data-testid="student-branch-input"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Semester</Label>
                <Input
                  type="number"
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  required
                  className="rounded-none"
                  data-testid="student-semester-input"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Section</Label>
                <Input
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  required
                  className="rounded-none"
                  data-testid="student-section-input"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Parent Phone</Label>
                <Input
                  value={formData.parent_phone}
                  onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                  required
                  className="rounded-none"
                  data-testid="student-parent-phone-input"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs uppercase tracking-widest font-bold">Parent Email</Label>
                <Input
                  type="email"
                  value={formData.parent_email}
                  onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                  required
                  className="rounded-none"
                  data-testid="student-parent-email-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
                variant="outline"
                className="rounded-none border-black"
                data-testid="cancel-button"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none"
                data-testid="save-student-button"
              >
                {editingStudent ? 'UPDATE' : 'CREATE'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;